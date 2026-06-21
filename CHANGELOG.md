# Changelog

All notable changes to English Academy Indonesia are documented here.

## [1.0.0] — Initial Release

### Added
- Full backend: 20 Apps Script files covering auth, RBAC, users/students/teachers/classes, lessons, quizzes, exams, assignments, attendance, certificates, notifications, translation, vocabulary, dashboards, and a generic Sheets data-access layer
- Full frontend: 21 HTML pages (landing, login, 3 role-based dashboards, lesson browsing/authoring, quiz/exam taking and reporting, assignments, OCR, translator, vocabulary builder, speaking/listening practice, certificates, public certificate verification, attendance, admin user management) plus shared head/navbar/footer partials
- Complete Kurikulum Merdeka curriculum seed: 43 modules across Kelas X/XI/XII
- 21-sheet Google Sheets database schema with a one-click setup script
- Self-contained Apps Script test suite (no npm required)
- Full documentation set: PRD, Architecture, Database Design, Setup Guide, Folder Structure, Security review, Testing guide, 20-step Deployment Guide, GitHub backup guide, Troubleshooting reference, Maintenance guide

### Fixed (during initial build, documented for transparency)
- Closed a session-revocation gap where disabling a user account didn't immediately invalidate their existing session (Security §2.1)
- Added the `VocabularyFavorites` sheet, missing from the original 20-sheet schema, needed for the Vocabulary Builder's save feature (Database Design §7 addendum)
- **Fixed a critical bug causing every dashboard/page to hang on the loading spinner indefinitely after login.** Apps Script Web Apps render inside a cross-origin iframe; the original code read `window.top.location.search` to get URL query parameters (`?lessonId=...`, `?quizId=...`, etc.), which throws a `SecurityError` when read cross-origin (only *writing* `window.top.location.href` for navigation is permitted cross-origin). Since `partials/navbar.html` — included on every authenticated page — hit this on every load, it silently halted each page's script before the data-fetching `google.script.run` call ever ran. Replaced with `google.script.url.getLocation()`, the official Apps Script client API designed for exactly this, across `partials/navbar.html` and every view that reads a URL parameter (`lesson-detail`, `quiz`, `quiz-result`, `exam`, `exam-result`, `attendance`, `verify-certificate`).
- **Fixed the Translator always failing with "Translation service is currently unavailable."** Root cause confirmed via research: `libretranslate.com`'s hosted API — the default endpoint this project shipped with — now requires a paid API key for all requests (a change made after this project was first written; it previously offered free anonymous access). Replaced with a fallback chain of confirmed free public mirrors (`CONFIG.LIBRETRANSLATE_URLS`). Additionally hardened the MyMemory fallback: it tracks its free quota per IP address, and Apps Script's shared outbound IP range is plausibly already exhausted by unrelated traffic from other scripts — added an optional `CONFIG.MYMEMORY_EMAIL` setting that grants a dedicated 50,000 chars/day quota instead of the shared 5,000/day anonymous pool, plus proper `responseStatus` checking (MyMemory returns HTTP 200 even for quota-exceeded errors, with the real error nested in the response body) and request-size truncation to respect its ~500-byte-per-call limit. Added `testTranslationProviders_manualOnly` (Tests.gs) for fast self-diagnosis of this class of issue in the future.

### Known limitations (by design, not bugs — see PRD §9 and Security §8)
- Architecture targets hundreds–low thousands of registered students with realistic concurrent usage in the tens, not true 10,000+ simultaneous users, due to Google Apps Script's free-tier execution and quota limits
- Exam anti-cheat is detection/logging only (tab-switch warnings), not a lockdown browser
- No native mobile app — responsive web only
