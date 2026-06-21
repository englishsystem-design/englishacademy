/**
 * Attendance.gs
 * English Academy Indonesia — Attendance Tracking
 */

/**
 * Teacher/admin. Marks (or updates) one student's attendance for a date.
 * Enforces one row per (StudentID, Date) per Database Design §3.16.
 */
function markAttendance(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  if (['present', 'absent', 'sick', 'permit'].indexOf(payload.status) === -1) {
    return { success: false, message: 'Invalid attendance status.' };
  }
  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, payload.classId)) {
    throw new Error('FORBIDDEN: this is not one of your classes.');
  }

  var existing = getRowsWhere('Attendance', 'StudentID', payload.studentId)
    .filter(function (a) { return a.Date === payload.date; });

  var row = {
    StudentID: payload.studentId,
    ClassID: payload.classId,
    Date: payload.date,
    Status: payload.status,
    MarkedBy: session.userId,
    MarkedAt: nowIso()
  };

  var result;
  if (existing.length > 0) {
    row.AttendanceID = existing[0].AttendanceID;
    result = updateRow('Attendance', 'AttendanceID', existing[0].AttendanceID, row);
  } else {
    row.AttendanceID = generateId('ATT', 'Attendance', 'AttendanceID');
    result = insertRow('Attendance', row);
  }

  return { success: true, attendance: result };
}

/**
 * Teacher/admin. Marks an entire class's attendance for one date in a
 * single batched write — used by the daily roll-call UI.
 */
function markAttendanceBulk(token, classId, date, records) {
  var session = _requireSession(token, ['admin', 'teacher']);

  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, classId)) {
    throw new Error('FORBIDDEN: this is not one of your classes.');
  }

  var existingForDate = getAllRows('Attendance').filter(function (a) {
    return a.ClassID === classId && a.Date === date;
  });
  var existingByStudent = {};
  existingForDate.forEach(function (a) { existingByStudent[a.StudentID] = a; });

  var toInsert = [];
  records.forEach(function (r) {
    if (existingByStudent[r.studentId]) {
      updateRow('Attendance', 'AttendanceID', existingByStudent[r.studentId].AttendanceID, {
        Status: r.status, MarkedBy: session.userId, MarkedAt: nowIso()
      });
    } else {
      toInsert.push({
        AttendanceID: generateId('ATT', 'Attendance', 'AttendanceID'),
        StudentID: r.studentId,
        ClassID: classId,
        Date: date,
        Status: r.status,
        MarkedBy: session.userId,
        MarkedAt: nowIso()
      });
    }
  });

  if (toInsert.length > 0) insertRows('Attendance', toInsert);

  _logActivity(session.userId, 'mark_attendance_bulk', 'Marked attendance for class ' + classId + ' on ' + date);
  return { success: true, updated: existingForDate.length, inserted: toInsert.length };
}

function getAttendanceByClassDate(token, classId, date) {
  var session = _requireSession(token, ['admin', 'teacher']);
  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, classId)) {
    throw new Error('FORBIDDEN: this is not one of your classes.');
  }
  return getAllRows('Attendance').filter(function (a) { return a.ClassID === classId && a.Date === date; });
}

/**
 * The student themselves, their class teacher, or an admin may view
 * a student's attendance history.
 */
function getAttendanceByStudent(token, studentId) {
  var session = _requireSession(token, null);
  var student = getRowById('Students', 'StudentID', studentId);
  if (!student) return [];

  if (session.role === 'student' && student.UserID !== session.userId) {
    throw new Error('FORBIDDEN: you can only view your own attendance.');
  }
  if (session.role === 'teacher' && !_teacherOwnsClass(session.userId, student.ClassID)) {
    throw new Error('FORBIDDEN: this student is not in one of your classes.');
  }

  var records = getRowsWhere('Attendance', 'StudentID', studentId);
  records.sort(function (a, b) { return new Date(b.Date) - new Date(a.Date); });
  return records;
}

/**
 * Returns a simple { present, absent, sick, permit, percentage } summary
 * for the student dashboard widget.
 */
function getAttendanceSummary(token, studentId) {
  var records = getAttendanceByStudent(token, studentId); // reuses the same access checks

  var counts = { present: 0, absent: 0, sick: 0, permit: 0 };
  records.forEach(function (r) {
    if (counts.hasOwnProperty(r.Status)) counts[r.Status]++;
  });

  var total = records.length;
  var percentage = total > 0 ? Math.round((counts.present / total) * 100) : 0;

  return Object.assign({}, counts, { total: total, attendancePercentage: percentage });
}
