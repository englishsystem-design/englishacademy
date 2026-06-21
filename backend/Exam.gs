/**
 * Exam.gs
 * English Academy Indonesia — Exam System
 *
 * Exams reuse the Questions CRUD from Quiz.gs (addQuestion/updateQuestion/
 * deleteQuestion/listQuestions with parentType='exam') and the same
 * _gradeAnswer_ grading logic — see Quiz.gs file header for why.
 *
 * Trust model differs deliberately from Quiz.gs: exams are higher-stakes,
 * so TimeTakenSeconds is computed server-side from a CacheService-recorded
 * start timestamp rather than trusted from the client, and the server
 * enforces the StartWindow/EndWindow + duration deadline independently
 * of whatever the client-side countdown UI shows.
 */

var EXAM_ATTEMPT_CACHE_PREFIX = 'examattempt_';

// ── Exams (CRUD) ────────────────────────────────────────────────────

function createExam(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  if (!payload.title) return { success: false, message: 'Title is required.' };
  if (!payload.durationMinutes || payload.durationMinutes <= 0) {
    return { success: false, message: 'Duration (minutes) is required.' };
  }
  if (!payload.startWindow || !payload.endWindow) {
    return { success: false, message: 'Start and end window are required.' };
  }

  var examId = generateId('EX', 'Exams', 'ExamID');
  var created = insertRow('Exams', {
    ExamID: examId,
    ModuleID: payload.moduleId || '',
    Title: sanitizePlainText(payload.title),
    Instructions: payload.instructions || '',
    DurationMinutes: payload.durationMinutes,
    StartWindow: payload.startWindow,
    EndWindow: payload.endWindow,
    RandomizeQuestions: !!payload.randomizeQuestions,
    AntiCheatWarning: payload.antiCheatWarning !== false,
    Status: 'draft',
    CreatedBy: session.userId,
    CreatedAt: nowIso()
  });

  _logActivity(session.userId, 'create_exam', 'Created exam: ' + examId);
  return { success: true, exam: created };
}

function updateExam(token, examId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['Title', 'Instructions', 'DurationMinutes', 'StartWindow', 'EndWindow', 'RandomizeQuestions', 'AntiCheatWarning', 'Status'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) safeUpdates[f] = updates[f];
  });

  var updated = updateRow('Exams', 'ExamID', examId, safeUpdates);
  if (!updated) return { success: false, message: 'Exam not found.' };

  _logActivity(session.userId, 'update_exam', 'Updated exam: ' + examId);
  return { success: true, exam: updated };
}

function deleteExam(token, examId) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var exam = getRowById('Exams', 'ExamID', examId);
  if (!exam) return { success: false, message: 'Exam not found.' };

  if (session.role === 'teacher' && exam.CreatedBy !== session.userId) {
    throw new Error('FORBIDDEN: only the original author or an admin can delete this exam.');
  }

  getRowsWhere('Questions', 'ParentID', examId)
    .filter(function (q) { return q.ParentType === 'exam'; })
    .forEach(function (q) { deleteRow('Questions', 'QuestionID', q.QuestionID); });

  deleteRow('Exams', 'ExamID', examId);
  _logActivity(session.userId, 'delete_exam', 'Deleted exam: ' + examId);
  return { success: true };
}

function listExams(token, filters) {
  var session = _requireSession(token, null);
  var all = getAllRows('Exams');

  if (filters && filters.moduleId) {
    all = all.filter(function (e) { return e.ModuleID === filters.moduleId; });
  }
  if (session.role === 'student') {
    all = all.filter(function (e) { return e.Status === 'published'; });
  }
  return all;
}

// ── Taking an exam ──────────────────────────────────────────────────

/**
 * Student. Starts a timed attempt. Validates the exam's open window,
 * checks this student hasn't already attempted it (exams are single-
 * attempt, unlike quizzes), and records a server-side deadline that
 * submitExamAttempt will independently enforce.
 */
