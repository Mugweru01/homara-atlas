# Homara Atlas — Neon readiness report

Backend/database operations below are superseded by [the backend runbook](docs/BACKEND_RUNBOOK.md). Earlier frontend work in this report predates the backend-only milestone.

Updated: 5 November 2026. Continues PR #40. The user narrowed scope to free-plan services and explicitly removed AI inference.

## Delivered

- Verified organization `org-soft-bread-75702162`, project `withered-cell-31446643`, production branch `br-tiny-cake-bb448b4a`, region `aws-us-east-1`.
- Updated Neon CLI to 8.23.1, signed out the old session, and completed fresh browser authentication.
- Deployed the `atlas` Function with PostgreSQL, existing Managed Auth, private `assets` storage, and Realtime. AI configuration and UI have been removed; no billing upgrade was performed.
- Tested the additive SQL migration on an isolated branch before applying it to production. Existing Neon Auth data was preserved. The temporary validation branch and verification accounts/reports were cleaned up.
- Wired the SPA to the deployed API and Auth. Added private report creation/download, owner authorization, live updates, renewal before capability expiry, and protection against writes after a session change.
- Replaced hardcoded price/neighbourhood statistics with warehouse queries. Empty datasets display an explicit empty state. Affordability and maps explicitly await income/geographic datasets.
- Added an operator-only, transactional JSON importer. It validates entire batches before writing, upserts by listing ID, rejects explicitly synthetic sources, and prevents older snapshots overwriting newer records. Operators remain responsible for source verification.
- Added DATABASE_URL support to the existing Python API and a PostgreSQL path for its analytics. Synthetic ingestion is disabled when deployed against a database. Legacy Supabase SQL was not applied.
- Repaired build validation, actual TypeScript checking, frontend tests, CI directories, Docker healthchecks/static hosting, deployment configuration, and the root build/dev commands.
- Fixed pre-existing pagination/chart/error-reporting type errors. Updated compatible dependencies and pinned patched transitive Auth/Zod dependencies.

## URLs

- Frontend preview: https://homara-atlas-i8styuatl-edwins-projects-f08b7343.vercel.app
- Deployed API: https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech
- API health: https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech/api/v1/system/health
- Local app: http://127.0.0.1:5184

The preview was built and deployed successfully by Vercel. Browser flows were exercised locally against the deployed Neon services. The production frontend alias was not promoted. The preview's exact origin was added to Auth, Function CORS, and Realtime allowlists.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm run build` | Passed, with real public Neon URLs; no dummy Supabase variables |
| `npm run type-check` | Passed against both frontend TypeScript projects |
| `npx tsc --noEmit` at root | Passed for Function code |
| `npm run lint` | Passed; seven existing Fast Refresh warnings remain |
| `npm test` | Three frontend environment tests passed |
| `.venv/Scripts/python.exe -m pytest tests -q` from `api` | Nine backend tests passed |
| Black / syntax-error Flake8 checks | Passed |
| Deployed Function health and PostgreSQL analytics read | Passed |
| Two-user Auth signup, signout, signin, session restoration | Passed |
| Missing/invalid JWT rejection | Passed (401) |
| Private report write + presigned download | Passed; downloaded content matched |
| Cross-user report access | Passed (404; other user's list empty) |
| Realtime committed update | Passed; inserted report reached an active subscription |
| Browser signup, report save, reload, signin, signout | Passed |
| Browser Realtime renewal | Remained live beyond the initial capability lifetime |
| Importer write, stale snapshot protection, invalid batch/synthetic rejection | Passed on the isolated validation branch |
| Final backend deployment | Deployment 4 reports `completed` |
| Frontend dependency audit | Zero high/critical; 18 lower-severity advisories remain (7 low, 11 moderate) |
| Root dependency audit | Zero vulnerabilities |

Auth emails were disabled in the existing project configuration; test signups did not require email delivery. Signout clears the browser session; already-issued JWTs retain their normal expiry.

## Run locally

Use Node 22+ (the current Windows session uses Node 24) and the existing Neon login.

```powershell
npm ci --ignore-scripts
npm --prefix apps/web ci --ignore-scripts
neon link -y --org-id org-soft-bread-75702162 --project-id withered-cell-31446643 --branch production --no-env-pull --no-config
neon env pull --file .env.local
```

Copy only the public URLs to `apps/web/.env.local`:

```dotenv
VITE_API_URL=<NEON_FUNCTION_ATLAS_BASE_URL>
VITE_NEON_AUTH_URL=<NEON_AUTH_BASE_URL>
VITE_NEON_REALTIME_URL=<NEON_REALTIME_URL>
```

```powershell
npm run dev
```

The local environment files have already been populated in this workspace and are ignored by Git. Database, storage, sealing, and CLI credentials remain server-side. Never copy these credentials into VITE_ variables.

## Operations

Review `neon config plan --env .env.local` before future deployments. The Function explicitly declares `NEON_REALTIME_SECRET` because this runtime did not inject it; it must be available from the selected branch's environment file.

```powershell
npm run db:migrate
neon deploy --env .env.local --update-existing
npm run smoke:neon
node --env-file=.env.local scripts/import-listings.mjs reviewed-listings.json
```

The smoke script creates temporary example.test users/reports and cleans them up. It uses the existing Auth configuration with signup emails disabled. Do not run it in an environment that sends signup mail without reviewing that behavior.

Each importer record needs `listing_id`, `county`, `neighbourhood`, `property_type`, `listing_price_ksh`, `asking_rent_ksh`, `size_sqft`, `bedrooms`, `source`, and `extracted_at`. Prices/rent must be finite nonnegative numbers; size must be positive; bedrooms must be a nonnegative integer. Batch limit: 10,000 records. Use a previously reviewed public source and timestamp, not synthetic/demo records.

Vercel uses the root vercel.json to install/build the frontend and serve SPA routes. The three public URL variables are also configured as GitHub repository variables for the production workflow. Server credentials are not stored there. A frontend preview deployment can be created with `node --env-file=.env.local scripts/deploy-preview.mjs`; add each new preview origin to the backend/Auth/Realtime allowlists before testing its authenticated flows.

## Remaining launch limits

1. There are zero verified listings in production. Import an approved dataset before describing the product as a source of live Kenyan market intelligence.
2. Historical price indices require historical observations; affordability needs income data; heatmaps need verified coordinates. These are explicit unavailable states, not fabricated metrics.
3. Eighteen lower-severity dependency advisories remain. No high/critical advisories remain in the frontend audit. Forced framework-major upgrades were not made.
4. The frontend is deployed as a preview; the production alias has not been promoted. GitHub-hosted CI has not run on these unpushed changes.
5. Docker configuration was repaired but Docker images were not built in this session. The Python API remains an optional compatibility/local backend; deployed application flows use the Neon Function.

The original NEON_HANDOFF.md remains as the historical record. This report supersedes its authentication/build/deployment blockers.
