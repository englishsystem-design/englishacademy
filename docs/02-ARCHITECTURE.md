# Software Architecture
## English Academy Indonesia — Phase 2

| Field | Value |
|---|---|
| Document | Phase 2 — Software Architecture |
| Depends on | 01-PRD.md |
| Status | Draft — awaiting approval to proceed to Phase 3 (Database Design) |

---

## 1. Architectural Style

**Server-rendered shell + RPC-driven SPA-lite**, hosted entirely inside a single Google Apps Script project deployed as a Web App.

- The Apps Script `doGet(e)` function serves a thin HTML shell (templated via `HtmlService`).
- Once loaded, the page behaves like a single-page app: navigation between sections happens client-side, and all data operations call backend functions via `google.script.run` (Apps Script's built-in async RPC bridge) instead of REST/AJAX `fetch()` calls.
- No separate frontend host, no API gateway, no CORS concerns — because frontend and backend are deployed together as one Apps Script project.

This is a deliberate choice, not a default: see Section 9 for the alternatives considered and rejected.

---

## 2. Layered Architecture

| Layer | Responsibility | Implementation |
|---|---|---|
| Presentation | Renders UI, handles user input, client-side validation | HTML files + Bootstrap 5 + vanilla JS (ES6), served via `HtmlService` |
| Communication | Bridges client and server | `google.script.run` (server calls) + direct `fetch()` for public CORS-friendly client-side APIs only |
| Controller | Routes page requests, exposes callable entry points | `Code.gs` (`doGet`), domain `.gs` files export the functions the client calls |
| Business logic | Validates rules, enforces RBAC, orchestrates operations | Domain files: `Auth.gs`, `Quiz.gs`, `Exam.gs`, `Certificate.gs`, etc. |
| Data access | Abstracts reads/writes so business logic never touches raw ranges | `Database.gs` (generic sheet CRUD helpers) |
| Data storage | Persists structured data and files | Google Sheets (structured data), Google Drive (binary files) |
| External integration | Talks to free third-party APIs | `Translator.gs` (server-side, cached) + client-side direct calls for Dictionary/OCR/Speech/PDF |

---

## 3. A critical Apps Script constraint that shapes everything else

**Every top-level function in every `.gs` file in an Apps Script project shares one global namespace and is callable from the client via `google.script.run` — regardless of which file it lives in.**

This means:
- Splitting code into `Auth.gs`, `Quiz.gs`, `Users.gs`, etc. is purely for human readability. It provides **zero access control** by itself.
- Two files must never define a function with the same name — there is no per-file scoping to save you.
- Therefore the security model cannot rely on "this function lives in a file the client doesn't know about." Every function reachable from the client **must validate the session token and required role as its first statement**, no exceptions.

**Convention adopted for this project:**
- Public, client-callable functions: normal `camelCase` names, e.g. `getQuizById(token, quizId)`.
- Internal-only helpers never meant to be called from the client: prefixed with `_`, e.g. `_calculateScore(answers)`. The underscore is a human signal only (Apps Script will still technically expose it) — so internal helpers additionally never read `e.parameter` or accept a raw token, making them useless to call directly even if someone tries.
- A shared guard, `_requireSession(token, allowedRoles)`, is the first line of every public function. It throws if the token is invalid, expired, or the role doesn't match — the function body never executes otherwise.

This is documented prominently here because it is the single most common security mistake in real-world Apps Script projects, and it must be a project-wide convention from file 1, not bolted on later.

---

## 4. Request Lifecycle

### 4.1 Page load (first visit)
1. Browser requests the Web App URL.
2. `doGet(e)` reads `e.parameter.page` (defaults to `login`).
3. `Code.gs` calls `HtmlService.createTemplateFromFile(page)`, injects shared partials (navbar, footer) via the include pattern, and returns evaluated HTML.
4. Browser renders the shell. Client JS then calls `google.script.run` to fetch any dynamic data needed for that page (e.g. dashboard stats).

### 4.2 Authenticated action (e.g. submitting a quiz)
1. Client JS calls `google.script.run.withSuccessHandler(fn).submitQuiz(token, quizId, answers)`.
2. `Quiz.gs::submitQuiz` runs `_requireSession(token, ['student'])`.
3. Business logic validates the quiz is still open, fetches correct answers via `Database.gs`, computes the score.
4. `Database.gs` writes the result row to the `Scores` sheet using `LockService` to prevent concurrent write collisions.
5. Response object returned to `withSuccessHandler`, client updates the UI (SweetAlert2 confirmation, Chart.js score visual).

### 4.3 Client-side-only operation (e.g. OCR)
1. Student uploads an image.
2. Tesseract.js (loaded from CDN, runs entirely in-browser via WebAssembly) extracts text — **no Apps Script call, no quota used**.
3. Student optionally clicks "Translate" → now this *does* call `google.script.run.translateText(token, text, direction)`, which is server-routed (see Section 6).

---

## 5. Authentication & Session Architecture

Apps Script web apps have no native cookie-based session like a traditional server. The architecture uses a custom token scheme:

1. **Login**: `Auth.gs::login(username, passwordPlain)` looks up the user in the `Users` sheet, compares against a stored salted hash, and on success generates a UUID session token.
2. **Session storage**: the token, user ID, role, and an expiry timestamp are stored in `CacheService` (fast, auto-expiring — max ~6 hours per Apps Script limits). Login events are additionally written to the `ActivityLogs` sheet for audit (separate from the live session cache).
3. **Client storage**: the browser keeps the token in `sessionStorage` (cleared when the tab closes) — standard practice for this kind of app, not a Claude-artifact context, so normal browser storage applies here.
4. **Every subsequent call** passes the token as the first argument; `_requireSession` validates it against the cache and **slides the expiry forward** on each valid call (so an active user is never logged out mid-session, but an idle one expires).
5. **Logout** explicitly removes the cache entry.
6. A time-based trigger (`Utils.gs::cleanupExpiredSessions`, runs hourly) sweeps any stale entries that `CacheService` hasn't already expired, and trims old `ActivityLogs` rows beyond a retention window.

---

## 6. External API Integration Strategy

Not all free APIs are treated the same way — each is routed based on where it adds the least load and the most reliability:

| API | Called from | Reasoning |
|---|---|---|
| Tesseract.js (OCR) | Client (browser, WASM) | Runs entirely client-side; zero backend load, zero quota use, works the same for 1 or 10,000 users |
| Web Speech API | Client (browser native) | Browser-native, no network call to Apps Script needed |
| PDF.js | Client (browser) | Renders PDFs straight from a Drive file URL, no backend involvement |
| Free Dictionary API | Client (direct `fetch`) | Public, CORS-enabled, read-only, no auth needed — routing it through Apps Script would only add latency and quota pressure for no benefit |
| LibreTranslate / MyMemory | **Server (`Translator.gs`, via `UrlFetchApp`)** | Routed server-side specifically so identical phrases can be cached in `CacheService`, the LibreTranslate→MyMemory fallback logic lives in one place, and the daily `UrlFetchApp` quota is centrally monitored instead of silently exhausted per-student |

---

## 7. Caching Strategy

| What | Where | TTL | Why |
|---|---|---|---|
| Session tokens | `CacheService` (user cache) | ~6 hrs, sliding | Avoid hitting `Users`/`Sessions` sheet on every call |
| Translation results | `CacheService` (script cache) | 6 hrs | Identical phrases (common in shared lesson content) reuse one API call across all students |
| Dashboard aggregate stats (Admin) | `CacheService` (script cache) | 5 min | Counts (total students, quizzes, etc.) don't need to be real-time and are expensive to recompute per request |
| Course catalog / module list | `CacheService` (script cache) | 30 min | Rarely changes, read constantly |

---

## 8. Concurrency & Data Integrity

Google Sheets is not a transactional database. Two students submitting a quiz at the same millisecond can corrupt a naive "find last row, append" write. Mitigations:

- **`LockService.getScriptLock()`** wraps every write operation (`Database.gs::insertRow`, `updateRow`), with a short timeout and a clear error surfaced to the client on contention rather than a silent partial write.
- Writes are **batched** wherever possible (e.g. `setValues()` over a range) rather than looping cell-by-cell, which is both faster and reduces the lock-held window.
- Append operations use `Sheet.appendRow()` (atomic at the Sheets API level) instead of manually calculating the next empty row, eliminating a whole class of race condition.

---

## 9. Design Decisions & Rejected Alternatives

| Decision | Alternative considered | Why rejected |
|---|---|---|
| `google.script.run` RPC pattern | `doGet`/`doPost` returning JSON, consumed by `fetch()` like a REST API | Adds no benefit here since frontend and backend are never deployed separately; `google.script.run` is simpler, has built-in success/failure handlers, and avoids manually parsing JSON everywhere |
| Custom token auth in Sheets | Apps Script native `Session.getActiveUser()` | Requires every student to have a Google Workspace account in the same domain, which most Indonesian public schools don't provision; custom auth lets any student sign up with just a username/password |
| Client-side OCR (Tesseract.js) | Server-side OCR via Apps Script + an OCR API | Free OCR APIs either require keys with paid tiers at volume or would burn `UrlFetchApp` quota per image; WASM-based client OCR scales with the number of *browsers*, not the backend |
| CacheService for sessions | A `Sessions` sheet as source of truth | Sheets reads/writes are slow relative to `CacheService`; the sheet is kept only as an audit trail (`ActivityLogs`), not the live session check |

---

## 10. File/Module Map (backend)

| File | Responsibility |
|---|---|
| `Code.gs` | `doGet` router, shared include() helper for HTML partials |
| `Config.gs` | Spreadsheet ID, Drive folder ID, app-wide constants (no secrets — see Phase 17 Security) |
| `Auth.gs` | login, logout, password hashing, `_requireSession` guard, session issuance |
| `Users.gs` | Admin user CRUD (create/disable/reset across all roles) |
| `Students.gs` | Student-specific profile and progress operations |
| `Teachers.gs` | Teacher-specific profile and assigned-class operations |
| `Classes.gs` | Class/section management, enrollment |
| `Lessons.gs` | Module/lesson CRUD, content retrieval |
| `Quiz.gs` | Quiz CRUD, attempt submission, auto-grading, leaderboard |
| `Exam.gs` | Exam CRUD, timed-attempt lifecycle, auto-save/auto-submit, reporting |
| `Translator.gs` | Server-routed translation with LibreTranslate→MyMemory fallback + caching |
| `Vocabulary.gs` | Favorites list persistence (lookup itself is client-side, see Section 6) |
| `Certificate.gs` | PDF certificate generation, QR verification record |
| `Attendance.gs` | Attendance marking and reporting |
| `Dashboard.gs` | Aggregate stats for Admin/Teacher/Student dashboards (cached) |
| `Notification.gs` | Notification creation and retrieval feed |
| `Database.gs` | Generic sheet CRUD: `getAllRows`, `getRowById`, `insertRow`, `updateRow`, `deleteRow`, header-to-column-index mapping |
| `Utils.gs` | Shared helpers: validation, ID generation, scheduled cleanup trigger |

Each file will be delivered with complete, runnable code in Phase 6 (Backend Development) — this table is the contract for what goes where, so later phases stay consistent.

---

## 11. Frontend Architecture

- One HTML file per page (`login.html`, `dashboard-admin.html`, `dashboard-teacher.html`, `dashboard-student.html`, `quiz.html`, `exam.html`, `ocr.html`, `translator.html`, `vocabulary.html`, etc.), each a full `HtmlService` template.
- Shared partials (`navbar.html`, `footer.html`, `head.html` with Bootstrap/Poppins/Chart.js CDN links) injected via the standard Apps Script include pattern:
  ```html
  <?!= include('partials/navbar'); ?>
  ```
- All page-specific JS lives in a matching `<script>` block at the bottom of each HTML file (Apps Script doesn't serve standalone `.js` static files well — inline per page is the standard, supported pattern).
- Mobile-first Bootstrap 5 grid; Poppins loaded from Google Fonts CDN; Chart.js for analytics; SweetAlert2 for confirmations/alerts; Quill for rich-text lesson authoring; DataTables for sortable/searchable admin tables.

---

## 12. Repository Structure (preview — finalized in Phase 5)

```
english-academy-indonesia/
├── backend/                  Apps Script .gs files (Section 10)
├── frontend/
│   ├── views/                One .html file per page
│   └── partials/              navbar.html, footer.html, head.html
├── assets/
│   ├── css/                  Custom overrides beyond Bootstrap
│   ├── js/                   Shared client utilities (if not inlined)
│   └── images/icons/
├── docs/
│   ├── 01-PRD.md
│   ├── 02-ARCHITECTURE.md
│   └── ... (one file per phase)
├── README.md
├── INSTALLATION.md
├── DEPLOYMENT.md
├── DATABASE_SETUP.md
├── TROUBLESHOOTING.md
├── CHANGELOG.md
└── LICENSE
```

---

## 13. What this architecture intentionally does NOT do

- No build step, no bundler, no transpilation — every file is deployable by copy-paste, per the beginner-deployment constraint.
- No client-side framework (React/Vue) — Apps Script's `HtmlService` doesn't serve a build pipeline well, and vanilla JS keeps the copy-paste deployment story intact.
- No real-time sockets — Apps Script has no WebSocket support; "live" features (notifications) are poll-on-load, not push.
- No horizontal scaling story beyond what's described in PRD Section 9 — by design, since the entire point is zero infrastructure.