function startExamAttempt(token, examId) {
  var session = _requireSession(token, ['student']);

  var exam = getRowById('Exams', 'ExamID', examId);
  if (!exam || exam.Status !== 'published') {
    throw new Error('NOT_AVAILABLE: this exam is not currently available.');
  }

  var now = new Date();
  if (now < new Date(exam.StartWindow)) {
    throw new Error('NOT_OPEN_YET: this exam opens at ' + exam.StartWindow + '.');
  }
  if (now > new Date(exam.EndWindow)) {
    throw new Error('CLOSED: this exam closed at ' + exam.EndWindow + '.');
  }

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) throw new Error('STUDENT_PROFILE_NOT_FOUND');
  var studentId = studentMatches[0].StudentID;

  var existingAttempts = getRowsWhere('Scores', 'StudentID', studentId)
    .filter(function (s) { return s.ParentType === 'exam' && s.ParentID === examId; });
  if (existingAttempts.length > 0) {
    throw new Error('ALREADY_ATTEMPTED: exams may only be taken once.');
  }

  var attemptId = Utilities.getUuid();
  var durationMs = Number(exam.DurationMinutes) * 60 * 1000;
  var windowRemainingMs = new Date(exam.EndWindow).getTime() - now.getTime();
  var deadlineMs = now.getTime() + Math.min(durationMs, windowRemainingMs);

  CacheService.getScriptCache().put(
    EXAM_ATTEMPT_CACHE_PREFIX + attemptId,
    JSON.stringify({ studentId: studentId, examId: examId, startedAt: now.getTime(), deadlineAt: deadlineMs }),
    Math.ceil(durationMs / 1000) + 1800 // attempt duration + 30 min grace for cache lookup at submission
  );

  var questions = getRowsWhere('Questions', 'ParentID', examId)
    .filter(function (q) { return q.ParentType === 'exam'; })
    .map(function (q) {
      return {
        QuestionID: q.QuestionID,
        QuestionType: q.QuestionType,
        QuestionText: q.QuestionText,
        Options: JSON.parse(q.OptionsJSON || '{}'),
        Points: q.Points
      };
    });

  if (exam.RandomizeQuestions) questions = _shuffleArray(questions);

  _logActivity(session.userId, 'start_exam', 'Started exam: ' + examId);

  return {
    exam: exam,
    questions: questions,
    attemptId: attemptId,
    deadlineAt: new Date(deadlineMs).toISOString(),
    antiCheatWarning: exam.AntiCheatWarning
  };
}

/**
 * Student. Called periodically (e.g. every 30s) by the client to persist
 * in-progress answers against disconnects/crashes. Cheap CacheService
 * write — does not touch Sheets at all (see Architecture §7).
 */
function autoSaveExamProgress(token, attemptId, partialAnswers) {
  var session = _requireSession(token, ['student']);

  var meta = _getExamAttemptMeta_(attemptId);
  if (!meta || meta.studentId !== _studentIdForUser_(session.userId)) {
    throw new Error('INVALID_ATTEMPT');
  }

  CacheService.getScriptCache().put(
    'examprogress_' + attemptId,
    JSON.stringify(partialAnswers),
    1800 // 30 minutes is enough between autosaves; refreshed on every call
  );
  return { success: true, savedAt: nowIso() };
}

/**
 * Student. Final submission — manual ("Submit") or automatic (timer
 * hit zero). If `answers` is omitted (e.g. the tab crashed and the
 * client is recovering), falls back to the last auto-saved progress.
 */
