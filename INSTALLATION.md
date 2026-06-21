# Installation

## Prerequisites

- A Google account (free Gmail is fine — no Google Workspace required, see [Architecture §9](docs/02-ARCHITECTURE.md#9-design-decisions--rejected-alternatives) for why custom auth was chosen specifically so this works)
- A web browser
- That's it — no terminal, no Node.js, no npm, no Docker, no credit card

## Full instructions

This file is intentionally short — the complete, click-by-click installation and deployment process (with screenshots-equivalent descriptions, expected results, and error fixes at every step) lives in one place to avoid two documents drifting out of sync:

**→ [docs/19-DEPLOYMENT-GUIDE.md](docs/19-DEPLOYMENT-GUIDE.md)**

Covers, in order: creating the spreadsheet, building the database structure, adding all backend and frontend files, configuring `Config.gs`, deploying as a web app, and testing every major feature.

For the database schema specifically (what to create and why), see [docs/04-GOOGLE-SHEETS-SETUP.md](docs/04-GOOGLE-SHEETS-SETUP.md) and [docs/03-DATABASE-DESIGN.md](docs/03-DATABASE-DESIGN.md).

## Time estimate

45–60 minutes for a first-time deployment. See the 30-Minute Quick Start at the bottom of the Deployment Guide once you've done it once before.
