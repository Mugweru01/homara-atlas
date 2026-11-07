# Atlas backend and database

This backend milestone supersedes the older importer and warehouse instructions in NEON_READINESS.md. No files under apps/web were changed during this milestone. AI inference is disabled; no paid upgrade was made.

## Architecture and evidence

Public source → durable job → bounded allowlisted download → private checksum-addressed raw object → validated append-only observations → atomic publication → read API. Managed Auth supplies signed identities. Server-side operator grants control ingestion. API and worker use separate non-administrative database logins; owner credentials are reserved for migrations and recovery.

The production project is `withered-cell-31446643`, branch `production`, region `aws-us-east-1`. The API is https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech/api/v1 . The worker is a separate function and does not accept public execution.

Verified external data on 5 November 2026: 104 annual Kenya observations from World Bank WDI and 47 geoBoundaries county boundaries. These are context, not housing listings. No partner feed is approved and no property portal is scraped. Current market statistics are therefore unavailable, rather than fabricated.

## Sources and permitted use

World Bank: fixed Kenya/source-2 queries for population, urban population share, inflation and GDP per capita from 2000. Daily refresh. WDI is CC BY 4.0; preserve attribution. GDP per capita is not household income. See https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators and https://datacatalog.worldbank.org/public-licenses .

geoBoundaries: fixed KEN/ADM1 metadata and its allowlisted simplified geometry. Weekly refresh. Metadata identifies 47 counties, vintage 2020, underlying Public Domain source, RCMRD/Africa GeoPortal; retain attribution. Boundaries are administrative context, not cadastral evidence. See https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/ . Connector fails closed when license or completeness checks change.

New listing sources start pending. An administrator must register the source, its license, permission URL and attribution, then explicitly approve ingestion and separately enable publication. Approval is a human rights decision: owning an account or finding a public page is not reuse permission. Set a rights expiry when applicable. Revocation prevents new processing and immediately invalidates publications containing that source.

## Database model and correctness

- `atlas_control`: source registry, durable queue, artifact manifests, quarantine, publication requests and append-only audit.
- `atlas_core`: source-scoped advertisements, optional reviewed physical-property links, immutable listing observations, geography versions and annual indicator revisions.
- `atlas_mart`: versioned releases, source lineage, protected current release and county asking-price summaries.
- `atlas_security`: owner-managed operator grants and hashed request-budget windows. Report ownership is also enforced by transaction-local RLS on `public.atlas_reports`.
- `atlas_meta`: checksummed migration ledger. Existing migration files must never be edited after application.

Advertisement identity is `(source_id, source_listing_id)`. An observation is unique for a listing and observation instant. Identical retries are duplicates; conflicting data for the same instant is quarantined. New observations preserve previous values. Do not update or delete evidence to correct it: submit a later corrected observation. Jobs retain received, accepted, rejected and duplicate counts and artifact lineage.

Market methodology `asking-market/1` uses the latest observation, active within 14 days, from approved publishable sources. Sale and monthly rent are different populations; weekly/daily rents are excluded from monthly estimates. Prices are KES. Missing areas stay null; floor and plot areas differ. Sample sizes below 30 suppress price estimates. Reviewed duplicate advertisements count as one physical property. These are asking statistics, not achieved sales, a historical price index or neighbourhood-level estimates. Old dbt/demo models and `public.stg_kenya_listings` are not the canonical production data path.

## Deployment and operations

Location reference data is stored in `atlas_geo`, using immutable releases and
read-only, approval-gated publication views. The API cannot read base tables or
write the active-release pointer. The pinned source is **kenya-locations by David
Amunga and contributors**, with data licensed CC BY 4.0. Follow the
[location integration runbook](LOCATION_REFERENCE.md) for import validation,
county identity preservation, attribution, API limits, updates and rollback.
Static reference imports are excluded from scheduled collection and cannot be
queued through the operator job API. Encrypted backups include `atlas_geo`;
off-device backup and alert delivery remain disabled.

Use Node 24 and `npm ci --ignore-scripts`. Run `npm run check:functions` and backend tests before deployment. CI tests against PostgreSQL 18 with separate runtime roles and no cloud credentials. Cloud integration tests require the isolated `codex-backend-validation` branch and its dedicated role env file; never point tests at production.

1. Authenticate Neon CLI to the owning account. Pull production services into an ignored owner env file. Never commit an env file.
2. Run `node --env-file=.env.local scripts/migrate.mjs` using a direct owner connection. Migrations are locked, transactional and checksum checked; repeated execution is safe.
3. Provision roles with `scripts/provision-backend.mjs`; preserve existing internal/rate secrets when repeating. Combine managed service variables and the generated dedicated-role variables into an ignored deployment env file.
4. Deploy with `node --env-file=<production-env-file> <neon-cli-path> deploy --branch production`. The CLI can overwrite root `.env.local` when deploying another branch: always restore production with an explicit `neon env pull --branch production --file .env.local ...` before production operations.
5. Check `/system/ready`, `/system/data-health`, `/sources`, `/geography/counties`, `/context/indicators` and `/analytics/overview`. Readiness verifies the dedicated API role; data health reports upstream freshness separately from liveness.

