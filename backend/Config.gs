/**
 * Config.gs
 * English Academy Indonesia — Central Configuration
 *
 * EDIT THE TWO VALUES BELOW before deploying. Everything else can be
 * left as-is for a standard deployment.
 */

var CONFIG = {
  // ── REQUIRED: paste your own values here ──────────────────────────
  // Get this from Phase 4, Step 6 (printSpreadsheetId), or from the
  // spreadsheet's URL between /d/ and /edit.
  SPREADSHEET_ID: '1T1OPlBvNdjebxhMSy0-yyaKxDbD9ufcaVVIXzx-2r8o',

  // After your FIRST deployment (Phase 19), Apps Script gives you a URL
  // ending in /exec. Paste it here and redeploy ("New version") so the
  // frontend can build links between pages. Leave the placeholder for
  // your very first test deployment — it's only needed for in-app
  // navigation between pages, not for the deployment itself to work.
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzPRAzAeNQbWUy9yMkNLjLvEPzRnCOtIUCMkKLIwzsQGwRGeTEu3gynWxk5d6uq1qP0Ag/exec',

  // Google Drive folder where uploaded PDFs/images/videos/certificates
  // are stored. Create a folder in Drive, open it, copy the ID from
  // the URL (after /folders/), and paste it here.
  DRIVE_FOLDER_ID: '1ypPKhUubj83JAkGwWIsSzo5nhs_lMvTP',

  // ── App-wide constants — safe defaults, change if you want ────────
  APP_NAME: 'English Academy Indonesia',

  // How long a session stays valid without activity, in seconds.
  // CacheService hard-caps entries at 6 hours (21600s) regardless of
  // this value, per Apps Script consumer-account limits.
  SESSION_DURATION_SECONDS: 21600,

  // CacheService TTLs, in seconds (see Architecture §7)
  CACHE_TTL_TRANSLATION: 21600,   // 6 hours
  CACHE_TTL_DASHBOARD_STATS: 300, // 5 minutes
  CACHE_TTL_COURSE_CATALOG: 1800, // 30 minutes

  // Quiz/Exam defaults
  DEFAULT_MAX_QUIZ_ATTEMPTS: 3,
  DEFAULT_PASSING_SCORE_PERCENT: 70,

  // Activity log retention, in days — older rows are pruned by the
  // scheduled cleanup trigger in Utils.gs
  ACTIVITY_LOG_RETENTION_DAYS: 90,

  // ── External free API endpoints ────────────────────────────────────
  // MyMemory is tried FIRST — it's a single, stable, long-standing fixed
  // endpoint (no rotation/availability risk). Set MYMEMORY_EMAIL below
  // for a much larger quota; even without it, MyMemory is the more
  // dependable default than community LibreTranslate mirrors.
  MYMEMORY_URL: 'https://api.mymemory.translated.net/get',
  MYMEMORY_EMAIL: '', // optional but recommended — e.g. 'admin@yourschool.sch.id'

  // LibreTranslate is the secondary/enrichment provider, tried only if
  // MyMemory fails. IMPORTANT: libretranslate.com's official hosted
  // endpoint now requires a PAID API key for all requests (confirmed —
  // this changed after this project was first written) and is
  // deliberately excluded below. These are free public community
  // mirrors instead — they have no uptime guarantee and do rotate, so
  // several are listed and tried in order. If ALL of them ever go down,
  // the app still works fine on MyMemory alone. Run
  // testTranslationProviders_manualOnly (Tests.gs) any time to check
  // current status of every entry here.
  LIBRETRANSLATE_URLS: [
    'https://translate.argosopentech.com/translate',
    'https://translate.astian.org/translate',
    'https://libretranslate.de/translate'
  ],
};

/**
 * Quick sanity check you can run manually from the Apps Script editor
 * to confirm Config.gs is wired up correctly before moving on.
 */
function testConfig() {
  if (CONFIG.SPREADSHEET_ID === 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    Logger.log('CONFIG.SPREADSHEET_ID has not been set yet — edit Config.gs.');
    return;
  }
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Logger.log('Connected successfully to spreadsheet: ' + ss.getName());
}
