/**
 * Utils.gs
 * English Academy Indonesia — Shared Helpers
 */

// ── Validation ──────────────────────────────────────────────────────

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  // 3-30 chars, letters/numbers/underscore/dot only
  return /^[a-zA-Z0-9_.]{3,30}$/.test(username || '');
}

/**
 * Strips HTML tags and trims whitespace — used for any plain-text field
 * (names, titles, short answers) before it's stored, so a student can't
 * inject a <script> tag into a field that later gets rendered elsewhere
 * (e.g. a leaderboard name). Rich-text lesson content from Quill is
 * intentionally NOT passed through this — that content is meant to
 * contain HTML and is only ever entered by authenticated teachers/admins.
 */
function sanitizePlainText(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/<[^>]*>/g, '').trim();
}

/**
 * Escapes text for safe insertion into an HTML attribute or text node.
 * Used when echoing user-supplied values back into server-rendered
 * templates (e.g. an error banner showing the username that failed).
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Date formatting ─────────────────────────────────────────────────

function formatDateForDisplay(isoString) {
  if (!isoString) return '-';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

// ── Google Drive file uploads ───────────────────────────────────────
// Shared by Lessons.gs, Assignments/Submissions, and Certificate.gs so
// every part of the app stores files the same way, in the same folder.

/**
 * Decodes a base64 data string sent from the browser (via FileReader)
 * and saves it as a file in the configured Drive folder. Returns the
 * new file's Drive ID.
 *
 * Files are shared as "anyone with the link can view" so PDF.js and
 * <video>/<img> tags can load them directly without each student
 * needing individual Drive permissions. This is appropriate for
 * lesson/course material; it is NOT appropriate for anything containing
 * private student data — see the warning in Certificate.gs before
 * reusing this for anything beyond course content and certificates.
 */
function uploadFileToDrive(base64Data, fileName, mimeType) {
  var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    fileName
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function deleteFileFromDrive(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    Logger.log('Could not trash Drive file ' + fileId + ': ' + e.message);
  }
}

function getDriveFileViewUrl(fileId) {
  if (!fileId) return '';
  return 'https://drive.google.com/uc?export=view&id=' + fileId;
}

// ── Scheduled maintenance ──────────────────────────────────────────
// Run createDailyCleanupTrigger() ONCE manually after deployment to
// register the time-based trigger. After that it runs automatically.

function createDailyCleanupTrigger() {
  // Avoid creating duplicate triggers if this is run more than once.
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'dailyCleanup';
  });
  existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('dailyCleanup')
    .timeBased()
    .everyDays(1)
    .atHour(2) // runs around 2 AM server time — low-traffic window
    .create();

  Logger.log('Daily cleanup trigger created.');
}

/**
 * Trims ActivityLogs rows older than the configured retention window.
 * Session expiry itself is handled automatically by CacheService
 * (Architecture §5) — this job only manages the audit-trail sheet,
 * which CacheService knows nothing about.
 */
function dailyCleanup() {
  var sheet = db_getSheet_('ActivityLogs');
  var headers = db_getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var timestampCol = headers.indexOf('Timestamp');
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONFIG.ACTIVITY_LOG_RETENTION_DAYS);

  var rowsToKeep = values.filter(function (row) {
    var ts = new Date(row[timestampCol]);
    return isNaN(ts.getTime()) || ts >= cutoff;
  });

  // Rewrite the sheet body in one batched operation rather than deleting
  // rows one at a time (which would shift indices mid-loop and risk
  // skipping rows — see Architecture §8 on batched writes).
  sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (rowsToKeep.length > 0) {
    sheet.getRange(2, 1, rowsToKeep.length, headers.length).setValues(rowsToKeep);
  }

  Logger.log('dailyCleanup: kept ' + rowsToKeep.length + ' of ' + values.length + ' activity log rows.');
}
