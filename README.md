# English Academy Indonesia

A free, production-ready Learning Management System for English instruction, built specifically for Indonesian SMA students (Kelas X–XII) under Kurikulum Merdeka — running entirely on Google Apps Script, Google Sheets, and Google Drive. **Rp 0/bulan.** No servers, no Docker, no npm, no credit card.

## Why this exists

Most LMS platforms aimed at Indonesian schools are either paid (Ruangguru, Quipper, Zenius) or require infrastructure most schools can't maintain. This project trades some scalability ceiling (see [Database Design §9](docs/01-PRD.md#9-scalability--honest-constraints--mitigations) for the honest tradeoff) for **zero ongoing cost and zero-DevOps deployment**, deployable by a teacher with no coding background in under an hour.

## Features

- Full curriculum: 43 modules across Kelas X (16), XI (15), XII (12), Kurikulum Merdeka-aligned
- Lessons with rich text, PDF (PDF.js viewer), and video (Drive or YouTube)
- Quizzes (6 question types, auto-graded, leaderboard) and timed Exams (auto-save, auto-submit, anti-cheat logging)
- Assignments with file upload and rubric-based grading
- OCR (Tesseract.js, fully client-side), EN↔ID Translator (LibreTranslate + MyMemory fallback), Vocabulary Builder (Free Dictionary API)
- Speaking practice (Web Speech API) and Listening practice
- PDF certificates with QR code verification
- Role-based dashboards for Admin, Teacher, and Student

## Quick links

| I want to... | Go to |
|---|---|
| Understand what this is and why | [docs/01-PRD.md](docs/01-PRD.md) |
| Understand how it's built | [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) |
| Deploy this for my school | [docs/19-DEPLOYMENT-GUIDE.md](docs/19-DEPLOYMENT-GUIDE.md) |
| Fix an error I'm seeing | [docs/21-TROUBLESHOOTING.md](docs/21-TROUBLESHOOTING.md) |
| Maintain an existing deployment | [docs/22-MAINTENANCE-GUIDE.md](docs/22-MAINTENANCE-GUIDE.md) |

## Full documentation index

All 22 phases, in build order, live in [`docs/`](docs/):

1. [Product Requirement Document](docs/01-PRD.md)
2. [Software Architecture](docs/02-ARCHITECTURE.md)
3. [Database Design](docs/03-DATABASE-DESIGN.md)
4. [Google Sheets Setup](docs/04-GOOGLE-SHEETS-SETUP.md)
5. [Folder Structure](docs/05-FOLDER-STRUCTURE.md)
6. Backend Development → [`backend/`](backend/) (20 files)
7. Frontend Development → [`frontend/`](frontend/) (21 files)
8–16. Authentication, Roles, Dashboards, Quiz, Exam, OCR, Translator, Vocabulary, Certificates → implemented across backend + frontend together
17. [Security](docs/17-SECURITY.md)
18. [Testing](docs/18-TESTING.md)
19. [Deployment Guide](docs/19-DEPLOYMENT-GUIDE.md)
20. [GitHub Manual Upload Guide](docs/20-GITHUB-UPLOAD-GUIDE.md)
21. [Troubleshooting](docs/21-TROUBLESHOOTING.md)
22. [Maintenance Guide](docs/22-MAINTENANCE-GUIDE.md)

## Tech stack

**Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript ES6, Chart.js, SweetAlert2, Quill, DataTables, PDF.js
**Backend:** Google Apps Script
**Database:** Google Sheets (21 sheets — see [Database Design](docs/03-DATABASE-DESIGN.md))
**Storage:** Google Drive
**Free APIs:** Tesseract.js (OCR), LibreTranslate + MyMemory (translation), Free Dictionary API (vocabulary), Web Speech API (speaking practice)

## License

MIT — see [LICENSE](LICENSE).
