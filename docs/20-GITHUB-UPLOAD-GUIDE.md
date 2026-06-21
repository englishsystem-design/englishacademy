# GitHub Manual Upload Guide
## English Academy Indonesia — Phase 20

| Field | Value |
|---|---|
| Document | Phase 20 — GitHub Manual Upload Guide |
| Status | Draft — proceeding directly to Phase 21 |
| Requirement | A GitHub account (free) — this entire guide uses the GitHub website only, no `git` command, no terminal |

GitHub here is **optional backup and version history**, not where the app runs (Architecture — the app only ever runs from Apps Script). Skip this phase entirely if you don't need version history; the app works fully without it.

---

## 1. Create the repository

1. Go to `github.com`, sign in (or sign up — free).
2. Click the **+** top-right → **New repository**.
3. Repository name: `english-academy-indonesia`.
4. Visibility: **Private** recommended (the repo will contain your `Config.gs` with real Spreadsheet/Drive IDs — see §3 warning below) — or Public if you intend to share this as a template for other schools, in which case follow §3's redaction step first.
5. Check **Add a README file**.
6. Click **Create repository**.

**What you should see:** An empty repo with one `README.md` file.

---

## 2. Upload all files (fastest: drag-and-drop)

A ready-made `english-academy-indonesia.zip` containing the complete, current project (all 21 backend files, 24 frontend files, 11 docs, and the 7 root files) is provided alongside this guide — no need to create 60+ files one by one in the GitHub web UI.

1. Download `english-academy-indonesia.zip` and **extract it** on your computer (double-click it, or right-click → Extract All). You should get a folder named `english-academy-indonesia` containing `backend/`, `frontend/`, `docs/`, and the root `.md`/`LICENSE` files.
2. **Before uploading**, redact `backend/Config.gs` — see §3 below. Don't skip this if your repo will be Public.
3. On your new GitHub repo's page, click **Add file → Upload files**.
4. Open the extracted `english-academy-indonesia` folder on your computer, select everything inside it (`backend`, `frontend`, `docs`, `README.md`, etc. — Ctrl+A / Cmd+A), and **drag the whole selection** onto the GitHub upload page.
5. GitHub preserves the folder structure automatically from drag-and-drop — you'll see `backend/Auth.gs`, `frontend/views/login.html`, etc. appear correctly nested in the upload preview.
6. Scroll down, write a commit message like `Initial upload`, click **Commit changes**.

**What you should see:** The repo's file tree now matches the full project structure in one commit, instead of 60+ separate ones.

**If "drag the whole selection" doesn't work in your browser:** drag just the `backend` folder first, commit, then repeat for `frontend`, then `docs`, then drag the remaining root files (`README.md`, `LICENSE`, etc.) in a final pass. Four uploads instead of one, still no terminal.

## 2b. Alternative: file-by-file (if you prefer, or need to edit content before uploading)

GitHub's web UI also lets you create files with a `/` in the path, which creates the folder automatically:

1. Click **Add file** → **Create new file**.
2. In the file name box, type the full path, e.g. `backend/Database.gs`.
3. Paste the file's content into the editor area below.
4. Scroll down, click **Commit changes**.
5. Repeat for every file.

Slower, but useful if you want to tweak a file's content on the way in rather than editing after upload.

---

## 3. ⚠️ Before committing `Config.gs`: redact real values

`Config.gs` contains your real `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, and `WEB_APP_URL` once you've completed Phase 19. These IDs alone don't grant access to anyone without separate Google account permissions on those resources — but it's still best practice not to publish them, especially if your repo is Public.

**Before uploading `Config.gs` to GitHub:**
1. Make a copy of `Config.gs`'s content.
2. In the copy, replace your real values back to the placeholder strings (`'PASTE_YOUR_SPREADSHEET_ID_HERE'`, etc.).
3. Upload this redacted copy to GitHub instead of your live file.
4. Keep your real, filled-in `Config.gs` only inside the Apps Script editor (which is private to you by default, regardless of this repo's visibility).

---

## 4. Root-level files

Create these at the repository root (not inside any folder) — see `README.md`, `INSTALLATION.md`, `DEPLOYMENT.md`, `DATABASE_SETUP.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`, `LICENSE`, delivered alongside this phase.

---

## 5. Keeping GitHub in sync after the first upload

Since there's no `git` CLI in this workflow, "syncing" means manually re-uploading whichever file changed:

1. Edit code in the Apps Script editor as normal (that's still where the live app runs).
2. When you're happy with a change, go to the matching file on GitHub.
3. Click the pencil/edit icon, paste the updated content, **Commit changes**.

This is manual by design, per the project's "no CI/CD, no GitHub Actions" constraint — GitHub here is a backup snapshot tool, not a deployment pipeline.

---

## 6. What's next

Phase 21 is the dedicated troubleshooting reference — the errors you're most likely to hit across every phase, in one place, with fixes.
