# Folder Structure
## English Academy Indonesia — Phase 5

| Field | Value |
|---|---|
| Document | Phase 5 — Folder Structure |
| Depends on | 02-ARCHITECTURE.md §10–12 |
| Status | Draft — proceeding directly to Phase 6 |

---

## 1. Two different "folder structures" — and why they're not the same thing

This trips up almost every Apps Script beginner, so it's worth stating plainly before Phase 6 starts producing files:

- **The GitHub repository** is a normal folder tree. Folders are real, nesting is real, this is what you'll back up to GitHub in Phase 20.
- **The Apps Script project itself has no real folders.** Every `.gs` file and every `.html` file lives in one flat list inside the project. The Apps Script editor *displays* files with a `/` in their name (e.g. `partials/navbar`) as if they were in a folder, but that's a cosmetic grouping only — there is no actual nested file system on Google's side.

**What this means practically:** when Phase 6/7 deliver a file meant to be "in" `frontend/views/`, you will create it in the Apps Script editor with a filename like `dashboard-student` (no real subfolder, possibly using the editor's `/`-naming convenience for visual grouping) — while the **same file**, in the GitHub backup, genuinely lives at `frontend/views/dashboard-student.html`. Phase 20 (GitHub Manual Upload Guide) will map every Apps Script file to its correct GitHub path explicitly, file by file, so nothing gets lost in translation.

---

## 2. Final repository structure

```
english-academy-indonesia/
├── backend/                          → becomes flat .gs files in Apps Script
│   ├── Setup.gs                      ✅ delivered (Phase 4)
│   ├── Code.gs                       doGet router + include() helper
│   ├── Config.gs                     Spreadsheet ID, Drive folder ID, constants
│   ├── Auth.gs                       login, session, _requireSession guard
│   ├── Users.gs                      admin user CRUD
│   ├── Students.gs                   student profile/progress
│   ├── Teachers.gs                   teacher profile/classes
│   ├── Classes.gs                    class management, enrollment
│   ├── Lessons.gs                    module/lesson CRUD
│   ├── Quiz.gs                       quiz CRUD, attempts, auto-grading
│   ├── Exam.gs                       exam CRUD, timed attempts, auto-submit
│   ├── Translator.gs                 LibreTranslate → MyMemory, cached
│   ├── Vocabulary.gs                 favorites persistence
│   ├── Certificate.gs                PDF certificate + QR generation
│   ├── Attendance.gs                 attendance marking/reporting
│   ├── Dashboard.gs                  cached aggregate stats per role
│   ├── Notification.gs               notification feed
│   ├── Database.gs                   generic sheet CRUD (the data access layer)
│   └── Utils.gs                      validation, ID generation, cleanup trigger
│
├── frontend/
│   ├── views/                        → one HtmlService template per page
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard-admin.html
│   │   ├── dashboard-teacher.html
│   │   ├── dashboard-student.html
│   │   ├── lessons.html
│   │   ├── lesson-detail.html
│   │   ├── quiz.html
│   │   ├── quiz-result.html
│   │   ├── exam.html
│   │   ├── exam-result.html
│   │   ├── assignments.html
│   │   ├── ocr.html
│   │   ├── translator.html
│   │   ├── vocabulary.html
│   │   ├── speaking.html
│   │   ├── listening.html
│   │   ├── certificates.html
│   │   ├── attendance.html
│   │   └── admin-users.html
│   └── partials/                     → injected via include() into every view
│       ├── head.html                 CDN links: Bootstrap, Poppins, Chart.js, etc.
│       ├── navbar.html
│       └── footer.html
│
├── assets/
│   ├── css/custom.css                Brand colors, overrides beyond Bootstrap
│   ├── js/                           Shared client utilities (kept minimal — see Architecture §11)
│   └── images/icons/                 Logo, favicon, illustrations
│
├── docs/
│   ├── 01-PRD.md                     ✅ delivered
│   ├── 02-ARCHITECTURE.md            ✅ delivered
│   ├── 03-DATABASE-DESIGN.md         ✅ delivered
│   ├── 04-GOOGLE-SHEETS-SETUP.md     ✅ delivered
│   ├── 05-FOLDER-STRUCTURE.md        ✅ this file
│   └── ... one file per remaining phase
│
├── README.md                         project overview, quick links (Phase 20)
├── INSTALLATION.md                   (Phase 19)
├── DEPLOYMENT.md                     (Phase 19)
├── DATABASE_SETUP.md                 mirrors Phase 4, GitHub-facing copy
├── TROUBLESHOOTING.md                (Phase 21)
├── CHANGELOG.md
└── LICENSE
```

---

## 3. Brand & design tokens (carried through every frontend file from here on)

| Token | Value |
|---|---|
| Primary | `#00AEEF` |
| Secondary | `#4CAF50` |
| Accent | `#FFC107` |
| Typography | Poppins (Google Fonts CDN) |
| Grid | Bootstrap 5, mobile-first |

These will be defined once in `assets/css/custom.css` and `frontend/partials/head.html` in Phase 7, so every page inherits them automatically rather than redefining colors per file.

---

## 4. What's next

Phase 6 begins delivering the backend `.gs` files from the table above, starting with `Database.gs` (the data-access layer everything else depends on) and `Config.gs` + `Auth.gs`, since every other domain file calls into these three.
