# Troubleshooting Guide
## English Academy Indonesia — Phase 21

| Field | Value |
|---|---|
| Document | Phase 21 — Troubleshooting Guide |
| Status | Draft — proceeding directly to Phase 22 |

A single reference for the errors most likely to come up, across every phase, with concrete fixes. Organized by error category to match the original requirement list.

---

## Permission Denied

| Symptom | Cause | Fix |
|---|---|---|
| "Exception: You do not have permission to call insertSheet/openById" | The Apps Script project isn't bound to a spreadsheet you own/edit | Confirm `CONFIG.SPREADSHEET_ID` points to a spreadsheet where your Google account has Editor access |
| "This app is blocked" during authorization | A school/organization Google Workspace admin restricts Apps Script deployment | Use a personal Gmail account instead (PRD §11), or ask your Workspace admin to allow Apps Script web app deployment |
| Drive file upload fails with a permission error | `CONFIG.DRIVE_FOLDER_ID` points to a folder you don't own, or belongs to a different account than the one running the script | Create a fresh folder with the same account that deployed the Apps Script project |

## Deployment Failed

| Symptom | Cause | Fix |
|---|---|---|
| No "Web app" option when deploying | `doGet(e)` is missing or has a typo in `Code.gs` | Re-check `Code.gs` matches the delivered file exactly |
| Deployed URL shows old code after editing | You edited files but didn't create a **new version** | Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy |
| "Script function not found: doGet" | `Code.gs` wasn't saved, or was accidentally renamed | Confirm the file is named exactly `Code` (Apps Script appends `.gs` itself) and contains `function doGet(e) {...}` |

## Spreadsheet Not Found

| Symptom | Cause | Fix |
|---|---|---|
| "Exception: Invalid argument: id" on `testConfig` | `SPREADSHEET_ID` still has the placeholder text or extra whitespace | Recopy the ID fresh from the spreadsheet URL (between `/d/` and `/edit`), no surrounding spaces |
| "Unknown sheet: Users" type errors | `createDatabaseStructure()` was never run, or was run against a *different* spreadsheet than `Config.gs` now points to | Re-run Phase 4's setup steps against the correct spreadsheet, double-check the ID matches |

## Login Failed

| Symptom | Cause | Fix |
|---|---|---|
| "Invalid username or password" for a user you're sure is correct | Passwords are case-sensitive; or the account was created with a typo'd username | As admin, use "Reset Password" on that user, try again |
| "This account has been disabled" | Account status is `disabled` in the `Users` sheet | Admin: Manajemen Pengguna → "Aktifkan" on that user |
| Login button does nothing, no error shown | Browser console shows a JS error (often `APP_BASE_URL` is empty) | Confirm `CONFIG.WEB_APP_URL` is set and you redeployed a new version after setting it (Deployment Guide Step 12) |

## API Error (general external API failures)

| Symptom | Cause | Fix |
|---|---|---|
| Any feature relying on `UrlFetchApp` suddenly fails | Apps Script's daily `UrlFetchApp` quota was hit (Architecture §9 — ~20,000/day on consumer accounts) | Wait until the quota resets (rolling daily window), or reduce translation volume by relying more on the cache (already automatic) |
| "muteHttpExceptions" results silently return null | The external service is down or changed its response shape | Check `Logger.log` output in the Apps Script Execution log for the actual HTTP status/response captured by the `_translateViaX_`/`_generateQrCodeBlob_` functions |

## OCR Error

| Symptom | Cause | Fix |
|---|---|---|
| OCR never completes | Image is very large/high-resolution, slow on a low-end device | Use a smaller or cropped photo; Tesseract.js runs entirely in the student's browser, so performance depends on their device |
| Garbled/inaccurate text | Poor lighting, skewed angle, handwriting (harder than print) | Retake the photo straight-on with good lighting; expect lower accuracy on handwriting per Tesseract.js's known limitations |
| "Tesseract is not defined" in console | The CDN script tag in `ocr.html` failed to load (offline, or CDN blocked by network) | Check internet connectivity; Tesseract.js itself must download from the CDN even though recognition then runs locally |

