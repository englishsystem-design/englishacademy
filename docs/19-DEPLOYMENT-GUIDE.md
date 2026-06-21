# Deployment Guide
## English Academy Indonesia — Phase 19

| Field | Value |
|---|---|
| Document | Phase 19 — Deployment Guide |
| Audience | Complete beginner — assumes you have never built or deployed a web app before |
| Total time | About 45–60 minutes the first time |
| Requirements | A Google account. Nothing else — no terminal, no npm, no Node.js, no Docker, no credit card |

This guide assumes zero prior experience. Every step tells you exactly what to click, exactly what to type, and exactly what you should see afterward. If something doesn't match, jump to the **Common Errors** table at the end of that step.

---

## STEP 1 — Create a Google Account

**Goal:** Have a Google account to own the spreadsheet, the script, and the deployed app.

**Exact clicks:** If you already use Gmail/Google Drive, skip to Step 2. Otherwise go to `accounts.google.com/signup` and follow the on-screen form.

**What you should see:** After signup, you land on `myaccount.google.com` with your name in the top-right corner.

**Expected result:** You can open `drive.google.com` and see an empty (or existing) Google Drive.

**Common errors:**
| Error | Fix |
|---|---|
| "This username is taken" | Try a different username — it doesn't affect anything else in this guide |

---

## STEP 2 — Create the Google Spreadsheet

**Goal:** Create the spreadsheet that will store your entire database.

**Exact clicks:**
1. Go to `sheets.google.com`.
2. Click the blank **+** tile.
3. Click "Untitled spreadsheet" top-left, rename to `English Academy Indonesia DB`.

**What you should see:** An empty spreadsheet with one tab, "Sheet1".

