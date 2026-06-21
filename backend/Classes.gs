/**
 * Classes.gs
 * English Academy Indonesia — Class Management
 */

// ── Create ──────────────────────────────────────────────────────────

function createClass(token, payload) {
  var session = _requireSession(token, ['admin']);

  if (['X', 'XI', 'XII'].indexOf(payload.tingkat) === -1) {
    return { success: false, message: 'Tingkat must be X, XI, or XII.' };
  }
  if (!payload.className) {
    return { success: false, message: 'Class name is required.' };
  }
  if (payload.teacherId) {
    var teacher = getRowById('Teachers', 'TeacherID', payload.teacherId);
    if (!teacher) return { success: false, message: 'Assigned teacher not found.' };
  }

  var classId = generateId('CLS', 'Classes', 'ClassID');
  var created = insertRow('Classes', {
    ClassID: classId,
    ClassName: sanitizePlainText(payload.className),
    Tingkat: payload.tingkat,
    TeacherID: payload.teacherId || '',
    AcademicYear: sanitizePlainText(payload.academicYear || ''),
    Status: 'active'
  });

  _logActivity(session.userId, 'create_class', 'Created class: ' + classId);
  return { success: true, classRecord: created };
}

// ── Read ────────────────────────────────────────────────────────────

/**
 * Admins see every class. Teachers see only classes assigned to them.
 */
function listClasses(token, filters) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var all = getAllRows('Classes');

  if (session.role === 'teacher') {
    var teacherMatches = getRowsWhere('Teachers', 'UserID', session.userId);
    var teacherId = teacherMatches.length > 0 ? teacherMatches[0].TeacherID : null;
    all = all.filter(function (c) { return c.TeacherID === teacherId; });
  }

  if (filters && filters.tingkat) {
    all = all.filter(function (c) { return c.Tingkat === filters.tingkat; });
  }
  if (filters && filters.status) {
    all = all.filter(function (c) { return c.Status === filters.status; });
  }

  return all;
}

function getClassDetail(token, classId) {
  var session = _requireSession(token, ['admin', 'teacher', 'student']);
  var cls = getRowById('Classes', 'ClassID', classId);
  if (!cls) return null;

  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, classId)) {
    throw new Error('FORBIDDEN: this is not one of your classes.');
  }
  if (session.role === 'student') {
    var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
    if (studentMatches.length === 0 || studentMatches[0].ClassID !== classId) {
      throw new Error('FORBIDDEN: you are not enrolled in this class.');
    }
  }

  var studentCount = getRowsWhere('Students', 'ClassID', classId).length;
  return Object.assign({}, cls, { studentCount: studentCount });
}

// ── Update ──────────────────────────────────────────────────────────

function assignTeacherToClass(token, classId, teacherId) {
  var session = _requireSession(token, ['admin']);

  var teacher = getRowById('Teachers', 'TeacherID', teacherId);
  if (!teacher) return { success: false, message: 'Teacher not found.' };

  var updated = updateRow('Classes', 'ClassID', classId, { TeacherID: teacherId });
  if (!updated) return { success: false, message: 'Class not found.' };

  _logActivity(session.userId, 'assign_teacher', 'Assigned teacher ' + teacherId + ' to class ' + classId);
  return { success: true, classRecord: updated };
}

/**
 * Moves a student into a class (or out, if classId is '').
 */
function enrollStudent(token, studentId, classId) {
  var session = _requireSession(token, ['admin']);

  if (classId) {
    var cls = getRowById('Classes', 'ClassID', classId);
    if (!cls) return { success: false, message: 'Class not found.' };
  }

  var updated = updateRow('Students', 'StudentID', studentId, { ClassID: classId });
  if (!updated) return { success: false, message: 'Student not found.' };

  _logActivity(session.userId, 'enroll_student', 'Enrolled student ' + studentId + ' into class ' + classId);
  return { success: true, student: updated };
}

function archiveClass(token, classId) {
  var session = _requireSession(token, ['admin']);
  var updated = updateRow('Classes', 'ClassID', classId, { Status: 'archived' });
  if (!updated) return { success: false, message: 'Class not found.' };

  _logActivity(session.userId, 'archive_class', 'Archived class: ' + classId);
  return { success: true };
}