The `atlas-hourly` trigger runs at minute zero UTC in production only. It schedules due sources, recovers expired job leases, retries failures, cleans report deletion intents and republishes stale inventories. Operator requests kick the worker immediately with an internal secret; the durable queue remains the fallback. Jobs use fenced leases, bounded retries/backoff and one running job per source. Inspect failed/retry jobs and their quality issues; a changed schema/license needs review rather than unlimited retries.

Grant access only to an existing Managed Auth account: `npm run db:operator -- grant <email> admin` (or `operator`), and revoke with `npm run db:operator -- revoke <email>`. Grants are audited and checked on every protected request; client role claims cannot grant access. No operator account is created automatically.

Submit an approved manual feed with `ATLAS_OPERATOR_TOKEN` and `NEON_FUNCTION_ATLAS_BASE_URL` using `node scripts/import-listings.mjs <source-uuid> <file.json>`. Payload is `{ "records": [...] }`, maximum 1 MiB/1,000 records, no contacts, descriptions or unknown fields. County IDs must come from the geography API. Never send owner database credentials to a feed operator. Use an Idempotency-Key for every enqueue; reuse with a changed payload fails.

Quarantine acknowledgment records review, not acceptance. Correct records in a new batch. Admin entity matching requires an explicit review reason and is reversible with an audited unmatch; no fuzzy automatic merge occurs. Raw manual replay reuses the exact stored artifact; automatic replay fetches the current upstream release.

The manual-import CLI defaults to the production Atlas origin and rejects HTTP, URL credentials, query strings, fragments and unexpected hosts before reading the chosen file. To import into a deliberately trusted isolated branch, set `ATLAS_IMPORT_ALLOWED_ORIGIN` to that branch's exact HTTPS origin as well as its API URL. Redirects remain disabled. Never set this override from an untrusted feed or document.

## Security and capacity

JWT verification requires the configured issuer, EdDSA signature, subject and expiry. Reports use both owner predicates and database RLS; private downloads expire after 60 seconds. Creation reserves a pending row before upload, and failed/deleted uploads enter a durable deletion outbox. Pending uploads older than one hour are swept. A user may retain at most 100 reports.

Neon Realtime cannot query RLS-protected tables. `public.atlas_report_live` therefore contains only ready-report metadata, maintained in the same transaction by a restricted security-definer trigger. API and worker logins cannot read this projection directly. The authenticated backend seals only the exact owner-filtered, bounded query; the capability expires and cannot be edited by the client. Report content and download keys are never in this projection. The projection is deliberately not RLS-enabled because of the provider limitation; its boundary is the provider-managed sealed-query channel and database grants.

Queries are parameterized. Requests, pagination, record counts, strings, remote bodies and fetch duration are bounded. Connector URLs and every redirect are allowlisted; source registration never enables arbitrary outbound fetching. Nested fields and URL credentials/query strings are rejected from manual records. Logs contain request IDs/error codes, not tokens or payloads. CORS permits only configured origins; it is not used as authentication. Database failures return generic errors and fail closed.

Rate budgets are database-backed: 600 API requests/minute globally and 60/minute per authenticated identity. No caller IP header is trusted. The global budget protects free resources but one abusive caller can exhaust it; an edge WAF and traffic monitoring are future scale controls. DB pools are bounded. Private raw storage has a 200 MiB application budget; exhausted budgets stop ingestion rather than delete provenance. Free plans are finite: inspect provider usage and `/system/data-health`; quotas or upstream outages can delay collection. No claim of unlimited capacity or zero future errors is made.

## Backup and recovery

`npm run db:backup` writes an AES-256-GCM encrypted snapshot of Atlas-owned schemas plus all referenced raw artifacts and ready reports. PostgreSQL and object checksums are captured with a consistent exported database snapshot. Use a separate random 32-byte base64 `ATLAS_BACKUP_KEY` in `.env.backup.local`; retain an off-device copy of encrypted backups and store the key separately. Backups are bounded to the small-project storage budget and fail if an object is missing.

Managed Auth identities/configuration and provider infrastructure are **not** included in this portable dump. They require Neon/provider recovery. Database roles and service configuration must be provisioned separately on a new project. This is not a substitute for provider-level disaster recovery.

Restore drills require both `NEON_BRANCH` and `ATLAS_RESTORE_CONFIRM` equal to `codex-backend-restore`; the script also checks the actual connection hostname against that branch via the authenticated CLI. Never restore over production. Pull that isolated branch's Postgres/storage variables, then run `node --env-file=<restore-env> --env-file=.env.backup.local scripts/restore-backend.mjs <backup.enc>`. Compare observations, counties and object checksums before adopting a recovery. Clean up the drill branch afterwards. The current backup is local; scheduled off-device backups are not yet configured and require an independently retained destination/key.

The 5 November drill restored 104 indicators and 47 counties into the isolated branch, read back all three raw objects and verified their original SHA-256 hashes. An incorrect encryption key was rejected. Provider-owned default ACL entries are excluded during restore; explicit Atlas table grants are retained. Apply newer forward migrations after restoring an older snapshot.

For an ingestion incident, disable/revoke the source, inspect jobs/quarantine/artifact hashes and deploy a reviewed connector fix. For a credential incident, rotate the affected runtime login/internal token/storage credentials and redeploy both functions. For an API regression, redeploy the previous backend; use forward migrations and a tested restore branch for destructive schema recovery. Do not roll back by dropping production evidence tables.
