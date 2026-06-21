/**
 * Auth.gs
 * English Academy Indonesia — Authentication & Session Management
 *
 * Every other client-callable function in this project must call
 * _requireSession() as its first line. See Architecture §3 for why:
 * Apps Script shares one global namespace across all .gs files, so
 * file separation provides zero access control by itself.
 *
 * NOTE on google.script.run: only top-level `function name() {}`
 * declarations are callable from the client — not `const name = () => {}`
 * arrow functions assigned to a variable. Every client-facing function
 * in this project is written as a classic function declaration for
 * exactly this reason.
 */

var SESSION_CACHE_PREFIX = 'session_';
var REVOKED_USERS_CACHE_KEY = 'revoked_user_ids';

// ── Internal helpers (never called directly from the client) ─────────

function _generateSalt() {
  return Utilities.getUuid();
}

function _hashPassword(passwordPlain, salt) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    passwordPlain + salt
  );
  return digest.map(function (byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Adds/removes a userId from the revoked-users cache set, checked by
 * _requireSession on every call. This is what makes disableUser() take
 * effect immediately instead of waiting for the session to naturally
 * expire (Security §2.1) — the original Phase 6 implementation didn't
 * have this; it was a documented known limitation, now closed.
 */
function _setUserRevoked(userId, revoked) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(REVOKED_USERS_CACHE_KEY);
  var revokedList = raw ? JSON.parse(raw) : [];

  if (revoked && revokedList.indexOf(userId) === -1) {
    revokedList.push(userId);
  } else if (!revoked) {
    revokedList = revokedList.filter(function (id) { return id !== userId; });
  }

  cache.put(REVOKED_USERS_CACHE_KEY, JSON.stringify(revokedList), CONFIG.SESSION_DURATION_SECONDS);
}

function _isUserRevoked(userId) {
  var raw = CacheService.getScriptCache().get(REVOKED_USERS_CACHE_KEY);
  if (!raw) return false;
  return JSON.parse(raw).indexOf(userId) !== -1;
}

/**
 * Validates a session token and (optionally) checks the caller's role
 * is allowed. Throws on failure — callers should let this propagate;
 * google.script.run's withFailureHandler will receive it on the client.
 * On success, slides the session expiry forward and returns
 * { userId, role, username }.
 */
function _requireSession(token, allowedRoles) {
  if (!token) {
    throw new Error('SESSION_MISSING: no session token provided.');
  }

  var cache = CacheService.getScriptCache();
  var raw = cache.get(SESSION_CACHE_PREFIX + token);
  if (!raw) {
    throw new Error('SESSION_EXPIRED: please log in again.');
  }

  var session = JSON.parse(raw);

  if (_isUserRevoked(session.userId)) {
    cache.remove(SESSION_CACHE_PREFIX + token);
    throw new Error('SESSION_REVOKED: your account has been disabled. Contact your administrator.');
  }

  if (allowedRoles && allowedRoles.length > 0 && allowedRoles.indexOf(session.role) === -1) {
    throw new Error('FORBIDDEN: your role does not have access to this action.');
  }

  // Sliding expiration: a genuinely active user is never logged out mid-session.
  cache.put(SESSION_CACHE_PREFIX + token, raw, CONFIG.SESSION_DURATION_SECONDS);

  return session;
}

function _logActivity(userId, action, details) {
  try {
    insertRow('ActivityLogs', {
      LogID: generateId('LOG', 'ActivityLogs', 'LogID', 6),
      UserID: userId || '',
      Action: action,
      Details: details || '',
      Timestamp: nowIso()
    });
  } catch (e) {
    // Activity logging must never block the primary action.
    Logger.log('Failed to write activity log: ' + e.message);
  }
}

// ── Public, client-callable functions ─────────────────────────────────

/**
 * Logs a user in. Returns { success, token, role, fullName, userId }
 * on success, or { success: false, message } on failure. Deliberately
 * returns a generic message on failure rather than revealing whether
 * the username or the password was wrong.
 */
function login(username, passwordPlain) {
  if (!username || !passwordPlain) {
    return { success: false, message: 'Username and password are required.' };
  }

  var matches = getRowsWhere('Users', 'Username', username);
  if (matches.length === 0) {
    _logActivity(null, 'login_failed', 'Unknown username: ' + username);
    return { success: false, message: 'Invalid username or password.' };
  }

  var user = matches[0];

  if (user.Status !== 'active') {
    _logActivity(user.UserID, 'login_failed', 'Account disabled');
    return { success: false, message: 'This account has been disabled. Contact your administrator.' };
  }

  var computedHash = _hashPassword(passwordPlain, user.PasswordSalt);
  if (computedHash !== user.PasswordHash) {
    _logActivity(user.UserID, 'login_failed', 'Wrong password');
    return { success: false, message: 'Invalid username or password.' };
  }

  var token = Utilities.getUuid();
  var session = { userId: user.UserID, role: user.Role, username: user.Username };
  CacheService.getScriptCache().put(
    SESSION_CACHE_PREFIX + token,
    JSON.stringify(session),
    CONFIG.SESSION_DURATION_SECONDS
  );

  updateRow('Users', 'UserID', user.UserID, { LastLoginAt: nowIso() });
  _logActivity(user.UserID, 'login', 'Successful login');

  return {
    success: true,
    token: token,
    role: user.Role,
    fullName: user.FullName,
    userId: user.UserID
  };
}

/**
 * Logs the current session out by removing it from the cache.
 */
function logout(token) {
  if (!token) return { success: true };
  CacheService.getScriptCache().remove(SESSION_CACHE_PREFIX + token);
  return { success: true };
}

/**
 * Returns the current user's basic profile. Any logged-in role may call this —
 * used by the frontend shell to populate the navbar after page load.
 */
function getCurrentUser(token) {
  var session = _requireSession(token, null);
  var user = getRowById('Users', 'UserID', session.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return {
    userId: user.UserID,
    username: user.Username,
    fullName: user.FullName,
    role: user.Role,
    email: user.Email
  };
}

/**
 * Lets a logged-in user change their own password.
 */
function changePassword(token, oldPasswordPlain, newPasswordPlain) {
  var session = _requireSession(token, null);

  if (!newPasswordPlain || newPasswordPlain.length < 8) {
    return { success: false, message: 'New password must be at least 8 characters.' };
  }

  var user = getRowById('Users', 'UserID', session.userId);
  var computedHash = _hashPassword(oldPasswordPlain, user.PasswordSalt);
  if (computedHash !== user.PasswordHash) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  var newSalt = _generateSalt();
  var newHash = _hashPassword(newPasswordPlain, newSalt);
  updateRow('Users', 'UserID', session.userId, {
    PasswordHash: newHash,
    PasswordSalt: newSalt
  });

  _logActivity(session.userId, 'change_password', 'Password changed by user');
  return { success: true };
}

/**
 * Internal helper used by Users.gs when an Admin creates a new account.
 * Not exposed directly to the client — Users.gs wraps this with its
 * own _requireSession(token, ['admin']) check first.
 */
function _createUserRecord(username, passwordPlain, role, fullName, email, phone) {
  var existing = getRowsWhere('Users', 'Username', username);
  if (existing.length > 0) {
    throw new Error('USERNAME_TAKEN: "' + username + '" is already in use.');
  }

  var salt = _generateSalt();
  var hash = _hashPassword(passwordPlain, salt);
  var userId = generateId('USR', 'Users', 'UserID');

  return insertRow('Users', {
    UserID: userId,
    Username: username,
    PasswordHash: hash,
    PasswordSalt: salt,
    Role: role,
    FullName: fullName,
    Email: email || '',
    Phone: phone || '',
    Status: 'active',
    CreatedAt: nowIso(),
    LastLoginAt: ''
  });
}
