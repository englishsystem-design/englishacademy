/**
 * Students.gs
 * English Academy Indonesia — Student Profile Management
 *
 * Owns the Students sheet. A student's login identity lives in Users
 * (see Auth.gs/Users.gs) — this file owns everything specific to being
 * a student: Kelas, ClassID, NISN, etc.
 */

// ── Create ──────────────────────────────────────────────────────────

/**
 * Admin-only. Step 2 of onboarding a student, after
 * Users.gs::createUserAccount has already created the login account.
 */
function createStudentProfile(token, payload) {
  var session = _requireSession(token, ['admin']);

  var user = getRowById('Users', 'UserID', payload.userId);
  if (!user) return { success: false, message: 'User account not found.' };
  if (user.Role !== 'student') return { success: false, message: 'That account is not a student account.' };

  var existing = getRowsWhere('Students', 'UserID', payload.userId);
  if (existing.length > 0) return { success: false, message: 'A student profile already exists for this account.' };

  if (['X', 'XI', 'XII'].indexOf(payload.kelas) === -1) {
    return { success: false, message: 'Kelas must be X, XI, or XII.' };
  }

  var studentId = generateId('STU', 'Students', 'StudentID');
  var created = insertRow('Students', {
    StudentID: studentId,
    UserID: payload.userId,
    NISN: sanitizePlainText(payload.nisn || ''),
    Kelas: payload.kelas,
    ClassID: payload.classId || '',
    Gender: sanitizePlainText(payload.gender || ''),
    BirthDate: payload.birthDate || '',
    ParentContact: sanitizePlainText(payload.parentContact || ''),
    EnrollDate: nowIso()
  });

  _logActivity(session.userId, 'create_student_profile', 'Created student profile: ' + studentId);
  return { success: true, student: created };
}

// ── Read ────────────────────────────────────────────────────────────

/**
 * A student may view their own profile; teachers may view profiles of
 * students in a class they're assigned to; admins may view any profile.
 */
function getStudentProfile(token, studentId) {
  var session = _requireSession(token, null);
  var student = getRowById('Students', 'StudentID', studentId);
  if (!student) return null;

  if (session.role === 'student') {
    if (student.UserID !== session.userId) {
      throw new Error('FORBIDDEN: you can only view your own profile.');
    }
  } else if (session.role === 'teacher') {
    if (!_teacherOwnsClass(session.userId, student.ClassID)) {
      throw new Error('FORBIDDEN: this student is not in one of your classes.');
    }
  }
  // admin: no further restriction

  return student;
}

/**
 * Convenience for the student dashboard — looks up the caller's own
 * student profile without needing to know their StudentID up front.
 */
function getMyStudentProfile(token) {
  var session = _requireSession(token, ['student']);
  var matches = getRowsWhere('Students', 'UserID', session.userId);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Admin/teacher. Lists students in a given class.
 */
function listStudentsByClass(token, classId) {
  var session = _requireSession(token, ['admin', 'teacher']);

  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, classId)) {
    throw new Error('FORBIDDEN: this is not one of your classes.');
  }

  var students = getRowsWhere('Students', 'ClassID', classId);
  return students.map(function (s) {
    var user = getRowById('Users', 'UserID', s.UserID);
    return Object.assign({}, s, { fullName: user ? user.FullName : s.StudentID });
  });
}

// ── Update ──────────────────────────────────────────────────────────

/**
 * Admin-only. Updates editable profile fields (not UserID, not StudentID).
 */
function updateStudentProfile(token, studentId, updates) {
  var session = _requireSession(token, ['admin']);

  var allowedFields = ['NISN', 'Kelas', 'ClassID', 'Gender', 'BirthDate', 'ParentContact'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) {
      safeUpdates[f] = updates[f];
    }
  });

  var updated = updateRow('Students', 'StudentID', studentId, safeUpdates);
  if (!updated) return { success: false, message: 'Student not found.' };

  _logActivity(session.userId, 'update_student_profile', 'Updated student: ' + studentId);
  return { success: true, student: updated };
}

// ── Internal ────────────────────────────────────────────────────────

/**
 * Shared by Students.gs/Lessons.gs/Quiz.gs/Exam.gs/Attendance.gs to check
 * whether a teacher is allowed to act on a given class.
 */
function _teacherOwnsClass(userId, classId) {
  if (!classId) return false;
  var teacherMatches = getRowsWhere('Teachers', 'UserID', userId);
  if (teacherMatches.length === 0) return false;
  var teacherId = teacherMatches[0].TeacherID;

  var cls = getRowById('Classes', 'ClassID', classId);
  return !!cls && cls.TeacherID === teacherId;
}
