/**
 * Tests.gs
 * English Academy Indonesia — Backend Test Suite
 *
 * Runs entirely inside the Apps Script editor — no npm, no terminal, no
 * test framework installation, consistent with the project's beginner
 * deployment constraints. Select "runAllTests" from the function
 * dropdown and click Run; results appear in the Execution Log.
 *
 * These exercise pure logic (grading, ID generation, hashing) without
 * touching the real Sheets data, except where noted, to be safe to run
 * repeatedly against a live spreadsheet without polluting it.
 */

var TEST_RESULTS = [];

function _assert(description, condition) {
  TEST_RESULTS.push({ description: description, passed: !!condition });
}

function _assertEqual(description, actual, expected) {
  var passed = JSON.stringify(actual) === JSON.stringify(expected);
  TEST_RESULTS.push({
    description: description, passed: passed,
    detail: passed ? '' : ('expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual))
  });
}

function runAllTests() {
  TEST_RESULTS = [];

  testPasswordHashing();
  testGradingLogic();
  testSanitization();
  testEmailValidation();
  testUsernameValidation();

  var passed = TEST_RESULTS.filter(function (r) { return r.passed; }).length;
  var failed = TEST_RESULTS.length - passed;

  Logger.log('═══════════════════════════════════');
  Logger.log('TEST RESULTS: ' + passed + ' passed, ' + failed + ' failed');
  Logger.log('═══════════════════════════════════');
  TEST_RESULTS.forEach(function (r) {
    Logger.log((r.passed ? '✓ PASS' : '✗ FAIL') + ' — ' + r.description + (r.detail ? ' (' + r.detail + ')' : ''));
  });

  if (failed > 0) {
    throw new Error(failed + ' test(s) failed — see Execution Log above for details.');
  }
}

// ── Auth ────────────────────────────────────────────────────────────

function testPasswordHashing() {
  var salt = _generateSalt();
  var hash1 = _hashPassword('mySecretPass123', salt);
  var hash2 = _hashPassword('mySecretPass123', salt);
  var hash3 = _hashPassword('differentPass456', salt);

  _assert('same password + same salt produces same hash', hash1 === hash2);
  _assert('different password produces different hash', hash1 !== hash3);
  _assert('hash is a 64-character hex string (SHA-256)', /^[0-9a-f]{64}$/.test(hash1));
}

// ── Quiz/Exam grading logic ────────────────────────────────────────

function testGradingLogic() {
  _assertEqual('mc: correct answer grades true',
    _gradeAnswer_('mc', { selected: 'B' }, JSON.stringify({ correct: 'B' })),
    { isCorrect: true });

  _assertEqual('mc: wrong answer grades false',
    _gradeAnswer_('mc', { selected: 'A' }, JSON.stringify({ correct: 'B' })),
    { isCorrect: false });

  _assertEqual('mr: matching sets in different order grades true',
    _gradeAnswer_('mr', { selected: ['C', 'A'] }, JSON.stringify({ correct: ['A', 'C'] })),
    { isCorrect: true });

  _assertEqual('mr: missing one selection grades false',
    _gradeAnswer_('mr', { selected: ['A'] }, JSON.stringify({ correct: ['A', 'C'] })),
    { isCorrect: false });

  _assertEqual('tf: true/true grades true',
    _gradeAnswer_('tf', { selected: true }, JSON.stringify({ correct: true })),
    { isCorrect: true });

  _assertEqual('fillblank: case-insensitive match grades true',
    _gradeAnswer_('fillblank', { text: 'Jakarta' }, JSON.stringify({ acceptable: ['jakarta'] })),
    { isCorrect: true });

  _assertEqual('fillblank: extra whitespace still matches',
    _gradeAnswer_('fillblank', { text: '  jakarta  ' }, JSON.stringify({ acceptable: ['Jakarta'] })),
    { isCorrect: true });

  _assertEqual('matching: identical pairs grades true',
    _gradeAnswer_('matching', { pairs: { '1': 'A', '2': 'B' } }, JSON.stringify({ pairs: { '1': 'A', '2': 'B' } })),
    { isCorrect: true });

  _assertEqual('essay: always returns null (pending manual grading)',
    _gradeAnswer_('essay', { text: 'anything' }, ''),
    { isCorrect: null });
}

// ── Input sanitization ──────────────────────────────────────────────

function testSanitization() {
  _assertEqual('sanitizePlainText strips script tags',
    sanitizePlainText('<script>alert(1)</script>Hello'), 'alert(1)Hello');

  _assertEqual('sanitizePlainText trims whitespace',
    sanitizePlainText('   padded text   '), 'padded text');

  _assertEqual('escapeHtml escapes angle brackets',
    escapeHtml('<b>bold</b>'), '&lt;b&gt;bold&lt;/b&gt;');
}

function testEmailValidation() {
  _assert('valid email passes', isValidEmail('student@example.com'));
  _assert('missing @ fails', !isValidEmail('studentexample.com'));
  _assert('empty string fails', !isValidEmail(''));
}

function testUsernameValidation() {
  _assert('alphanumeric username passes', isValidUsername('budi_santoso1'));
  _assert('too short fails', !isValidUsername('ab'));
  _assert('spaces fail', !isValidUsername('budi santoso'));
}

// ── Optional: live database round-trip test ────────────────────────
// NOT included in runAllTests() since it writes a real row. Run
// manually, then check the 'TEST-' prefixed row was created and
// clean it up from the Settings sheet afterward if desired.

function testDatabaseRoundTrip_manualOnly() {
  var testKey = 'TEST-roundtrip-' + Date.now();
  insertRow('Settings', { SettingKey: testKey, SettingValue: 'hello', Description: 'test', UpdatedAt: nowIso(), UpdatedBy: 'test' });

  var fetched = getRowById('Settings', 'SettingKey', testKey);
  Logger.log('Round-trip fetched: ' + JSON.stringify(fetched));

  var updated = updateRow('Settings', 'SettingKey', testKey, { SettingValue: 'updated' });
  Logger.log('Round-trip updated: ' + JSON.stringify(updated));

  var deleted = deleteRow('Settings', 'SettingKey', testKey);
  Logger.log('Round-trip deleted: ' + deleted);
}

/**
 * Run this manually (select from the function dropdown, click Run, then
 * check the Execution log) whenever the Translator stops working. It
 * directly calls each provider with full diagnostic logging — no
 * session/login needed since it bypasses translateText()'s wrapper and
 * calls the internal provider functions straight, run as you (the
 * script owner), exactly like the real app would at runtime.
 */
function testTranslationProviders_manualOnly() {
  Logger.log('═══ Testing LibreTranslate mirrors (' + (CONFIG.LIBRETRANSLATE_URLS || []).length + ' configured) ═══');
  var libreResult = _translateViaLibreTranslate_('Hello, how are you?', 'en', 'id');
  Logger.log(libreResult ? ('✓ LibreTranslate SUCCESS: "' + libreResult + '"') : '✗ LibreTranslate: all mirrors failed (see HTTP/error details logged above)');

  Logger.log('═══ Testing MyMemory ═══');
  Logger.log('MYMEMORY_EMAIL is ' + (CONFIG.MYMEMORY_EMAIL ? 'set (using dedicated 50,000/day quota)' : 'NOT set (sharing a 5,000/day quota across all Apps Script users on Google\'s IP range — consider setting it in Config.gs)'));
  var memoryResult = _translateViaMyMemory_('Hello, how are you?', 'en', 'id');
  Logger.log(memoryResult ? ('✓ MyMemory SUCCESS: "' + memoryResult + '"') : '✗ MyMemory: failed (see details logged above)');

  Logger.log('═══ Result ═══');
  if (!libreResult && !memoryResult) {
    Logger.log('Both providers failed. Check CONFIG.LIBRETRANSLATE_URLS are still valid public mirrors, and consider setting CONFIG.MYMEMORY_EMAIL.');
  } else {
    Logger.log('At least one provider works — the Translator feature should function in the app.');
  }
}
