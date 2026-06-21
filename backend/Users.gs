/**
 * Users.gs
 * English Academy Indonesia — Admin User Account Management
 *
 * Handles the Users sheet only (account-level: username, password, role,
 * status). Role-specific profile data (NISN/Kelas/ClassID for students,
 * NIP/Subject for teachers) is created separately via Students.gs /
 * Teachers.gs, called as a second step right after createUserAccount.
 * This keeps each file owning exactly one sheet's write responsibility,
 * per the file/module map in Architecture §10.
 *
 * disableUser() takes effect immediately — see Auth.gs::_setUserRevoked
 * and Security §2.1. (An earlier version of this file documented this
 * as a known limitation; it has since been closed — see git history /
 * Phase 17 notes if comparing against an older copy of this file.)
 */

// ── Create ──────────────────────────────────────────────────────────

/**
 * Admin-only. Creates a new account in the Users sheet. Does NOT create
 * the linked Students/Teachers profile row — call
 * Students.gs::createStudentProfile or Teachers.gs::createTeacherProfile
 * immediately after with the returned UserID.
 */
function createUserAccount(token, payload) {
  var session = _requireSession(token, ['admin']);

  var username = sanitizePlainText(payload.username);
  var fullName = sanitizePlainText(payload.fullName);
  var email = sanitizePlainText(payload.email);
  var phone = sanitizePlainText(payload.phone);
  var role = payload.role;
  var passwordPlain = payload.password;

  if (!isValidUsername(username)) {
    return { success: false, message: 'Username must be 3-30 characters: letters, numbers, underscore or dot only.' };
  }
  if (['admin', 'teacher', 'student'].indexOf(role) === -1) {
    return { success: false, message: 'Role must be admin, teacher, or student.' };
  }
  if (!passwordPlain || passwordPlain.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }
  if (email && !isValidEmail(email)) {
    return { success: false, message: 'Email address is not valid.' };
  }

  var newUser;
  try {
    newUser = _createUserRecord(username, passwordPlain, role, fullName, email, phone);
  } catch (err) {
    return { success: false, message: err.message };
  }

  _logActivity(session.userId, 'create_user', 'Created ' + role + ' account: ' + username);

  return {
    success: true,
    user: _stripSensitiveFields(newUser)
  };
}

// ── Read ────────────────────────────────────────────────────────────

/**
 * Admin-only. Lists all users, optionally filtered by role.
 * Password hash/salt are stripped before returning to the client.
 */
function listUsers(token, roleFilter) {
  _requireSession(token, ['admin']);

  var all = getAllRows('Users');
  var filtered = roleFilter
    ? all.filter(function (u) { return u.Role === roleFilter; })
    : all;

  return filtered.map(_stripSensitiveFields);
}

/**
 * Admin-only. Returns one user's account-level detail (no profile data).
 */
function getUserDetail(token, userId) {
  _requireSession(token, ['admin']);
  var user = getRowById('Users', 'UserID', userId);
  if (!user) return null;
  return _stripSensitiveFields(user);
}

// ── Update ──────────────────────────────────────────────────────────

/**
 * Admin-only. Disables an account and immediately revokes any session
 * the user currently holds (Auth.gs::_setUserRevoked) — they cannot
 * continue using the app until enableUser() is called.
 */
function disableUser(token, userId) {
  var session = _requireSession(token, ['admin']);

  if (userId === session.userId) {
    return { success: false, message: 'You cannot disable your own account.' };
  }

  var updated = updateRow('Users', 'UserID', userId, { Status: 'disabled' });
  if (!updated) return { success: false, message: 'User not found.' };

  _setUserRevoked(userId, true);
  _logActivity(session.userId, 'disable_user', 'Disabled user: ' + userId);
  return { success: true };
}

function enableUser(token, userId) {
  var session = _requireSession(token, ['admin']);

  var updated = updateRow('Users', 'UserID', userId, { Status: 'active' });
  if (!updated) return { success: false, message: 'User not found.' };

  _setUserRevoked(userId, false);
  _logActivity(session.userId, 'enable_user', 'Enabled user: ' + userId);
  return { success: true };
}

/**
 * Admin-only. Sets a new password for a user who forgot theirs (no email
 * delivery in v1 — the admin communicates the temporary password directly,
 * e.g. verbally or via the school's existing communication channel).
 */
function resetPassword(token, userId, newPasswordPlain) {
  var session = _requireSession(token, ['admin']);

  if (!newPasswordPlain || newPasswordPlain.length < 8) {
    return { success: false, message: 'New password must be at least 8 characters.' };
  }

  var user = getRowById('Users', 'UserID', userId);
  if (!user) return { success: false, message: 'User not found.' };

  var newSalt = _generateSalt();
  var newHash = _hashPassword(newPasswordPlain, newSalt);
  updateRow('Users', 'UserID', userId, { PasswordHash: newHash, PasswordSalt: newSalt });

  _logActivity(session.userId, 'reset_password', 'Reset password for user: ' + userId);
  return { success: true };
}

// ── Delete ──────────────────────────────────────────────────────────

/**
 * Admin-only. Hard-deletes a Users row. Intended for accidental/test
 * accounts only — does NOT cascade-delete related Students/Teachers/
 * Scores/Submissions rows, since those are historical records that
 * should normally be preserved. For a real account that's no longer
 * active, prefer disableUser() instead.
 */
function deleteUserAccount(token, userId) {
  var session = _requireSession(token, ['admin']);

  if (userId === session.userId) {
    return { success: false, message: 'You cannot delete your own account.' };
  }

  var deleted = deleteRow('Users', 'UserID', userId);
  if (!deleted) return { success: false, message: 'User not found.' };

  _logActivity(session.userId, 'delete_user', 'Deleted user: ' + userId);
  return { success: true };
}

// ── Internal ────────────────────────────────────────────────────────

function _stripSensitiveFields(user) {
  var copy = Object.assign({}, user);
  delete copy.PasswordHash;
  delete copy.PasswordSalt;
  return copy;
}
