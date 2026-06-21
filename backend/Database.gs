/**
 * Database.gs
 * English Academy Indonesia — Data Access Layer
 *
 * Generic CRUD helpers over Google Sheets. No other file should call
 * SpreadsheetApp directly to read/write business data — everything
 * goes through here, so locking, header-mapping, and ID generation
 * stay consistent across the whole project.
 */

var DB_LOCK_TIMEOUT_MS = 10000;

/**
 * Returns the Spreadsheet bound via Config.gs (SPREADSHEET_ID).
 */
function db_getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function db_getSheet_(sheetName) {
  var ss = db_getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Unknown sheet: ' + sheetName + '. Did you run createDatabaseStructure()?');
  }
  return sheet;
}

function db_getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function db_rowToObject_(headers, rowArray) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = rowArray[i];
  }
  return obj;
}

function db_objectToRow_(headers, obj) {
  return headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
}

/**
 * Reads every data row (excluding the header) from a sheet and returns
 * an array of plain objects keyed by header name.
 */
function getAllRows(sheetName) {
  var sheet = db_getSheet_(sheetName);
  var headers = db_getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    return db_rowToObject_(headers, row);
  });
}

/**
 * Finds the 1-based sheet row number (including the header offset)
 * for the row whose idColumn matches idValue. Returns -1 if not found.
 * Internal helper — business logic should use getRowById / updateRow / deleteRow.
 */
function db_findRowIndex_(sheet, headers, idColumn, idValue) {
  var idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) {
    throw new Error('Column "' + idColumn + '" does not exist on sheet "' + sheet.getName() + '"');
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var idValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]) === String(idValue)) {
      return i + 2; // +2: 1-based, plus header row offset
    }
  }
  return -1;
}

/**
 * Returns a single row as an object, or null if no match.
 */
function getRowById(sheetName, idColumn, idValue) {
  var sheet = db_getSheet_(sheetName);
  var headers = db_getHeaders_(sheet);
  var rowIndex = db_findRowIndex_(sheet, headers, idColumn, idValue);
  if (rowIndex === -1) return null;

  var rowValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  return db_rowToObject_(headers, rowValues);
}

/**
 * Returns all rows where row[filterColumn] === filterValue.
 * For larger sheets this still does a full scan — acceptable at the
 * scale documented in Architecture §9; see Phase 22 (Maintenance) for
 * archiving guidance once a sheet grows large.
 */
function getRowsWhere(sheetName, filterColumn, filterValue) {
  return getAllRows(sheetName).filter(function (row) {
    return String(row[filterColumn]) === String(filterValue);
  });
}

/**
 * Appends a new row. Acquires a script lock so concurrent inserts from
 * different students/teachers can't interleave and corrupt the sheet.
 * Returns the inserted object (as written, with all header columns present).
 */
function insertRow(sheetName, dataObject) {
  var lock = LockService.getScriptLock();
  lock.waitLock(DB_LOCK_TIMEOUT_MS);
  try {
    var sheet = db_getSheet_(sheetName);
    var headers = db_getHeaders_(sheet);
    var row = db_objectToRow_(headers, dataObject);
    sheet.appendRow(row);
    return db_rowToObject_(headers, row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates an existing row, merging `updates` into the existing row data
 * (columns not present in `updates` are left unchanged). Returns the
 * full updated object, or null if no row matched idValue.
 */
function updateRow(sheetName, idColumn, idValue, updates) {
  var lock = LockService.getScriptLock();
  lock.waitLock(DB_LOCK_TIMEOUT_MS);
  try {
    var sheet = db_getSheet_(sheetName);
    var headers = db_getHeaders_(sheet);
    var rowIndex = db_findRowIndex_(sheet, headers, idColumn, idValue);
    if (rowIndex === -1) return null;

    var existingValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var existingObj = db_rowToObject_(headers, existingValues);
    var mergedObj = Object.assign({}, existingObj, updates);
    var mergedRow = db_objectToRow_(headers, mergedObj);

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([mergedRow]);
    return mergedObj;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Deletes the row matching idValue. Returns true if a row was deleted,
 * false if no match was found.
 */
function deleteRow(sheetName, idColumn, idValue) {
  var lock = LockService.getScriptLock();
  lock.waitLock(DB_LOCK_TIMEOUT_MS);
  try {
    var sheet = db_getSheet_(sheetName);
    var headers = db_getHeaders_(sheet);
    var rowIndex = db_findRowIndex_(sheet, headers, idColumn, idValue);
    if (rowIndex === -1) return false;

    sheet.deleteRow(rowIndex);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Appends multiple rows in a single locked, batched write — used where
 * one user action produces many rows at once (e.g. all answers from one
 * quiz submission), so we don't acquire/release the script lock once
 * per row (see Architecture §8 on batched writes).
 */
function insertRows(sheetName, dataObjects) {
  if (!dataObjects || dataObjects.length === 0) return [];
  var lock = LockService.getScriptLock();
  lock.waitLock(DB_LOCK_TIMEOUT_MS);
  try {
    var sheet = db_getSheet_(sheetName);
    var headers = db_getHeaders_(sheet);
    var rows = dataObjects.map(function (obj) { return db_objectToRow_(headers, obj); });
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    return rows.map(function (row) { return db_rowToObject_(headers, row); });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates the next sequential, zero-padded ID for a given prefix,
 * e.g. generateId('STU', 'Students', 'StudentID') -> "STU-00042".
 * Locked to avoid two concurrent signups generating the same ID.
 */
function generateId(prefix, sheetName, idColumn, padLength) {
  padLength = padLength || 5;
  var lock = LockService.getScriptLock();
  lock.waitLock(DB_LOCK_TIMEOUT_MS);
  try {
    var rows = getAllRows(sheetName);
    var maxNum = 0;
    rows.forEach(function (row) {
      var id = String(row[idColumn] || '');
      var match = id.match(new RegExp('^' + prefix + '-(\\d+)$'));
      if (match) {
        var num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    var nextNum = maxNum + 1;
    return prefix + '-' + String(nextNum).padStart(padLength, '0');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns the current timestamp as an ISO string — used consistently
 * across every domain file for CreatedAt/UpdatedAt/Timestamp columns.
 */
function nowIso() {
  return new Date().toISOString();
}