## Translation Error

| Symptom | Cause | Fix |
|---|---|---|
| "Translation service is currently unavailable" | Both configured providers failed | Run `testTranslationProviders_manualOnly` (Tests.gs) from the Apps Script editor and read the Execution log — it tests each provider directly and tells you exactly which one failed and why, instead of guessing |
| LibreTranslate always fails | `libretranslate.com`'s official hosted endpoint now requires a **paid** API key for all requests — confirmed, this changed after this project was first built. It is deliberately excluded from the default `CONFIG.LIBRETRANSLATE_URLS` list | Confirm `CONFIG.LIBRETRANSLATE_URLS` points to free public mirrors (e.g. `translate.argosopentech.com`, `translate.astian.org`), not `libretranslate.com` itself. Public mirrors do rotate occasionally — search "LibreTranslate public instances" for a current list if both configured mirrors stop responding |
| MyMemory fails even though it's "free, no key" | MyMemory's free quota (5,000 chars/day) is tracked **per IP address**, and Apps Script's `UrlFetchApp` shares Google's outbound IP ranges with countless other scripts worldwide — the anonymous quota may already be exhausted by unrelated traffic, not your own usage | Set `CONFIG.MYMEMORY_EMAIL` to your school's email address — MyMemory grants a separate 50,000 chars/day quota tied to that email, no signup or verification needed, just the parameter |
| Translations are slow every time, never cached | `CacheService` cache was cleared (happens on redeploy/quota reset) or `CONFIG.CACHE_TTL_TRANSLATION` is very short | Expected behavior — cache rebuilds automatically as phrases are reused |

## File Upload Error

| Symptom | Cause | Fix |
|---|---|---|
| Upload hangs forever | File is too large — Apps Script has practical payload limits well under typical video file sizes | Compress the file, or keep video uploads short and use YouTube links for longer content (`attachLessonVideo`'s `youtube` option) |
| Uploaded PDF/image doesn't display for students | `setSharing` failed silently, or the Drive folder has restrictive organization-level sharing policies | Check the file's sharing settings directly in Drive; school Workspace accounts sometimes restrict "Anyone with the link" sharing org-wide — use a personal account's Drive folder if so |

## Access Denied

| Symptom | Cause | Fix |
|---|---|---|
| "FORBIDDEN: your role does not have access to this action" | Expected RBAC behavior (Security §1) — a student tried to call a teacher/admin-only function | Not a bug — confirm the user has the correct role for the action they're attempting |
| Teacher can't manage a class they should own | `Classes.TeacherID` doesn't match this teacher's `TeacherID` | Admin: re-check class assignment via `assignTeacherToClass` |

## Google Apps Script Error (general/uncategorized)

| Symptom | Cause | Fix |
|---|---|---|
| "Exceeded maximum execution time" | A function ran longer than 6 minutes (consumer account limit) — usually from looping over a very large sheet range cell-by-cell | Check for any custom code added beyond what was delivered that loops without batching; the delivered `Database.gs` already batches reads/writes per Architecture §8 |
| "Service invoked too many times for one day" | A specific Apps Script service (e.g. `MailApp`, `UrlFetchApp`) hit its daily quota | Wait for the daily reset; reduce call volume where possible (e.g. rely on caching, already built in) |
| Random "Lock timeout" errors during heavy concurrent use | Many users writing simultaneously and `LockService`'s wait timeout (10s, `DB_LOCK_TIMEOUT_MS`) was exceeded | Expected at higher concurrency per the documented scalability ceiling (PRD §9) — not a bug, a known limit of this free-tier architecture |

---

## Still stuck?

1. Open the Apps Script editor → **Executions** (left sidebar) to see the full stack trace of any failed run.
2. Re-run `runAllTests()` (Phase 18) to confirm core logic still passes — isolates whether the issue is in business logic or in a specific deployment/config detail.
3. Check the browser DevTools Console (F12) for client-side JavaScript errors, separate from server-side Apps Script errors.
