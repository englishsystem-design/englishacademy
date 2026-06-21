# Testing
## English Academy Indonesia — Phase 18

| Field | Value |
|---|---|
| Document | Phase 18 — Testing |
| Depends on | backend/Tests.gs |
| Status | Draft — proceeding directly to Phase 19 |

---

## 1. Automated backend tests

`backend/Tests.gs` (Phase 17) contains a self-contained test suite — no npm, no terminal, runs entirely from the Apps Script editor's Run button.

**To run:**
1. Open the Apps Script editor.
2. Select `runAllTests` from the function dropdown.
3. Click Run.
4. Open **Execution log** (View → Logs).
5. Look for `TEST RESULTS: X passed, Y failed`. Every line is prefixed `✓ PASS` or `✗ FAIL` with a description.

These tests cover pure logic only (password hashing, quiz/exam auto-grading for all 6 question types, input sanitization, validation) — deliberately not touching live Sheets data, so they're safe to re-run anytime, including in production, without side effects.

`testDatabaseRoundTrip_manualOnly` is excluded from `runAllTests` because it writes a real row to the `Settings` sheet. Run it by name only when you want to verify `Database.gs`'s insert/update/delete cycle end-to-end, and check the `TEST-` prefixed row afterward.

---

## 2. Manual QA checklist

Apps Script's sandboxed, multi-page web app architecture (Architecture §1) doesn't lend itself to headless browser automation (Selenium/Playwright) without Node.js and a real test runner — which the project's beginner deployment constraints explicitly exclude. The manual checklist below is the practical alternative, organized to match the original 20-step deployment plan's "Test X" steps (Phase 19).

### 2.1 Authentication
- [ ] Log in with a valid admin/teacher/student account — redirects to the correct dashboard
- [ ] Log in with a wrong password — generic "Invalid username or password" shown, doesn't reveal which field was wrong
- [ ] Log in with a disabled account — rejected with "account disabled" message
- [ ] Disable an account that's currently logged in elsewhere — confirm their very next action is rejected (Security §2.1)
- [ ] Log out — confirm redirected to login and `sessionStorage` is cleared

### 2.2 Role boundaries
- [ ] As a student, manually navigate to `?page=admin-users` — confirm `eaRequireLogin` redirects away
- [ ] As a teacher, attempt to call an admin-only function from the browser console (e.g. `google.script.run.deleteUserAccount(...)`) — confirm it's rejected server-side, not just hidden in the UI

### 2.3 Content management
- [ ] Create a lesson, add rich-text content via Quill, save, reload — content persists
- [ ] Upload a PDF to a lesson — confirm it appears for a student via the PDF.js viewer
- [ ] Attach a YouTube video and a Drive-uploaded video — both play correctly
- [ ] Publish a module — confirm it becomes visible to students (was hidden while `draft`)

### 2.4 Quiz
- [ ] Create a quiz with at least one of each question type (mc, mr, tf, matching, fillblank, essay)
- [ ] Take the quiz as a student — auto-graded types score correctly, essay shows "pending manual grading"
- [ ] Exhaust `MaxAttempts` — confirm further attempts are blocked with a clear message
- [ ] Check the leaderboard reflects the best attempt per student, sorted correctly

### 2.5 Exam
- [ ] Start an exam, let the countdown reach zero without clicking submit — confirm auto-submit fires
- [ ] Start an exam, switch browser tabs — confirm a warning is logged (check `getExamReport`'s `cheatWarningCount`)
- [ ] Attempt to start the same exam twice as the same student — second attempt is blocked ("exams may only be taken once")
- [ ] Refresh mid-exam — confirm auto-saved progress is recovered on submit

### 2.6 OCR
- [ ] Upload a clear photo of printed English text — extracted text is reasonably accurate
- [ ] Confirm no network calls are made to the Apps Script backend during recognition (check browser DevTools Network tab) — OCR must stay 100% client-side

### 2.7 Translator
- [ ] Translate EN→ID and ID→EN — both directions work
- [ ] Translate the same phrase twice — second call is noticeably faster and reports `source: "cache"`
- [ ] Temporarily break `CONFIG.LIBRETRANSLATE_URLS` (clear the array) — confirm the MyMemory fallback still returns a result
- [ ] Run `testTranslationProviders_manualOnly` (Tests.gs) — confirms which provider(s) currently work, with diagnostic detail in the Execution log

### 2.8 Vocabulary
- [ ] Look up a word — definition, synonyms, antonyms display
- [ ] Save to favorites, reload the page — favorite persists
- [ ] Try saving the same word twice — rejected with "already in favorites"

### 2.9 Assignments
- [ ] Submit an assignment as a student — status shows "submitted" (or "late" if past due date)
- [ ] Grade it as a teacher — student sees the score and feedback
- [ ] Resubmit before grading — old file is replaced, not duplicated
- [ ] Attempt to resubmit after grading — blocked

### 2.10 Certificates
- [ ] Issue a certificate as a teacher — PDF generates with the student's name, module, and a scannable QR code
- [ ] Scan the QR (or open the verification URL manually) while logged out — confirms validity without requiring login
- [ ] Revoke a certificate — verification page now shows it as invalid

### 2.11 Attendance
- [ ] Mark a full class's attendance via the bulk roster — all rows save in one action
- [ ] Re-open the same class/date — previously marked statuses are pre-selected, not reset

### 2.12 Notifications
- [ ] Trigger a notification-worthy event (new assignment, graded submission) — recipient sees the unread badge increment
- [ ] Open the notification panel — badge clears

### 2.13 Cross-cutting
- [ ] Test on a real Android phone in Chrome — layout is usable, no horizontal scrolling
- [ ] Test with browser DevTools set to "Slow 3G" — loading states (`ea-loading` spinners) show instead of a blank page
- [ ] Run `runAllTests()` (§1) one final time before declaring a deployment ready

---

## 3. What's next

Phase 19 turns the setup work from Phases 4–18 into the complete, beginner-facing, click-by-click deployment guide.
