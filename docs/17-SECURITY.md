# Security
## English Academy Indonesia — Phase 17

| Field | Value |
|---|---|
| Document | Phase 17 — Security |
| Status | Draft — proceeding directly to Phase 18 |

This document consolidates every security control already built into Phases 1–16 and records the deliberate tradeoffs. It is a review/audit document, not a new feature phase — almost everything here already exists in the delivered code; this is where it's indexed in one place.

---

## 1. RBAC (Role-Based Access Control)

**Enforcement point:** `_requireSession(token, allowedRoles)` in `Auth.gs`, called as the first statement of every client-callable function across all 19 backend files.

**Why this matters more than usual in Apps Script:** as documented in Architecture §3, every top-level function in every `.gs` file shares one global namespace and is callable via `google.script.run` regardless of which file it's "organized" into. File separation is for readability only — it provides **zero** access control. This is the single most important thing for anyone extending this codebase to internalize: a new function with no `_requireSession` call at the top is reachable by anyone, logged in or not.

**Self-check for code review:** grep the codebase for `function ` declarations not preceded by `_requireSession` within their body, excluding `_`-prefixed internal helpers and the deliberately-public `verifyCertificate`. Every match is a bug.

## 2. Authentication & Session Security

- Passwords: SHA-256 with a unique per-user random salt (`Auth.gs::_hashPassword`). Never stored or transmitted in plaintext beyond the initial HTTPS request.
- Sessions: random UUID tokens in `CacheService`, sliding expiration on activity, hard 6-hour ceiling (Apps Script platform limit).
- Generic failure messages: `login()` never reveals whether a username exists or the password was wrong — both return "Invalid username or password."

### 2.1 Immediate revocation on disable (closed in this phase)

Originally, `disableUser()` only changed `Users.Status`; an already-issued session token remained valid in `CacheService` until it naturally expired, since `_requireSession` only checked the token's existence, not live account status. **This has been closed**: `_setUserRevoked()` now maintains a small revoked-user-ID set in `CacheService`, checked by `_requireSession` on every call. A disabled account's session is rejected on its very next request.

## 3. Input Handling

- `sanitizePlainText()` (`Utils.gs`) strips HTML tags from any field a student/teacher submits that could later be displayed elsewhere (names, titles, leaderboard entries) — mitigates stored XSS.
- **Deliberate exception:** `Lessons.gs::ContentHTML` (Quill-authored lesson content) is NOT passed through `sanitizePlainText`, because it's meant to contain HTML. This is acceptable because only authenticated `teacher`/`admin` roles can write to it (`_requireSession(token, ['admin', 'teacher'])` on `createLesson`/`updateLesson`) — students never have write access to this field. If self-service teacher signup is ever added, revisit this with a proper HTML allowlist sanitizer (e.g., stripping `<script>`/event-handler attributes) before render.
- `escapeHtml()` available for any future server-rendered template that echoes user input into HTML attributes.

## 4. CSRF Considerations

Traditional CSRF (a malicious site tricking a logged-in user's browser into making an unwanted request) is structurally mitigated here: `google.script.run` calls only originate from script tags Google itself serves inside the Apps Script-hosted page, and the session token is read from `sessionStorage` (not an ambient cookie that would be auto-attached to a cross-origin request). A third-party site cannot read `sessionStorage` from `script.google.com`'s origin, so it cannot forge a valid call. No additional CSRF token is needed on top of this.

## 5. Activity Logging

Every state-changing action across every backend file calls `_logActivity()`, writing to `ActivityLogs` (`UserID`, `Action`, `Details`, `Timestamp`). This is the audit trail referenced throughout — e.g. Exam.gs's anti-cheat warnings are logged events here, not a separate table (Database Design §3.20).

**Documented gap:** no IP address is captured (Database Design §3.20 explains why — Apps Script web apps don't reliably expose client IP server-side). Don't assume `ActivityLogs` provides network-level forensics; it's an application-action audit trail only.

## 6. File Upload Safety

- `uploadFileToDrive()` (`Utils.gs`) accepts a MIME type and filename from the client but does not deeply validate file *contents* match the declared type — Apps Script has no native file-content sniffing. Risk is bounded because: (a) uploaded files are stored in Drive, not executed by the server in any way; (b) Drive's own malware scanning applies to downloads; (c) only authenticated users can upload at all.
- All uploaded content (lesson PDFs, certificates, assignment submissions) is shared as "anyone with the link" rather than fully public/indexed — see `Utils.gs` header comment for the explicit warning against reusing this helper for anything containing private student data beyond what's already covered (assignment submissions are between student/teacher/admin only by design — their Drive links aren't surfaced to other students anywhere in the frontend).

## 7. Public (No-Auth) Endpoints — by design

Exactly one function is intentionally callable without a session: `Certificate.gs::verifyCertificate(token)`. It accepts a random, unguessable `VerificationToken` (a UUID, not a sequential certificate number) and returns only non-sensitive fields (student name, module, certificate number, validity). This mirrors how real-world certificate verification systems work and is an accepted, deliberate exception to the RBAC rule in §1 — documented here so a future code reviewer doesn't "fix" it by adding a session check and breaking QR verification for people without accounts.

## 8. What this project does NOT claim to defend against

Stated plainly, per the project's general commitment to honest tradeoffs (PRD §9):

- **Determined exam cheating** (a second device, a friend reading questions aloud) — `AntiCheatWarning` logs tab-switches as a deterrent and reporting signal for teachers, not a lockdown browser. There is no screen-recording prevention or device-lock capability available to a Google Apps Script web app.
- **Nation-state-level or targeted attacks** — this is a free, zero-infrastructure educational tool for a single school's use, not a hardened enterprise system.
- **Apps Script platform-level vulnerabilities** — the project trusts Google's platform security for `CacheService`, `LockService`, `DriveApp`, etc.; it cannot audit Google's own infrastructure.

## 9. Pre-launch security checklist

- [ ] `Config.gs` — confirm `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `WEB_APP_URL` are filled in (not left as placeholders)
- [ ] Run `createDailyCleanupTrigger()` once (Utils.gs) so `ActivityLogs` doesn't grow unbounded
- [ ] Confirm the Drive folder set in `CONFIG.DRIVE_FOLDER_ID` is not the same folder as anything containing unrelated private files (since lesson/certificate files inside it become link-shareable)
- [ ] Spot-check: log in as a `student` account and confirm none of the admin/teacher pages (`admin-users`, parts of `lessons` edit UI) are reachable or functional
- [ ] Spot-check: disable a test account, confirm it's logged out on its very next action (§2.1)
