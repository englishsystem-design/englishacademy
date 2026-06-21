# Database Setup

This project uses Google Sheets as its database — 21 sheets, one spreadsheet, set up by running a single script (no manual column-typing required).

## Quick steps

1. Create a new Google Spreadsheet.
2. Extensions → Apps Script.
3. Paste in [`backend/Setup.gs`](backend/Setup.gs).
4. Run `createDatabaseStructure`.
5. Verify 21 tabs appeared, `Modules` has 43 rows, `Roles` has 3 rows.

## Full schema reference

Every sheet, every column, every data type, every relationship, and every validation rule is documented in:

**→ [docs/03-DATABASE-DESIGN.md](docs/03-DATABASE-DESIGN.md)**

## Full setup walkthrough

Click-by-click instructions (including what to do if something goes wrong) are in:

**→ [docs/04-GOOGLE-SHEETS-SETUP.md](docs/04-GOOGLE-SHEETS-SETUP.md)**
