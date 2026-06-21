# Deployment

The complete deployment procedure — all 20 steps, each with the goal, exact clicks, what you should see, expected result, and common errors/fixes — lives in:

**→ [docs/19-DEPLOYMENT-GUIDE.md](docs/19-DEPLOYMENT-GUIDE.md)**

## Deployment model, in short

This app deploys as a single **Google Apps Script Web App**. There is no separate hosting step — Apps Script *is* the host. Deploying a new version (Deploy → Manage deployments → New version) is the only "release" mechanism; there's no CI/CD pipeline by design (see [PRD's absolute requirements](docs/01-PRD.md)).

## Before deploying to real students

Run through:
- [docs/18-TESTING.md](docs/18-TESTING.md) — automated test suite + manual QA checklist
- [docs/17-SECURITY.md §9](docs/17-SECURITY.md#9-pre-launch-security-checklist) — pre-launch security checklist

## After deploying

See [docs/22-MAINTENANCE-GUIDE.md](docs/22-MAINTENANCE-GUIDE.md) for ongoing operational tasks (automatic vs. manual), and [docs/21-TROUBLESHOOTING.md](docs/21-TROUBLESHOOTING.md) if something doesn't work as expected.
