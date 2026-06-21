/**
 * Code.gs
 * English Academy Indonesia — Web App Entry Point
 *
 * doGet is the only thing Google calls directly when someone opens the
 * Web App URL. It serves a thin HTML shell per page; everything dynamic
 * happens client-side afterwards via google.script.run (see Architecture §4).
 */

var DEFAULT_PAGE = 'landing';

// Pages that don't require a logged-in session to view.
// (Certificate verification is public on purpose — anyone with a QR code
// should be able to confirm a certificate is real without logging in.)
var PUBLIC_PAGES = ['landing', 'login', 'verify-certificate'];

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : DEFAULT_PAGE;
  page = _sanitizePageName(page);

  var template = HtmlService.createTemplateFromFile('frontend/views/' + page);
  template.pageParams = (e && e.parameter) ? e.parameter : {};

  return template.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * doPost is not used by this application in v1 — all writes go through
 * google.script.run, not form posts. Reserved here so a stray POST
 * request gets a clean response instead of a generic platform error.
 */
function doPost(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ error: 'POST is not supported. Use the web app UI.' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Prevents path traversal / arbitrary file inclusion via the ?page=
 * query parameter — only simple page names (letters, numbers, hyphens)
 * are allowed, and the result must match one of the actual view files.
 */
function _sanitizePageName(page) {
  var safe = String(page).replace(/[^a-zA-Z0-9-]/g, '');
  return safe || DEFAULT_PAGE;
}

/**
 * Used inside HTML templates as <?!= include('partials/navbar'); ?>
 * to assemble shared header/footer/navbar into every page without
 * duplicating markup across 15+ view files.
 */
function include(filename) {
  return HtmlService.createTemplateFromFile('frontend/' + filename).evaluate().getContent();
}
