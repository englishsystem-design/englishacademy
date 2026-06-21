/**
 * Dashboard.gs
 * English Academy Indonesia — Aggregate Dashboard Statistics
 *
 * Admin stats are cached (Architecture §7) since they scan multiple
 * full sheets and don't need to be real-time. Student "Learning Progress"
 * is approximated as: % of published modules in the student's Kelas
 * with at least one recorded Score — there is no separate lesson-view
 * tracking table in this schema, so this is a deliberate simplification,
 * not a bug.
 */

// ── Admin ───────────────────────────────────────────────────────────

function getAdminDashboardStats(token) {
  _requireSession(token, ['admin']);

  var cache = CacheService.getScriptCache();
  var cached = cache.get('dashboard_admin_stats');
  if (cached) return JSON.parse(cached);

  var stats = {
    totalStudents: getAllRows('Students').length,
    totalTeachers: getAllRows('Teachers').length,
    totalClasses: getAllRows('Classes').filter(function (c) { return c.Status === 'active'; }).length,
    totalLessons: getAllRows('Lessons').length,
    totalQuizzes: getAllRows('Quizzes').length,
    totalExams: getAllRows('Exams').length,
    totalCertificatesIssued: getAllRows('Certificates').filter(function (c) { return c.Status === 'valid'; }).length,
    recentActivities: _recentActivities_(15)
  };

  cache.put('dashboard_admin_stats', JSON.stringify(stats), CONFIG.CACHE_TTL_DASHBOARD_STATS);
  return stats;
}

// ── Teacher ─────────────────────────────────────────────────────────

function getTeacherDashboardStats(token) {
  var session = _requireSession(token, ['teacher']);

  var teacherMatches = getRowsWhere('Teachers', 'UserID', session.userId);
  if (teacherMatches.length === 0) {
    return { assignedClasses: [], pendingGrading: 0, quizStats: [], examStats: [] };
  }
  var teacherId = teacherMatches[0].TeacherID;

  var assignedClasses = getRowsWhere('Classes', 'TeacherID', teacherId);

  var myQuizzes = getAllRows('Quizzes').filter(function (q) { return q.CreatedBy === session.userId; });
  var myExams = getAllRows('Exams').filter(function (e) { return e.CreatedBy === session.userId; });

  var pendingEssayScores = getAllRows('Scores').filter(function (s) {
    return s.GradingStatus === 'pending_manual' &&
      ((s.ParentType === 'quiz' && myQuizzes.some(function (q) { return q.QuizID === s.ParentID; })) ||
       (s.ParentType === 'exam' && myExams.some(function (e) { return e.ExamID === s.ParentID; })));
  }).length;

  var myAssignments = getAllRows('Assignments').filter(function (a) { return a.CreatedBy === session.userId; });
  var pendingSubmissions = getAllRows('Submissions').filter(function (s) {
    return s.Status === 'submitted' && myAssignments.some(function (a) { return a.AssignmentID === s.AssignmentID; });
  }).length;

  var quizStats = myQuizzes.map(function (q) {
    var scores = getRowsWhere('Scores', 'ParentID', q.QuizID).filter(function (s) { return s.ParentType === 'quiz'; });
    return {
      quizId: q.QuizID, title: q.Title, attempts: scores.length,
      averagePercentage: scores.length > 0
        ? Math.round(scores.reduce(function (sum, s) { return sum + Number(s.Percentage); }, 0) / scores.length)
        : 0
    };
  });

  var examStats = myExams.map(function (e) {
    var scores = getRowsWhere('Scores', 'ParentID', e.ExamID).filter(function (s) { return s.ParentType === 'exam'; });
    return {
      examId: e.ExamID, title: e.Title, attempts: scores.length,
      averagePercentage: scores.length > 0
        ? Math.round(scores.reduce(function (sum, s) { return sum + Number(s.Percentage); }, 0) / scores.length)
        : 0
    };
  });

  return {
    assignedClasses: assignedClasses,
    pendingGrading: pendingEssayScores + pendingSubmissions,
    quizStats: quizStats,
    examStats: examStats
  };
}

// ── Student ─────────────────────────────────────────────────────────

function getStudentDashboardStats(token) {
  var session = _requireSession(token, ['student']);

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) {
    return null;
  }
  var student = studentMatches[0];

  var myScores = getRowsWhere('Scores', 'StudentID', student.StudentID);
  var quizScores = myScores.filter(function (s) { return s.ParentType === 'quiz'; });
  var examScores = myScores.filter(function (s) { return s.ParentType === 'exam'; });

  var modulesInKelas = getAllRows('Modules').filter(function (m) {
    return m.Tingkat === student.Kelas && m.Status === 'published';
  });
  var modulesWithActivity = {};
  myScores.forEach(function (s) {
    var parentSheet = s.ParentType === 'quiz' ? 'Quizzes' : 'Exams';
    var parentIdCol = s.ParentType === 'quiz' ? 'QuizID' : 'ExamID';
    var parent = getRowById(parentSheet, parentIdCol, s.ParentID);
    if (parent && parent.ModuleID) modulesWithActivity[parent.ModuleID] = true;
  });
  var learningProgressPercent = modulesInKelas.length > 0
    ? Math.round((Object.keys(modulesWithActivity).length / modulesInKelas.length) * 100)
    : 0;

  var certificates = getRowsWhere('Certificates', 'StudentID', student.StudentID)
    .filter(function (c) { return c.Status === 'valid'; });

  var attendance = getAttendanceSummary(token, student.StudentID);

  var achievements = [];
  if (myScores.some(function (s) { return Number(s.Percentage) === 100; })) {
    achievements.push({ id: 'perfect_score', label: 'Perfect Score' });
  }
  if (quizScores.length >= 10) {
    achievements.push({ id: 'quiz_marathon', label: '10+ Quizzes Completed' });
  }
  if (certificates.length > 0) {
    achievements.push({ id: 'certified', label: 'Certified Learner' });
  }
  if (attendance.attendancePercentage >= 95 && attendance.total >= 10) {
    achievements.push({ id: 'perfect_attendance', label: 'Outstanding Attendance' });
  }

  return {
    learningProgressPercent: learningProgressPercent,
    quizScores: quizScores.slice(-10).reverse(),
    examScores: examScores.slice(-10).reverse(),
    attendance: attendance,
    certificateCount: certificates.length,
    achievements: achievements
  };
}

// ── Internal ────────────────────────────────────────────────────────

function _recentActivities_(limit) {
  var all = getAllRows('ActivityLogs');
  all.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  return all.slice(0, limit);
}