function submitExamAttempt(token, examId, attemptId, answers, autoSubmitted) {
  var session = _requireSession(token, ['student']);

  var meta = _getExamAttemptMeta_(attemptId);
  if (!meta || meta.examId !== examId) {
    return { success: false, message: 'Exam attempt session not found or expired.' };
  }

  var studentId = meta.studentId;
  var exam = getRowById('Exams', 'ExamID', examId);
  if (!exam) return { success: false, message: 'Exam not found.' };

  if (!answers || answers.length === 0) {
    var cachedRaw = CacheService.getScriptCache().get('examprogress_' + attemptId);
    answers = cachedRaw ? JSON.parse(cachedRaw) : [];
  }

  var serverNow = Date.now();
  var timeTakenSeconds = Math.round((Math.min(serverNow, meta.deadlineAt) - meta.startedAt) / 1000);
  var pastDeadline = serverNow > meta.deadlineAt + 30000; // 30s grace for network latency

  var totalPoints = 0, earnedPoints = 0, hasEssay = false;
  var answerRows = [];

  answers.forEach(function (a) {
    var question = getRowById('Questions', 'QuestionID', a.questionId);
    if (!question || question.ParentType !== 'exam' || question.ParentID !== examId) return;

    var points = Number(question.Points) || 0;
    totalPoints += points;

    var grading = _gradeAnswer_(question.QuestionType, a.studentAnswer, question.CorrectAnswerJSON);
    if (grading.isCorrect === null) hasEssay = true;
    if (grading.isCorrect === true) earnedPoints += points;

    answerRows.push({
      AnswerID: generateId('ANS', 'Answers', 'AnswerID', 6),
      AttemptID: attemptId,
      StudentID: studentId,
      QuestionID: a.questionId,
      StudentAnswerJSON: JSON.stringify(a.studentAnswer),
      IsCorrect: grading.isCorrect === null ? '' : grading.isCorrect,
      PointsAwarded: grading.isCorrect === true ? points : (grading.isCorrect === false ? 0 : '')
    });
  });

  insertRows('Answers', answerRows);

  var percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  var scoreRow = insertRow('Scores', {
    ScoreID: generateId('SCR', 'Scores', 'ScoreID'),
    StudentID: studentId,
    AttemptID: attemptId,
    ParentType: 'exam',
    ParentID: examId,
    Score: earnedPoints,
    MaxScore: totalPoints,
    Percentage: percentage,
    TimeTakenSeconds: timeTakenSeconds,
    AttemptNumber: 1,
    SubmittedAt: nowIso(),
    GradingStatus: hasEssay ? 'pending_manual' : 'auto'
  });

  CacheService.getScriptCache().remove(EXAM_ATTEMPT_CACHE_PREFIX + attemptId);
  CacheService.getScriptCache().remove('examprogress_' + attemptId);

  _logActivity(session.userId, autoSubmitted ? 'auto_submit_exam' : 'submit_exam',
    'Submitted exam ' + examId + ' — ' + percentage + '%' + (pastDeadline ? ' (past deadline)' : ''));

  return { success: true, score: scoreRow, pastDeadline: pastDeadline };
}

/**
 * Client calls this when it detects a tab-switch / focus-loss during an
 * active exam (the "Anti-Cheat Warning" feature). Logged, not blocking —
 * the teacher report (getExamReport) surfaces a count per student.
 */
function logExamCheatWarning(token, examId, attemptId, eventType) {
  var session = _requireSession(token, ['student']);
  _logActivity(session.userId, 'exam_anti_cheat_warning',
    JSON.stringify({ examId: examId, attemptId: attemptId, eventType: eventType }));
  return { success: true };
}

// ── Reporting ───────────────────────────────────────────────────────

function getExamReport(token, examId) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var scores = getRowsWhere('Scores', 'ParentID', examId).filter(function (s) { return s.ParentType === 'exam'; });
  var cheatLogs = getAllRows('ActivityLogs').filter(function (l) {
    return l.Action === 'exam_anti_cheat_warning' && l.Details.indexOf('"examId":"' + examId + '"') !== -1;
  });

  var rows = scores.map(function (s) {
    var student = getRowById('Students', 'StudentID', s.StudentID);
    var user = student ? getRowById('Users', 'UserID', student.UserID) : null;
    var warningCount = cheatLogs.filter(function (l) { return l.UserID === (user ? user.UserID : null); }).length;

    return {
      studentId: s.StudentID,
      fullName: user ? user.FullName : 'Unknown',
      score: Number(s.Score),
      maxScore: Number(s.MaxScore),
      percentage: Number(s.Percentage),
      gradingStatus: s.GradingStatus,
      submittedAt: s.SubmittedAt,
      timeTakenSeconds: Number(s.TimeTakenSeconds),
      cheatWarningCount: warningCount
    };
  });

  rows.sort(function (a, b) { return b.percentage - a.percentage; });

  var average = rows.length > 0
    ? Math.round(rows.reduce(function (sum, r) { return sum + r.percentage; }, 0) / rows.length)
    : 0;

  return { examId: examId, totalAttempts: rows.length, averagePercentage: average, students: rows };
}

// ── Internal ────────────────────────────────────────────────────────

function _getExamAttemptMeta_(attemptId) {
  var raw = CacheService.getScriptCache().get(EXAM_ATTEMPT_CACHE_PREFIX + attemptId);
  return raw ? JSON.parse(raw) : null;
}

function _studentIdForUser_(userId) {
  var matches = getRowsWhere('Students', 'UserID', userId);
  return matches.length > 0 ? matches[0].StudentID : null;
}
