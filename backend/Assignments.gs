/**
 * Assignments.gs
 * English Academy Indonesia — Assignment System
 *
 * Not in the original 17-file list, but Assignments/Submissions are
 * substantial enough (file upload, rubric grading, late-detection,
 * notifications) to deserve their own file rather than overloading
 * Lessons.gs — the same reasoning that gave Quiz/Exam their own files
 * despite sharing the Questions sheet.
 */

function createAssignment(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var mod = getRowById('Modules', 'ModuleID', payload.moduleId);
  if (!mod) return { success: false, message: 'Module not found.' };
  if (!payload.title) return { success: false, message: 'Title is required.' };
  if (!payload.dueDate) return { success: false, message: 'Due date is required.' };

  var assignmentId = generateId('ASG', 'Assignments', 'AssignmentID');
  var created = insertRow('Assignments', {
    AssignmentID: assignmentId,
    ModuleID: payload.moduleId,
    Title: sanitizePlainText(payload.title),
    Instructions: payload.instructions || '',
    DueDate: payload.dueDate,
    MaxScore: payload.maxScore || 100,
    RubricJSON: JSON.stringify(payload.rubric || []),
    CreatedBy: session.userId,
    CreatedAt: nowIso()
  });

  _logActivity(session.userId, 'create_assignment', 'Created assignment: ' + assignmentId);
  _notifyClassAboutModule_(mod.ModuleID, 'new_assignment', 'New assignment: ' + created.Title,
    'A new assignment has been posted for ' + mod.ModuleTitle + '.', assignmentId);

  return { success: true, assignment: created };
}

function updateAssignment(token, assignmentId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['Title', 'Instructions', 'DueDate', 'MaxScore', 'RubricJSON'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) safeUpdates[f] = updates[f];
  });

  var updated = updateRow('Assignments', 'AssignmentID', assignmentId, safeUpdates);
  if (!updated) return { success: false, message: 'Assignment not found.' };

  _logActivity(session.userId, 'update_assignment', 'Updated assignment: ' + assignmentId);
  return { success: true, assignment: updated };
}

function deleteAssignment(token, assignmentId) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var assignment = getRowById('Assignments', 'AssignmentID', assignmentId);
  if (!assignment) return { success: false, message: 'Assignment not found.' };

  getRowsWhere('Submissions', 'AssignmentID', assignmentId).forEach(function (sub) {
    if (sub.FileDriveID) deleteFileFromDrive(sub.FileDriveID);
    deleteRow('Submissions', 'SubmissionID', sub.SubmissionID);
  });

  deleteRow('Assignments', 'AssignmentID', assignmentId);
  _logActivity(session.userId, 'delete_assignment', 'Deleted assignment: ' + assignmentId);
  return { success: true };
}

function listAssignmentsByModule(token, moduleId) {
  _requireSession(token, null);
  return getRowsWhere('Assignments', 'ModuleID', moduleId);
}

/**
 * Teacher/admin. Lists assignments for the manager UI (assignments.html),
 * enriched with submission counts so the page doesn't need a separate
 * round-trip per assignment card.
 */
function listMyCreatedAssignments(token) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var all = getAllRows('Assignments');
  if (session.role === 'teacher') {
    all = all.filter(function (a) { return a.CreatedBy === session.userId; });
  }

  return all.map(function (a) {
    var submissions = getRowsWhere('Submissions', 'AssignmentID', a.AssignmentID);
    return Object.assign({}, a, {
      submissionCount: submissions.length,
      pendingCount: submissions.filter(function (s) { return s.Status !== 'graded'; }).length
    });
  });
}

function getAssignment(token, assignmentId) {
  _requireSession(token, null);
  return getRowById('Assignments', 'AssignmentID', assignmentId);
}

// ── Submissions ─────────────────────────────────────────────────────

/**
 * Student. Uploads a PDF/image submission. If a prior submission exists
 * and hasn't been graded yet, it's replaced (resubmission); if it has
 * already been graded, resubmission is blocked — a teacher must clear
 * the grade first (via gradeSubmission with score=null) to allow it.
 */
