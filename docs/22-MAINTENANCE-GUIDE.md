# Maintenance Guide
## English Academy Indonesia — Phase 22 (Final Phase)

| Field | Value |
|---|---|
| Document | Phase 22 — Maintenance Guide |
| Status | Final phase — project complete after this document |

---

## 1. What runs automatically (nothing to do)

- **Session expiry** — `CacheService` entries expire on their own (max 6 hours).
- **Translation cache** — expires and rebuilds automatically (`CONFIG.CACHE_TTL_TRANSLATION`).
- **`ActivityLogs` pruning** — `dailyCleanup()` (Utils.gs) runs every night at ~2 AM once `createDailyCleanupTrigger()` has been run once (Deployment Guide Step 20), removing rows older than `CONFIG.ACTIVITY_LOG_RETENTION_DAYS` (default 90 days).

## 2. Monthly checks (5 minutes)

- [ ] Open the Apps Script editor → **Executions** → skim for repeated failures (a steadily failing trigger is easy to miss otherwise).
- [ ] Run `testTranslationProviders_manualOnly` (Tests.gs) — confirms `CONFIG.LIBRETRANSLATE_URLS` mirrors still resolve. Public mirrors occasionally rotate; if translations have been silently falling back to MyMemory for a while (or failing entirely), update the array.
- [ ] Check Google Drive storage usage (`drive.google.com` → Storage) — while Drive's free tier is generous, video uploads accumulate over time.

## 3. Each new academic year

1. **Archive the previous year's classes** rather than deleting them: `archiveClass(token, classId)` for each — keeps historical Scores/Attendance intact for records, while removing them from active teacher/admin lists.
2. **Create new `Classes` rows** for the new academic year (`createClass`).
3. **Re-enroll or create new student accounts** as needed (Users.gs / Students.gs).
4. **Update `CONFIG.ACTIVITY_LOG_RETENTION_DAYS`** if your school wants a longer audit trail across years (default 90 days may be too short for annual reporting — consider raising to 365).
5. Update the `Settings` sheet's `active_academic_year` key if you choose to use it for any year-aware UI you build later (not currently read anywhere in v1 — reserved for future use per Database Design §3.19).

## 4. Scaling beyond the documented ceiling

If your school's usage approaches the limits documented in PRD §9 (high concurrent usage, sheets growing into the hundreds of thousands of rows):

- **Archive aggressively**: move old `Answers`/`Submissions`/`ActivityLogs` rows to a separate "archive" spreadsheet (a second `SpreadsheetApp.openById()` target) rather than deleting them, keeping the live sheets small and fast.
- **Split by cohort**: consider a separate spreadsheet per academic year or per grade level (`X`/`XI`/`XII`) if a single school's data genuinely outgrows comfortable single-sheet performance — `Database.gs`'s `db_getSpreadsheet_()` is the one place this would need to become configurable per-sheet rather than a single global ID.
- **Revisit the architecture entirely** if you outgrow the free-tier ceiling for good — at that point, this project has done its job (a free, zero-infrastructure starting point) and a paid backend becomes the honest next step, not a patch on top of Sheets.

## 5. Adding new curriculum content

- New modules: insert directly into the `Modules` sheet (or extend `Setup.gs::seedCurriculum_` and re-run — it skips re-seeding if rows already exist, so add new entries to the `CURRICULUM_X/XI/XII` arrays and call `seedCurriculum_` manually if you want it automated for a fresh deployment).
- New question types beyond the 6 supported (`mc`, `mr`, `tf`, `matching`, `fillblank`, `essay`): would require extending `QUESTION_TYPES` in `Quiz.gs` and adding a new case to `_gradeAnswer_` — budget for updating `Tests.gs` grading tests alongside any such change.

## 6. Updating the codebase safely

1. Make changes in the Apps Script editor.
2. Run `runAllTests()` (Phase 18) before deploying — catches regressions in grading logic, validation, and hashing.
3. Deploy a **new version** (Deployment Guide Step 9/12 pattern) rather than overwriting — Apps Script keeps prior versions accessible via Manage Deployments if you ever need to roll back.
4. Manually re-upload the changed file(s) to GitHub (Phase 20 §5) if you're using it for backup.

## 7. Backup strategy

- **Primary backup**: Google Sheets and Drive are themselves backed by Google's infrastructure — no separate backup mechanism is required for data durability.
- **Code backup**: GitHub (Phase 20), updated manually whenever you make a meaningful change.
- **Point-in-time recovery**: Google Sheets has built-in version history (File → Version history) going back automatically — useful if a bad bulk edit corrupts data, independent of anything this project adds.

---

## Project complete

This closes all 22 phases. The system is a complete, production-usable English learning platform for Indonesian SMA students, built entirely on free Google services, deployable by a non-technical teacher or admin in under an hour, with every documented design tradeoff written down rather than hidden — including the ones that were fixed along the way (Phase 17's session-revocation gap) and the ones that remain as honest, permanent constraints of choosing a zero-cost architecture (PRD §9).