**Expected result:** The spreadsheet is saved automatically (Google Sheets auto-saves — there's no Save button to click).

**Common errors:**
| Error | Fix |
|---|---|
| Page stuck loading | Refresh the browser tab |

---

## STEP 3 — Create All Database Sheets

**Goal:** Build all 21 data tabs with correct headers, and seed the curriculum.

**This step is fully covered in `docs/04-GOOGLE-SHEETS-SETUP.md`** — follow it now: Extensions → Apps Script, paste `backend/Setup.gs`, run `createDatabaseStructure`, approve permissions, verify 21 tabs appear (the 20 from Database Design plus `VocabularyFavorites` from the addendum).

**Expected result:** 21 tabs exist, `Modules` has 43 rows, `Roles` has 3 rows.

**Don't close this Apps Script editor tab** — you'll keep using it for the remaining steps.

---

## STEP 4 — Add the Rest of the Backend Files

**Goal:** Get all 21 `.gs` files into the same Apps Script project as `Setup.gs`.

**Exact clicks:** For each remaining file in `backend/` (`Database.gs`, `Config.gs`, `Auth.gs`, `Code.gs`, `Utils.gs`, `Users.gs`, `Students.gs`, `Teachers.gs`, `Classes.gs`, `Lessons.gs`, `Quiz.gs`, `Exam.gs`, `Assignments.gs`, `Notification.gs`, `Attendance.gs`, `Certificate.gs`, `Translator.gs`, `Vocabulary.gs`, `Dashboard.gs`, `Tests.gs`):
1. In the Apps Script editor, click the **+** next to "Files" in the left sidebar.
2. Choose **Script**.
3. Type the file name **exactly** (without `.gs` — Apps Script adds that automatically), e.g. `Database`.
4. Paste the full contents of that file from this project.
5. Repeat for all 20 remaining files.

**What you should see:** The left sidebar lists 21 files total (including `Setup`).

**Expected result:** No red underlines/syntax errors in any file. A small warning about unused variables is harmless.

**Common errors:**
| Error | Fix |
|---|---|
| "Identifier has already been declared" | You pasted a file twice, or pasted one file's content into another file. Delete the duplicate file (three-dot menu → Delete) and re-paste correctly |
| File doesn't appear in sidebar | Make sure you clicked the **Script** option, not **HTML**, when creating it |

---

## STEP 5 — Add the Frontend Files

**Goal:** Add all 21 HTML files (3 partials + 18 views — see Folder Structure §1 for why these are flat in Apps Script despite having `/` in their names).

**Exact clicks:** For each file in `frontend/partials/` and `frontend/views/`:
1. Click **+** next to "Files" → choose **HTML**.
2. Name it with its folder prefix, e.g. `partials/head`, `partials/navbar`, `partials/footer`, `views/landing`, `views/login`, `views/dashboard-student`, and so on for all 18 view files.
3. Paste the matching file's content.

**What you should see:** The sidebar now groups files visually under "partials" and "views" headings (cosmetic only, per Folder Structure §1).

**Expected result:** 21 HTML files + 21 script files = 42 files total in the project.

**Common errors:**
| Error | Fix |
|---|---|
| `include('partials/head')` fails at runtime later | The HTML file name must be exactly `partials/head`, not `partials/Head` or `Partials/head` — names are case-sensitive |

---

## STEP 6 — Configure the Spreadsheet ID

**Goal:** Point `Config.gs` at your actual spreadsheet.

**Exact clicks:**
1. Get your Spreadsheet ID (Phase 4, Step 6, or from the spreadsheet's URL between `/d/` and `/edit`).
2. Open `Config.gs` in the Apps Script editor.
3. Replace `'PASTE_YOUR_SPREADSHEET_ID_HERE'` with your real ID, keeping the quotes.
4. Save (Ctrl+S / Cmd+S).

**What you should see:** `SPREADSHEET_ID: 'your-actual-id-here',`

**Expected result:** Run `testConfig` from the function dropdown — Execution log shows "Connected successfully to spreadsheet: English Academy Indonesia DB".

**Common errors:**
| Error | Fix |
|---|---|
| "Exception: Invalid argument" on `testConfig` | The ID was copied with extra spaces or missing characters — recopy from the URL |

---

## STEP 7 — Configure the Google Drive Folder

**Goal:** Give the app a dedicated Drive folder for PDFs, videos, certificates, and submissions.

**Exact clicks:**
1. Go to `drive.google.com`.
2. Click **+ New** → **New folder**. Name it `English Academy Indonesia Files`.
3. Open the folder, copy the ID from the URL (after `/folders/`).
4. In `Config.gs`, replace `'PASTE_YOUR_DRIVE_FOLDER_ID_HERE'` with this ID.
5. Save.

**What you should see:** `DRIVE_FOLDER_ID: 'your-actual-folder-id',`

**Expected result:** No errors when saving.

**Common errors:**
| Error | Fix |
|---|---|
| Files later fail to upload with "permission" errors | Confirm the folder belongs to the same Google account that owns the Apps Script project |

---

## STEP 8 — Save the Project

**Goal:** Make sure everything is saved before deploying.

**Exact clicks:** Click the project name top-left (default "Untitled project"), rename to `English Academy Indonesia`. Press Ctrl+S / Cmd+S once more for good measure.

**What you should see:** The browser tab title updates to match.

**Expected result:** No unsaved-changes indicator remains.

---

## STEP 9 — Deploy as a Web App

**Goal:** Get a public URL for the application.

**Exact clicks:**
1. Click **Deploy** (top-right) → **New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Description: `v1`.
4. **Execute as:** "Me".
5. **Who has access:** "Anyone" (so students without a Workspace account in your domain can use it — see Architecture §9 for why custom auth was chosen over Workspace-only access).
6. Click **Deploy**.

**What you should see:** A dialog showing a **Web app URL** ending in `/exec`.

**Expected result:** Copy this URL — you'll need it in Step 10.

**Common errors:**
| Error | Fix |
|---|---|
| "Authorization required" | Continue to Step 10 first — this is expected before permissions are granted |
| No "Web app" option in the type list | Make sure `doGet` exists in `Code.gs` exactly as provided — Apps Script only offers "Web app" deployment when a `doGet` function is present |

---

## STEP 10 — Grant Permissions

**Goal:** Authorize the script to access Sheets, Drive, and external URLs (for translation/QR).

**Exact clicks:**
1. When prompted, click **Authorize access**.
2. Choose your Google account.
3. You'll see "Google hasn't verified this app" — click **Advanced**.
4. Click **Go to English Academy Indonesia (unsafe)**.
5. Review the permissions list, click **Allow**.

**What you should see:** Redirected back to the deployment dialog with no further prompts.

**Expected result:** The `/exec` URL now loads without an authorization error.

**Common errors:**
| Error | Fix |
|---|---|
| "This app is blocked" (not just unverified) | Your Google Workspace admin (if using a school-managed account) may restrict Apps Script. Use a personal Gmail account instead, per PRD §11 risk notes |

---

## STEP 11 — Open the Web App URL

**Goal:** Confirm the deployed app actually loads.

**Exact clicks:** Paste the `/exec` URL from Step 9 into a new browser tab.

**What you should see:** The landing page (hero section, "Masuk" button top-right).

**Expected result:** No blank white screen, no error stack trace.

**Common errors:**
| Error | Fix |
|---|---|
| Blank white page | Open browser DevTools (F12) → Console tab, look for the first red error. Usually a typo'd `include()` filename from Step 5 |
| "Sorry, unable to open the file at this time" | Wait 30 seconds and reload — new deployments sometimes take a moment to propagate |

---

## STEP 12 — Set the Web App URL in Config, Then Redeploy

**Goal:** Let the app build its own internal navigation links (Architecture §11).

**Exact clicks:**
1. Copy the `/exec` URL from Step 9.
2. In `Config.gs`, replace `'PASTE_YOUR_WEB_APP_URL_HERE'` with it.
3. Save.
4. **Deploy → Manage deployments** → click the pencil/edit icon on your `v1` deployment → **Version: New version** → **Deploy**.

**What you should see:** The same `/exec` URL (it doesn't change) but now running your latest code.

**Expected result:** Clicking "Masuk" on the landing page now navigates correctly instead of going to a blank `?page=login` with no styling.

---

## STEP 13 — Create the Admin User

**Goal:** Get your first login.

**Exact clicks:** Since there's no admin yet to use the Admin UI, create the first one directly via the Apps Script editor:
1. In the editor, temporarily run this from a scratch function (select **Code.gs**, and in the function dropdown choose any function, or add a one-off function): paste and run once:
   ```javascript
   function _createFirstAdmin() {
     _createUserRecord('admin', 'ChangeThisPassword123', 'admin', 'Admin Utama', 'admin@example.com', '');
   }
   ```
2. Select `_createFirstAdmin` from the function dropdown, click Run.
3. **Delete this function afterward** — it's a one-time bootstrap, not something that should remain in production code.

**What you should see:** No errors in the Execution log.

**Expected result:** A row appears in the `Users` sheet with `Role = admin`.

**Common errors:**
| Error | Fix |
|---|---|
| "USERNAME_TAKEN" | You already created this admin — skip to Step 15 |

---

## STEP 14 — Create a Teacher and a Student User

**Goal:** Have one of each role to test with.

**Exact clicks:** Log in as admin (Step 15 first), go to **Manajemen Pengguna** (`admin-users` page), click **Tambah Pengguna**, fill the form, choose role "Guru", submit, then complete the teacher profile (Subject: English). Repeat with role "Siswa", choosing Kelas X/XI/XII.

**What you should see:** Both new accounts appear in the users table.

**Expected result:** You can log out and log back in as either.

---

## STEP 15 — Test Login

**Goal:** Confirm authentication works end-to-end.

**Exact clicks:** Open the `/exec` URL, click "Masuk", enter the admin username/password from Step 13.

**What you should see:** Redirected to `dashboard-admin` showing stat cards (all zeros except classes/lessons you've added).

**Expected result:** Refreshing the page keeps you logged in (session persists via `sessionStorage`).

**Common errors:**
| Error | Fix |
|---|---|
| "Invalid username or password" | Double-check for typos; passwords are case-sensitive |
| Stuck on loading spinner forever | Open DevTools Console — likely `CONFIG.SPREADSHEET_ID` is still the placeholder (Step 6) |

---

## STEP 16 — Test OCR

**Goal:** Confirm Tesseract.js works without any backend dependency.

**Exact clicks:** Log in as the student account, go to **OCR**, upload a clear photo of printed English text, click "Mulai OCR".

**What you should see:** A progress bar, then extracted text in the textarea.

**Expected result:** Text is reasonably accurate for a clear, well-lit photo.

**Common errors:**
| Error | Fix |
|---|---|
| OCR never finishes | Large images take longer — wait, or use a smaller/cropped photo |
| Garbled text | Use a clearer photo with good lighting and minimal skew |

---

## STEP 17 — Test the Translator

**Goal:** Confirm both translation providers work.

**Exact clicks:** Go to **Translator**, type "Hello, how are you?", click "Terjemahkan".

**What you should see:** Indonesian translation appears, with a small note showing which provider was used.

**Expected result:** Translating the exact same phrase again is noticeably instant ("Hasil dari cache").

**Common errors:**
| Error | Fix |
|---|---|
| "Translation service is currently unavailable" | Run `testTranslationProviders_manualOnly` (Tests.gs) and check the Execution log — it tells you exactly which mirror/provider failed and why. As of this writing `libretranslate.com` requires a paid key and is deliberately NOT in the default `CONFIG.LIBRETRANSLATE_URLS` list; if both configured mirrors and MyMemory fail, see Troubleshooting → Translation Error |

---

## STEP 18 — Test a Quiz

**Goal:** Confirm the full quiz authoring → taking → grading loop.

**Exact clicks:** As the teacher, go to **Materi** → open a module → "+ Tambah Materi" not needed for this test; instead use the Apps Script editor to quickly create one quiz with one `mc` question via `createQuiz`/`addQuestion` (or build the quiz-authoring UI yourself as a future enhancement — v1 ships the taking/grading experience with question creation available via direct function calls during initial content setup). As the student, navigate to `?page=quiz&quizId=YOUR_QUIZ_ID`, answer, submit.

**What you should see:** Immediate score percentage and pass/fail message.

**Expected result:** The score appears on the student dashboard's quiz chart and the quiz's leaderboard.

---

## STEP 19 — Test an Exam

**Goal:** Confirm the timer, auto-submit, and anti-cheat logging work.

**Exact clicks:** Create a short exam (e.g. `DurationMinutes: 1`) with a start/end window covering now. As the student, navigate to `?page=exam&examId=YOUR_EXAM_ID`, let the timer run out without submitting.

**What you should see:** "Waktu habis — ujian dikumpulkan otomatis" toast, then the result screen.

**Expected result:** As the teacher, `?page=exam-result&examId=...` shows this attempt in the report.

---

## STEP 20 — Launch the Production System

**Goal:** Go live for real students.

**Exact clicks:**
1. Re-check `docs/17-SECURITY.md` §9's pre-launch checklist.
2. Create real Class/Teacher/Student accounts (Step 14, repeated for your actual roster).
3. Share the `/exec` URL with your school (e.g. via the school's existing communication channel).
4. Run `createDailyCleanupTrigger()` once (Utils.gs) if you haven't already.

**Expected result:** Students can log in and begin learning. Welcome to production.

---

## 30-Minute Quick Start (condensed)

For someone who's already read the full guide once and just needs the checklist:

1. Create Spreadsheet → Extensions → Apps Script (2 min)
2. Paste `Setup.gs`, run `createDatabaseStructure` (3 min)
3. Paste remaining 19 `.gs` files + 21 `.html` files (10 min)
4. Fill in `Config.gs` (Spreadsheet ID, Drive folder ID) (3 min)
5. Deploy → Web app → Anyone → Deploy → Authorize (3 min)
6. Paste Web App URL back into `Config.gs`, redeploy as new version (2 min)
7. Run `_createFirstAdmin()` once, then delete it (2 min)
8. Log in, create a teacher + student, test login/OCR/translator (5 min)

---

## What's next

Phase 20 explains how to back up this same project to a GitHub repository by hand (no Git CLI, no GitHub Actions) for version history and disaster recovery.
