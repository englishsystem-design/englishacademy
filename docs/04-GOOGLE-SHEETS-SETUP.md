# Google Sheets Setup Guide
## English Academy Indonesia — Phase 4

| Field | Value |
|---|---|
| Document | Phase 4 — Google Sheets Setup |
| Depends on | 03-DATABASE-DESIGN.md, backend/Setup.gs |
| Audience | Complete beginner — no prior Google Sheets or Apps Script experience assumed |
| Status | Draft — proceeding directly to Phase 5 |

---

## 1. What you're about to do

You're going to create one Google Spreadsheet that will act as the entire database for the platform, then run one script that automatically builds all 20 data tabs with the correct columns — instead of typing 20 sets of column headers by hand.

This takes about 10 minutes.

---

## 2. Step-by-step

### Step 1 — Create the spreadsheet
1. Go to `sheets.google.com` while signed in to your Google account.
2. Click the blank **+** spreadsheet tile to create a new one.
3. Click **"Untitled spreadsheet"** at the top left and rename it to `English Academy Indonesia DB`.

**You should see:** an empty spreadsheet with one tab called "Sheet1" at the bottom.

### Step 2 — Open the attached Apps Script editor
1. In the menu bar, click **Extensions** → **Apps Script**.
2. A new browser tab opens with the Apps Script editor, already linked to this specific spreadsheet (this link is what makes `SpreadsheetApp.getActiveSpreadsheet()` work later — no manual ID needed for this step).

**You should see:** a code editor with a default file called `Code.gs` containing an empty `myFunction()`.

### Step 3 — Add the setup script
1. Click the file `Code.gs` in the left sidebar, select all existing content, and delete it.
2. Rename the file: click the three-dot menu next to `Code.gs` → **Rename** → type `Setup.gs` → press Enter.
3. Paste in the complete contents of `backend/Setup.gs` (provided alongside this guide).
4. Click the **disk/save icon** (or press Ctrl+S / Cmd+S).

**You should see:** the editor shows the pasted code with no red underlines/errors.

### Step 4 — Run it
1. At the top of the editor, in the function dropdown (next to the Run button), select **createDatabaseStructure**.
2. Click **Run**.
3. The first time, Google shows an authorization prompt: **"This app isn't verified"** — this is expected and normal for a script you wrote yourself. Click **Advanced** → **Go to (your project name) (unsafe)** → **Allow**.
4. Wait a few seconds. A dialog box should appear inside the spreadsheet tab saying **"Setup complete."**

**Common error — "Authorization required":** just means you haven't approved permissions yet. Re-run and complete the consent screen.

**Common error — script runs but nothing happens:** make sure you selected `createDatabaseStructure` (not `seedRoles_` or another helper) in the function dropdown before clicking Run.

### Step 5 — Verify
1. Switch back to the spreadsheet browser tab and refresh it.
2. You should now see **20 tabs** along the bottom: Users, Roles, Students, Teachers, Classes, Modules, Lessons, Videos, Assignments, Submissions, Quizzes, Exams, Questions, Answers, Scores, Attendance, Certificates, Notifications, Settings, ActivityLogs.
3. Open the **Modules** tab — you should see 43 rows already filled in with `ModuleID`, `Tingkat`, `ModuleNumber`, and `ModuleTitle` (Kelas X through XII, matching the curriculum).
4. Open the **Roles** tab — you should see exactly 3 rows: admin, teacher, student.

### Step 6 — Note your Spreadsheet ID
You'll need this in the Backend Development phase to connect the rest of the system to this exact spreadsheet.

1. Back in the Apps Script editor, select **printSpreadsheetId** from the function dropdown and click **Run**.
2. Click **Execution log** (or **View** → **Logs**) at the bottom.
3. Copy the long ID string shown (looks like `1A2b3C4d5E6f...`).
4. Save it somewhere safe — paste it into a notes file. You'll paste it into `Config.gs` in Phase 6.

**Alternative way to find it anytime:** the Spreadsheet ID is also the long string in the spreadsheet's URL, between `/d/` and `/edit`:
`https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_YOUR_ID`**`/edit`

---

## 3. Common errors & fixes (this phase)

| Error | Cause | Fix |
|---|---|---|
| "This app isn't verified" warning | Normal for any new Apps Script project | Click Advanced → proceed anyway — this is your own script |
| Sheets created but headers missing | `createDatabaseStructure` was interrupted (e.g. browser closed mid-run) | Re-run `createDatabaseStructure` — it's safe to run again, it won't duplicate data |
| Only some tabs appear | Run was interrupted partway through | Re-run the same function; it fills in whatever's missing |
| `Roles` or `Modules` look empty after re-running | This is expected — the seed functions skip seeding if rows already exist, to avoid duplicates. If you genuinely need to reseed, manually delete all rows below the header first, then re-run |
| "Exception: You do not have permission to call insertSheet" | You're not the owner/editor of this spreadsheet | Make sure you created the spreadsheet yourself, or have Editor access (not just Viewer) |

---

## 4. What's next

Phase 5 finalizes the repository folder structure (where every file goes before Phase 6 starts producing the full backend codebase), then Phase 6 begins delivering the complete, runnable `.gs` files one by one.
