# Product Requirement Document (PRD)
## English Academy Indonesia — English Learning Platform for SMA Students

| Field | Value |
|---|---|
| Document | Phase 1 — Product Requirement Document |
| Version | 1.0 |
| Curriculum | Kurikulum Merdeka |
| Target Users | SMA Kelas X, XI, XII students, English teachers, administrators |
| Stack | Google Apps Script + Google Sheets + Google Drive + GitHub (no paid services) |
| Status | Draft — awaiting approval to proceed to Phase 2 |

---

## 1. Executive Summary

**English Academy Indonesia** is a free-to-operate, browser-based English learning platform built specifically for Indonesian Senior High School (SMA) students following Kurikulum Merdeka. It combines structured lessons, quizzes, exams, assignments, OCR, translation, vocabulary tools, and speaking/listening practice into a single system that any school — regardless of IT budget — can deploy using only a Google account, a spreadsheet, and Apps Script.

The platform's core differentiator is **zero infrastructure cost**: no servers, no databases to provision, no monthly bills. The tradeoff, documented honestly in Section 9, is a realistic operating ceiling rather than unlimited enterprise scale.

---

## 2. Vision Statement

> "Every Indonesian SMA student, in every region — including those without access to expensive private courses — should be able to learn English through a structured, interactive, and modern digital platform, at zero cost to their school."

---

## 3. Goals & Objectives

| Goal | Objective | Measure |
|---|---|---|
| Accessibility | Runs on any device with a browser; no installs | Works on Android Chrome, low-end laptops |
| Affordability | $0 recurring cost | 100% free APIs/services only |
| Curriculum Alignment | Fully maps to Kurikulum Merdeka X/XI/XII | All 43 modules implemented |
| Engagement | Gamified, mobile-first, Duolingo/Ruangguru-inspired UX | Quiz completion rate, return visits |
| Teacher Empowerment | Teachers manage content without developer help | No-code lesson/quiz authoring |
| Beginner Deployability | A non-technical teacher can deploy it solo | 30-minute quick start succeeds |

---

## 4. Target Users & Personas

### 4.1 Admin (School Coordinator / IT Champion)
A teacher or staff member, often **not a developer**, responsible for setting up and overseeing the platform for their school. Needs: simple setup, full visibility, ability to manage users without touching code.

### 4.2 Teacher
An English subject teacher who authors content, sets quizzes/exams, grades essays and assignments, and tracks class progress. Needs: fast content creation, clear grading tools, minimal clicks.

### 4.3 Student
A Kelas X/XI/XII student, often on a mid-range Android phone with inconsistent internet. Needs: fast loading, offline-tolerant where possible, simple navigation, instant feedback (auto-graded quizzes), and self-study tools (OCR, translator, vocabulary).

---

## 5. Scope

### 5.1 In Scope
- Full LMS: content delivery, quizzes, exams, assignments, attendance, certificates
- Three roles (Admin, Teacher, Student) with RBAC
- AI/utility tools: OCR (Tesseract.js), Translation (LibreTranslate/MyMemory), Dictionary (Free Dictionary API), Speech (Web Speech API)
- Complete Kelas X/XI/XII curriculum content structure (43 modules total)
- Admin/Teacher/Student dashboards with analytics
- Certificate generation with QR verification
- Notification system
- Beginner-friendly deployment guide (no terminal, no npm, no CLI)

### 5.2 Out of Scope (v1)
- Native mobile apps (iOS/Android) — web-only, mobile-responsive instead
- Payment/subscription billing (entire platform is free)
- Multi-language UI beyond Indonesian/English
- Real-time video conferencing (live classes) — async content only
- Integration with national exam systems (e.g., ANBK) — not in v1

---

## 6. Curriculum Overview (Kurikulum Merdeka)

| Tingkat | Modules | Count |
|---|---|---|
| Kelas X | Greeting → Vocabulary Building (foundational skills, tenses, text types) | 16 |
| Kelas XI | Opinion/Suggestion/Obligation → Academic Vocabulary (functional + text types) | 15 |
| Kelas XII | Discussion Text → Professional English (TOEFL/IELTS prep, career English) | 12 |
| **Total** | | **43 modules** |

