# Troubleshooting

The full troubleshooting reference — organized by error category (Permission Denied, Deployment Failed, Spreadsheet Not Found, Login Failed, API Error, OCR Error, Translation Error, File Upload Error, Access Denied, Google Apps Script Error) — lives in:

**→ [docs/21-TROUBLESHOOTING.md](docs/21-TROUBLESHOOTING.md)**

## Fastest way to self-diagnose

1. Apps Script editor → **Executions** (left sidebar) — shows the full stack trace of any failed run.
2. Browser DevTools (F12) → **Console** tab — shows client-side JavaScript errors, separate from server-side errors.
3. Run `runAllTests()` from [`backend/Tests.gs`](backend/Tests.gs) — confirms whether core logic (grading, hashing, validation) still works, isolating the problem from deployment/config issues.
