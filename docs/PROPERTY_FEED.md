# Confidential Homara property ingestion

Atlas stores its data in Neon. Homara's existing listing database is an upstream
source, not a second Atlas database. Location-reference expansion is deferred.

## Confidentiality boundary

The owner approved ingestion of public property advertisements and subsequently
required that Homara listings and user data never be exposed through Atlas.
Accordingly, this feed is **private ingestion only**. It contributes neither
individual listings nor aggregates to any public Atlas response.

- The original anonymous export function has no client execution grants.
- The replacement export requires a separate 256-bit secret in the POST body.
  Only its SHA-256 hash is stored in a restricted source-side schema. Missing
  configuration, missing secrets and incorrect secrets deny access.
- Atlas uses a publishable source API key plus this narrowly scoped secret.
  It receives no Supabase service-role key and cannot access customer workflows.
- The secret is configured only on the ingestion worker. It is never placed in
  frontend variables, URLs, raw evidence objects, job payloads or audit details.
- Neon enforces `publication_allowed=false` and `listing_details_allowed=false`
  for this driver. Even an administrative publication update cannot override
  the database constraint.
- Row-level policies hide its listing identities, observations and raw-artifact
  metadata from the API database role. The worker retains ingestion access.
- Public source health excludes this confidential feed. Public sources,
  comparisons, coverage, market snapshots and comparables exclude its records.
- Raw artifacts remain in a private bucket; there is no public raw-download route.

These controls cover Atlas and its export integration. They do not change what
Homara itself intentionally displays on its existing public website.

## Fixed data contract

The source projection contains only advertisement ID, county, listing type,
property type, bedrooms, bathrooms, asking price and source update time. Atlas
adds its observation time, source identity and provenance. It never imports
owner/landlord IDs, names, contacts, messages, applications, descriptions, free
text location descriptions, exact coordinates or photographs.

Only active, approved, unexpired monthly rental and sale advertisements are
eligible. Third-party source tags and nightly accommodation are excluded.
Monthly rental prices use `monthly_rent`, falling back to the public
`price_kes` field; sales use `sale_price`, then `price_kes`. Unmapped property
types/counties and invalid prices enter quarantine, without invented values.
Unknown dimensions and neighbourhoods remain null.

The connector uses one fixed HTTPS RPC origin, rejects redirects, limits each
response to 1 MiB, validates the exact schema and monotonically increasing page
IDs, and accepts at most ten pages of 500 records. Capacity or schema failures
fail the job instead of silently accepting a truncated dataset.

## Operation

Apply the source integration through Homara's Supabase MCP migration workflow.
Provision the hash in `atlas_export_private.settings` without logging the secret.
Configure `ATLAS_HOMARA_PUBLIC_KEY` and `ATLAS_HOMARA_FEED_TOKEN` only in the
worker environment. Apply Neon migrations 010–012 before deploying the worker.

The database owner runs `node --env-file=.env.local scripts/connect-homara.mjs
--activate` once to record approval and register the confidential source. The
existing hourly worker trigger checks for due sources; this feed refreshes daily.
Durable jobs retain retries, leases, counts, quarantine codes, checksummed private
evidence and append-only history. An empty export is a successful empty snapshot.
Disappearance never proves that a property was sold or let.

To stop ingestion, an administrator disables or revokes the source. To rotate
the feed secret, update its source-side hash and the worker secret together,
then verify missing/wrong secrets still deny access and the worker can ingest.
Do not enable publication or listing-level display for this driver.

Backups and operational-alert delivery remain disabled pending the owner's
choice of destinations. The existing encrypted local backup tooling is unchanged.

## Verification

Backend tests cover the fixed projection, redirect rejection, pagination,
county/type mapping, source-scoped storage, empty exports, private artifact and
observation visibility, and the database publication prohibition. Live checks
must additionally confirm source export denial without the secret, successful
worker ingestion, and no Homara identifiers, prices or counts in public outputs.

On 7 November 2026, all 24 backend tests passed. Production checks confirmed a
successful initial ingestion, denied exports with missing/wrong secrets, denied
access to the retired export, no confidential feed records visible to the API
database role, and HTTP 403 for an unsigned raw-object request. Sources, health,
market, coverage and comparables responses contained no Homara feed records or
derived figures. No frontend files changed.