Each module will ship with: Learning Objectives, Learning Outcomes, Lesson Content, PDF Material, Video Material, Vocabulary List, Exercises, Assignment, Quiz, and Discussion prompt (detailed per-module breakdown will be produced in Phase 6/Content phase, not duplicated here to keep the PRD scannable).

---

## 7. Functional Requirements

### 7.1 Authentication & Roles
- FR-1: System supports login for Admin, Teacher, Student with role-based redirect
- FR-2: Passwords hashed before storage in Sheets (never stored plaintext)
- FR-3: Session token validated on every Apps Script call
- FR-4: Admin can create/disable/reset any user account

### 7.2 Content Management
- FR-5: Teacher can create/edit/delete lessons with rich text (Quill Editor)
- FR-6: Teacher can upload PDF/video/image materials (stored in Google Drive, linked via Sheets)
- FR-7: Content organized by Kelas → Module → Lesson hierarchy

### 7.3 Quiz System
- FR-8: Supports Multiple Choice, Multiple Response, True/False, Matching, Fill-in-the-Blank, Essay
- FR-9: Auto-grading for objective question types; manual grading queue for essays
- FR-10: Random question order per attempt; configurable retry limit
- FR-11: Leaderboard per class/module

### 7.4 Exam System
- FR-12: Countdown timer with auto-submit on expiry
- FR-13: Auto-save answers every N seconds to prevent data loss
- FR-14: Tab-switch / focus-loss warning (anti-cheat, best-effort only — see NFR limitations)
- FR-15: Exam report generated per student and per class

### 7.5 Assignment System
- FR-16: Student uploads file/image/PDF as submission
- FR-17: Teacher leaves feedback + rubric-based score
- FR-18: Submission status tracked (Not Submitted / Submitted / Graded / Late)

### 7.6 OCR Module
- FR-19: Student uploads image; Tesseract.js extracts text client-side
- FR-20: Extracted text can be copied, downloaded (TXT/PDF), or sent to Translator

### 7.7 Translator Module
- FR-21: Bi-directional EN↔ID translation via LibreTranslate, falling back to MyMemory on failure/rate-limit
- FR-22: OCR output can be translated in one click

### 7.8 Vocabulary Builder
- FR-23: Word lookup via Free Dictionary API: meaning, pronunciation, synonyms, antonyms, examples
- FR-24: Student can save words to a personal favorites list (stored per-user in Sheets)

### 7.9 Speaking & Listening Practice
- FR-25: Web Speech API captures pronunciation attempt and gives a similarity-based score
- FR-26: Listening module supports audio playback with variable speed and comprehension questions

### 7.10 Certificates
- FR-27: PDF certificate auto-generated on module/course completion
- FR-28: Certificate includes unique number + QR code linking to a verification page

### 7.11 Notifications
- FR-29: In-app notification feed for new lesson/quiz/exam/assignment/score events

### 7.12 Dashboards
- FR-30: Admin dashboard shows system-wide counts and recent activity
- FR-31: Teacher dashboard shows assigned classes, pending grading, quiz/exam stats
- FR-32: Student dashboard shows progress, scores, attendance, certificates, achievements

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Pages interactive within 3s on 4G; lists use pagination/lazy loading |
| Caching | Apps Script `CacheService` used for read-heavy endpoints (dashboard stats, course catalog) |
| Security | RBAC enforced server-side (never trust client role claims); input sanitized against XSS; CSRF token on state-changing calls; activity log for sensitive actions |
| Usability | Mobile-first, Bootstrap 5 responsive grid, Poppins typography, WCAG-AA color contrast where feasible |
| Maintainability | Modular `.gs` files by domain (Auth, Quiz, Exam, OCR, etc.), no monolithic Code.gs |
| Availability | Subject to Google Workspace/Apps Script uptime (no SLA on free tier — documented risk) |

---

## 9. Scalability — Honest Constraints & Mitigations

This system explicitly targets **zero-cost infrastructure**, which comes with real technical ceilings. Documenting these now avoids surprises at launch:

| Constraint | Free-Tier Limit (approx., consumer Google account) | Mitigation |
|---|---|---|
| Concurrent Apps Script executions | ~30 simultaneous | Queue non-urgent writes; keep functions short; use `LockService` |
| URL Fetch calls/day (used by Translator/OCR fallback) | ~20,000/day | Client-side OCR (Tesseract.js runs in-browser, no quota use); cache translation results |
| Script execution time | 6 min/execution (consumer) | Avoid loops over huge ranges; batch read/write to Sheets instead of cell-by-cell |
| Sheet size | Practical comfortable ceiling well under 1M rows for responsive querying | Archive old `ActivityLogs`/`Submissions` periodically; consider per-class sheets if a single school exceeds a few thousand active students |
| Simultaneous Sheet writes | Risk of race conditions | `LockService` + `CacheService`, batched writes |

**Practical guidance:** This architecture comfortably supports a single large school or several mid-size schools (hundreds to low thousands of registered students, realistic concurrent usage in the tens). "10,000+ students" as *registered/enrolled* across many schools over time is achievable; "10,000+ truly concurrent simultaneous users" is **not** realistic on this free stack and would require a paid backend — which is explicitly out of scope per your constraints. This tradeoff is accepted as a known limitation of the project, not a defect.

---

## 10. Technical Constraints (per project requirements)

- Frontend: HTML5, CSS3, Bootstrap 5, JS ES6, Chart.js, SweetAlert2, Quill Editor, DataTables
- Backend: Google Apps Script only
- Database: Google Sheets only
- Storage: Google Drive only
- No Firebase, Supabase, AWS, Azure, Docker, VPS, MySQL/MongoDB servers
- No build tools, no npm, no Node.js, no CI/CD — copy-paste deployable

---

## 11. Assumptions & Dependencies

- School/teacher has a Google account (free Gmail is sufficient)
- Internet access available for initial deployment and ongoing API calls (Translator, Dictionary)
- LibreTranslate public instance and MyMemory API remain free and available (external dependency risk — documented in Phase 21 Troubleshooting)
- Apps Script web app deployment permissions are not blocked by a school's Google Workspace admin policy (some institutional accounts restrict this — flagged for Admin setup phase)

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Apps Script daily quota exhausted | Translator/OCR fallback fails | Client-side OCR by default; cache translations; graceful error messages |
| Sheet corruption from concurrent writes | Data loss | LockService on all write operations |
| School Workspace admin disables Apps Script deployment | Total blocker | Document this explicitly in Troubleshooting (Phase 21) with a workaround (personal Gmail account) |
| Free translation API discontinued/rate-limited | Translator feature degrades | Dual-provider fallback (LibreTranslate → MyMemory) |
| Non-technical admin misconfigures Spreadsheet ID | Setup failure | Step-by-step guide with screenshots-equivalent descriptions (Phase 19) |

---

## 13. Success Metrics (KPIs)

- Time to first successful deployment by a non-technical user: **≤ 30 minutes**
- Quiz auto-grading accuracy: **100%** for objective question types
- Page load time on 4G: **< 3 seconds**
- Zero paid services in production: **$0/month** maintained
- Curriculum coverage: **43/43 modules** present with all required content types

---

## 14. Phase Roadmap (full project)

1. ✅ Product Requirement Document *(this document)*
2. Software Architecture
3. Database Design (Google Sheets schema)
4. Google Sheets Setup Guide
5. Folder Structure
6. Backend Development (file by file)
7. Frontend Development
8. Authentication
9. Role Management
10. Dashboards
11. Quiz System
12. Exam System
13. OCR System
14. Translator
15. Vocabulary Builder
16. Certificate System
17. Security
18. Testing
19. Deployment Guide (beginner, 20 steps)
20. GitHub Manual Upload Guide
21. Troubleshooting Guide
22. Maintenance Guide

Each phase will be delivered as its own file/document, with your approval requested before moving to the next.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| RBAC | Role-Based Access Control |
| Kurikulum Merdeka | Indonesia's current national curriculum framework |
| SMA | Sekolah Menengah Atas (Senior High School) |
| OCR | Optical Character Recognition |
| LockService | Apps Script service preventing concurrent script collisions |
| CacheService | Apps Script service for temporary fast-access caching
