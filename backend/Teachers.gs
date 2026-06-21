/**
 * Teachers.gs
 * English Academy Indonesia — Teacher Profile Management
 *
 * Owns the Teachers sheet, mirroring the pattern in Students.gs.
 */

// ── Create ──────────────────────────────────────────────────────────

function createTeacherProfile(token, payload) {
  var session = _requireSession(token, ['admin']);

  var user = getRowById('Users', 'UserID', payload.userId);
  if (!user) return { success: false, message: 'User account not found.' };
  if (user.Role !== 'teacher') return { success: false, message: 'That account is not a teacher account.' };

  var existing = getRowsWhere('Teachers', 'UserID', payload.userId);
  if (existing.length > 0) return { success: false, message: 'A teacher profile already exists for this account.' };

  var teacherId = generateId('TCH', 'Teachers', 'TeacherID');
  var created = insertRow('Teachers', {
    TeacherID: teacherId,
    UserID: payload.userId,
    NIP: sanitizePlainText(payload.nip || ''),
    Subject: sanitizePlainText(payload.subject || 'English'),
    Bio: sanitizePlainText(payload.bio || '')
  });

  _logActivity(session.userId, 'create_teacher_profile', 'Created teacher profile: ' + teacherId);
  return { success: true, teacher: created };
}

// ── Read ────────────────────────────────────────────────────────────

function getTeacherProfile(token, teacherId) {
  _requireSession(token, null); // any logged-in role may view a teacher's public profile
  return getRowById('Teachers', 'TeacherID', teacherId);
}

function getMyTeacherProfile(token) {
  var session = _requireSession(token, ['teacher']);
  var matches = getRowsWhere('Teachers', 'UserID', session.userId);
  return matches.length > 0 ? matches[0] : null;
}

function listTeachers(token) {
  _requireSession(token, ['admin']);
  return getAllRows('Teachers');
}

/**
 * Returns every class assigned to the calling teacher — used to populate
 * the Teacher Dashboard's "Assigned Classes" widget.
 */
function getMyAssignedClasses(token) {
  var session = _requireSession(token, ['teacher']);
  var teacherMatches = getRowsWhere('Teachers', 'UserID', session.userId);
  if (teacherMatches.length === 0) return [];

  return getRowsWhere('Classes', 'TeacherID', teacherMatches[0].TeacherID);
}

// ── Update ──────────────────────────────────────────────────────────

/**
 * A teacher may update their own bio; only an admin may change NIP/Subject.
 */
function updateTeacherProfile(token, teacherId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var teacher = getRowById('Teachers', 'TeacherID', teacherId);
  if (!teacher) return { success: false, message: 'Teacher not found.' };

  var safeUpdates = {};

  if (session.role === 'teacher') {
    if (teacher.UserID !== session.userId) {
      throw new Error('FORBIDDEN: you can only edit your own profile.');
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'Bio')) {
      safeUpdates.Bio = sanitizePlainText(updates.Bio);
    }
  } else {
    ['NIP', 'Subject', 'Bio'].forEach(function (f) {
      if (Object.prototype.hasOwnProperty.call(updates, f)) {
        safeUpdates[f] = sanitizePlainText(updates[f]);
      }
    });
  }

  var updated = updateRow('Teachers', 'TeacherID', teacherId, safeUpdates);
  _logActivity(session.userId, 'update_teacher_profile', 'Updated teacher: ' + teacherId);
  return { success: true, teacher: updated };
}