function submitAssignment(token, assignmentId, base64Data, fileName, mimeType) {
  var session = _requireSession(token, ['student']);

  var assignment = getRowById('Assignments', 'AssignmentID', assignmentId);
  if (!assignment) return { success: false, message: 'Assignment not found.' };

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) return { success: false, message: 'Student profile not found.' };
  var studentId = studentMatches[0].StudentID;

  var existing = getRowsWhere('Submissions', 'AssignmentID', assignmentId)
    .filter(function (s) { return s.StudentID === studentId; });

  if (existing.length > 0 && existing[0].Status === 'graded') {
    return { success: false, message: 'This assignment has already been graded and cannot be resubmitted.' };
  }

  var fileId = uploadFileToDrive(base64Data, fileName, mimeType);
  var submittedAt = nowIso();
  var isLate = new Date(submittedAt) > new Date(assignment.DueDate);

  var submissionRow = {
    SubmissionID: existing.length > 0 ? existing[0].SubmissionID : generateId('SUB', 'Submissions', 'SubmissionID'),
    AssignmentID: assignmentId,
    StudentID: studentId,
    FileDriveID: fileId,
    SubmittedAt: submittedAt,
    Status: isLate ? 'late' : 'submitted',
    Score: '',
    Feedback: '',
    GradedBy: '',
    GradedAt: ''
  };

  if (existing.length > 0) {
    if (existing[0].FileDriveID) deleteFileFromDrive(existing[0].FileDriveID);
    updateRow('Submissions', 'SubmissionID', existing[0].SubmissionID, submissionRow);
  } else {
    insertRow('Submissions', submissionRow);
  }

  _logActivity(session.userId, 'submit_assignment', 'Submitted assignment: ' + assignmentId);
  return { success: true, submission: submissionRow };
}

/**
 * Student. Lists every assignment relevant to the student's Kelas,
 * joined with their own submission status (or null if not yet
 * submitted) — this is what assignments.html's student view needs;
 * listMySubmissions() alone can't show assignments not yet attempted.
 */
function listAssignmentsForStudent(token) {
  var session = _requireSession(token, ['student']);

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) return [];
  var student = studentMatches[0];

  var modulesInKelas = getAllRows('Modules').filter(function (m) { return m.Tingkat === student.Kelas; });
  var moduleIds = modulesInKelas.map(function (m) { return m.ModuleID; });

  var assignments = getAllRows('Assignments').filter(function (a) { return moduleIds.indexOf(a.ModuleID) !== -1; });
  var mySubmissions = getRowsWhere('Submissions', 'StudentID', student.StudentID);

  return assignments.map(function (a) {
    var submission = mySubmissions.filter(function (s) { return s.AssignmentID === a.AssignmentID; })[0] || null;
    return Object.assign({}, a, { mySubmission: submission });
  });
}

function listMySubmissions(token) {
  var session = _requireSession(token, ['student']);
  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) return [];
  return getRowsWhere('Submissions', 'StudentID', studentMatches[0].StudentID);
}

function listSubmissionsForAssignment(token, assignmentId) {
  _requireSession(token, ['admin', 'teacher']);
  return getRowsWhere('Submissions', 'AssignmentID', assignmentId).map(function (sub) {
    var student = getRowById('Students', 'StudentID', sub.StudentID);
    var user = student ? getRowById('Users', 'UserID', student.UserID) : null;
    return Object.assign({}, sub, {
      studentName: user ? user.FullName : 'Unknown',
      fileUrl: sub.FileDriveID ? getDriveFileViewUrl(sub.FileDriveID) : ''
    });
  });
}

/**
 * Teacher/admin. Pass score=null to clear a grade (re-opens the
 * submission for resubmission per submitAssignment's rule above).
 */
function gradeSubmission(token, submissionId, score, feedback) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var submission = getRowById('Submissions', 'SubmissionID', submissionId);
  if (!submission) return { success: false, message: 'Submission not found.' };

  var updates;
  if (score === null) {
    updates = { Status: 'submitted', Score: '', Feedback: '', GradedBy: '', GradedAt: '' };
  } else {
    updates = {
      Status: 'graded',
      Score: score,
      Feedback: sanitizePlainText(feedback || ''),
      GradedBy: session.userId,
      GradedAt: nowIso()
    };
  }

  var updated = updateRow('Submissions', 'SubmissionID', submissionId, updates);

  if (score !== null) {
    var student = getRowById('Students', 'StudentID', submission.StudentID);
    if (student) {
      notifyUser(student.UserID, 'new_score', 'Assignment graded',
        'Your assignment submission has been graded: ' + score + ' points.', submissionId);
    }
    _logActivity(session.userId, 'grade_submission', 'Graded submission: ' + submissionId);
  }

  return { success: true, submission: updated };
}

// ── Internal ────────────────────────────────────────────────────────

/**
 * Notifies every student enrolled in any class at the module's Tingkat
 * about new content. A simple broadcast — fine at this scale (Architecture
 * §9); a true per-class targeting model can be added later if needed.
 */
function _notifyClassAboutModule_(moduleId, type, title, message, relatedId) {
  try {
    var mod = getRowById('Modules', 'ModuleID', moduleId);
    if (!mod) return;
    var students = getAllRows('Students').filter(function (s) { return s.Kelas === mod.Tingkat; });
    students.forEach(function (s) {
      notifyUser(s.UserID, type, title, message, relatedId);
    });
  } catch (e) {
    Logger.log('Notification broadcast failed: ' + e.message);
  }
}
