# Daily collection, public inventory and duplicate control

## Current boundaries

**Operational status, 7 November 2026:** the GitHub runner also received HTTP 403
([run evidence](https://github.com/Mugweru01/homara-atlas/actions/runs/42408145568)).
The daily workflow is disabled and the source is paused indefinitely; no further
automated requests are made. Its blocked job and access reason are visible in
Atlas. Previously collected licensed statistics remain published. Daily refresh
is prepared but **not operational**. Obtain an approved access route or choose a
different permitted feed before clearing the source pause and re-enabling the
workflow. Do not retry through proxies, change identity or bypass a challenge.

**Homara remains completely hidden**, including from a staff-facing property
console. Its confidential observations are not exposed by the new listings,
geography, collection-status or benchmark endpoints. No change enables public
publication of that feed. The database prohibition and API-role RLS remain.

Public listing inventory requires a separately permitted source. Visibility on
a website and permissive robots rules are not a licence to copy its content.
No fabricated consent, sample listing inventory or scraped customer identities
are used to fill the interface.

### Reviewed sources, 7 November 2026

| Source | Result | Collection status |
| --- | --- | --- |
| [Jiji](https://jiji.co.ke/rules.html) | Terms 7.16 require consent for copying/distributing user content; 7.17 restrict user-information collection. Its robots file does not itself license reuse. | Individual listing collection disabled pending consent |
| [BuyRentKenya](https://www.buyrentkenya.com/legal) | Written consent required for mining/scraping content for another website | Disabled |
| [Property24 Kenya](https://www.property24.co.ke/terms-and-conditions) | Automated monitoring/copying and unpermitted republication prohibited | Disabled |
| [Hauzisha](https://hauzisha.co.ke/terms-of-use/) | Listing crawling and republication on another property site prohibited | Disabled |
| [Kenya Property Centre](https://kenyapropertycentre.com/terms-of-use) | Published **market statistics** licensed CC BY 4.0, with reasonable robots-compliant automated access expressly permitted. Individual listings, photos and descriptions excluded. | Paused after cloud HTTP 403; approved access route needed |

Public review decisions and approved collector health are visible on
`/listings` and through GET `/api/v1/collection/sources`. Confidential feeds,
credentials, raw HTML and private jobs are excluded from that endpoint.

## Published market-statistics collector

The fixed source is
[Kenya Property Centre's published index page](https://kenyapropertycentre.com/market-trends/average-prices).
The collector fetches robots.txt, checks the current terms/automation exception,
and reads that single report page. It collects only licensed JSON-LD national
figures and exact numeric county-table attributes. It never visits individual
listing pages or copies advertiser content.

Attribution, source links, CC BY 4.0, reference month, sample sizes when supplied
and publisher methodology accompany the data. The initial supported scope is
national and county monthly rent, sale asking-price and short-let nightly
benchmarks. A daily check does **not** make monthly statistics daily observations.
These data remain separate from Atlas-derived property estimates and individual
listing counts. Missing values are not converted to zero or guessed from rounded
K/M display strings. Publisher sample thresholds are not represented as Atlas's
own 30-observation publication threshold.

`atlas_core.market_benchmarks` is append-only. Its unique source/series/reference
period/content-hash constraint makes repeated unchanged downloads idempotent.
Corrections create a new version of the same period; the API selects the latest
version and latest reported month per series. Raw evidence contains sanitized
records and document/terms/robots SHA-256 hashes, not downloaded HTML or contacts.

Activate only the licensed statistics source through the owner workflow:

```sh
node --env-file=.env.local scripts/register-market-collector.mjs --activate
```

This source has a prepared daily schedule (currently paused). Its licence check,
schema check or robots failure blocks collection rather than silently publishing
unverified values.

## Approved individual-listing crawler

The JSON-LD adapter is prepared for providers whose permission and data contract
have been reviewed. It is **not enabled for Jiji or any restricted source**.
No generic internet-wide crawler or arbitrary browser-fetch endpoint is exposed.

An owner prepares a configuration file with these fields:

```json
{
  "slug": "approved-provider-monthly-rent",
  "name": "Approved provider monthly rental advertisements",
  "origin": "https://provider.example",
  "path_prefix": "/properties",
  "seed_paths": ["/properties"],
  "listing_type": "rent",
  "max_pages": 10,
  "permission_url": "https://provider.example/public-reuse-policy",
  "license": "Provider permission on file; scope must be verified",
  "attribution": "Approved provider; public advertisement facts only"
}
```

The example is illustrative and is not a permitted or enabled provider.

```sh
node --env-file=.env.local scripts/prepare-listing-crawler.mjs reviewed-config.json
```

Preparation creates a **pending** source with publication disabled. Before
enabling it, verify actual permission/terms and the parser contract, set an
appropriate review/rights expiry, and add the exact hostname to the **worker's**
`ATLAS_CRAWLER_ALLOWED_HOSTS`. Ingestion approval and public listing-display
permission are separate audited decisions. Never put service credentials,
signed private-document URLs or customer details in public attribution/permission
metadata. There is no browser credential or user-configurable fetch URL.

The supported contract requires a stable advertisement `sku`, `productID` or
string `identifier`, a canonical individual URL, an explicit county, supported
property type, positive KES price, and explicit monthly unit for rent. Missing
identities, units or county mappings go to quarantine; they are not invented.
Addresses, seller objects, contacts, free-text descriptions, photos and scripts
are not retained. HTML is parsed without executing JavaScript. Explicit unavailable
offers become withdrawn advertisements, never a fabricated sold/let transaction.

The crawler follows only links on the reviewed HTTPS origin and narrow path
prefix. It rejects credential-bearing URLs, IP literals, secret-like query keys,
off-origin redirects and encoded path escapes. DNS answers are checked and pinned
at connection time; loopback/private/link-local/reserved/mapped/tunnel addresses
are denied. TLS certificate verification stays enabled. No proxies, CAPTCHA
bypasses, login cookies or access-control circumvention are used.

Each invocation has a 120-second overall deadline, 10-second socket timeout,
2 MiB response/decompression limit, at most ten pages, and a one-second delay
between pages. A frontier contains at most 1,000 discovered/visited URLs and
1,000 extracted records per batch. Capacity exhaustion is a visible failure,
not an assertion that the whole site was collected. An empty-looking page without
an explicit empty collection or previously parsed records is treated as a schema
failure, preventing false-success collection after a template/login-wall change.

## Scheduling and recovery

The KPC statistics collector uses `.github/workflows/daily-market-collection.yml`
at **03:00 UTC / 06:00 Nairobi daily**, with manual dispatch for recovery. GitHub
may delay or miss scheduled runs; inspect Actions and dispatch a catch-up when
needed. The production Neon network returned HTTP 403 from this source, so this
feed uses an ordinary Actions runner. No proxy rotation or challenge bypass is
used. If the runner is denied too, collection fails and must remain blocked.

The runner has only `ATLAS_KPC_COLLECTOR_TOKEN`, never database, storage, internal
worker or Homara credentials. Rotate this random source-scoped bearer token in
the API environment and GitHub secret together. The fixed HTTPS destination
rejects redirects. POST `/api/v1/collector/kpc` validates a bounded, exact-key
statistics envelope and queues only the fixed approved statistics source; GET
`/api/v1/collector/kpc/jobs/:id` reveals only that collector's jobs. Both require
the token before database access and have a separate 30/minute budget. The API's
global 1 MiB body limit also applies. Queue capacity is five pending jobs. The
worker validates again and checks county names before preserving sanitized
evidence. Replays reuse an idempotency key; unchanged figures add no new rows.
This token cannot approve a source, enable listing display or inspect other jobs.
Failures before submission are visible in the Actions run; last-success age
continues to report freshness through the public collection status.

Verified on 7 November 2026: the initial live import accepted 21 benchmarks;
an immediate repeat accepted zero and identified all 21 as unchanged duplicates.
Those are published statistics, not 21 advertisements.

The hourly authenticated worker trigger reconciles due sources. Approved listing
crawls resume bounded batches from a durable `crawl_frontier` in the source
watermark; partial cycles continue hourly and the next cycle is anchored to
24 hours after the previous cycle started, without adding a fresh idle day after
a long crawl. Scheduled slots advance from their due time, so hourly-trigger
jitter does not drift daily sources by another hour each day. The cursor,
accepted observations, quarantine, private evidence and
job status commit together. Failure before commit leaves the previous cursor
intact, so replaying a page cannot lose the work or create a second listing.

Leases/fencing prevent two jobs from processing one source concurrently. Transient
failures retry with backoff; `Retry-After` on HTTP 429/503 pauses the entire source
as well as the current job, so a newly scheduled job cannot bypass the pause.
Retries are bounded. Failed/schema-blocked jobs, stale successful collection,
pending pages and source review state stay visible. If the provider remains
unavailable, collection remains incomplete until it recovers or an operator acts.

There is **no honest zero-failure guarantee** for third-party websites. Missed
triggers are reconciled on the next worker run; absent historical snapshots are
not fabricated. Daily completeness also depends on source size and the configured
free-plan request/page budgets. Public source status is the operational signal;
external alert and off-device backup delivery remain disabled at the owner's
request.

## Exactly what duplicate protection means

- `(source_id, source_listing_id)` is unique: repeated imports reuse one advert.
- Canonical URL ownership is source-scoped. A different advert ID reusing an
  existing URL is quarantined as `canonical_url_identity_conflict`; it does not
  silently create another listing or merge potentially different units.
- Canonical URL references have a composite source/listing foreign key. Runtime
  worker updates can change only first/last-seen timestamps on listing identity
  rows, not move identities to another source.
- Same-instant identical observations are duplicates; same-instant conflicting
  values are quarantined. Daily observations and genuine price/availability
  changes are history of one advert, not duplicate listing rows.
- Unknown bathrooms are omitted from normalized hash input to preserve legacy
  replay hashes. Known bathroom changes remain material observations.
- A consistent frozen inventory feeds each publication's counters, provenance and
  statistics. Migration 014 invalidates the old current pointer independently of
  potentially incomplete historical provenance; evidence is retained.
- The same physical property under different URLs/IDs or on different websites
  is **not universally identifiable** without dependable identifiers. Reviewed
  entity matches remain necessary; heuristic similarity must not silently merge
  neighbouring units or claim a guarantee it cannot support.

## Public API and UI

| Route | Scope |
| --- | --- |
| `/locations` | All 4,835 imported reference places, eight former-province groups, six levels, county filters, search, parent details and page exports |
| `/counties` | Existing county map/IDs with historical census metadata and links into the full explorer |
| `/listings` | Only separately approved public advertisements; clear empty state and source-permission/collector status |
| `/market` | Published licensed benchmarks, with independent Atlas-derived statistics below |
| GET `/api/v1/geography/regions` | Former-province groups and public county-reference counts |
| GET `/api/v1/listings` | `county_id`, `listing_type`, `property_type`, `limit`, `offset` |
| GET `/api/v1/research/benchmarks` | `market_type=rent|sale|short_let`, `county`, `limit`, `offset` |
| GET `/api/v1/collection/sources` | Public source reviews and approved collector status; no arbitrary parameters |

All API queries use bound parameters and explicit projections. Unknown/repeated
query parameters are rejected. Public inventory additionally requires current
source ingestion/publication rights, separate detail-display permission, approved
county labels and freshness. Homara cannot be enabled for those outputs. No UI
inventories or statistics are filled from confidential observations.

The shared API/geography budgets protect resource costs. Anonymous clients cannot
be securely identified from spoofable IP headers on the native Function ingress;
one caller can exhaust a shared public budget and cause temporary 429 responses.
That availability limitation is not presented as solved per-client isolation.
Do not introduce untrusted forwarding-header buckets. Trusted edge identity or
verified per-client credentials are required before claiming client fairness.

## Deployment and checks

Apply forward migrations 014–018 through the reviewed owner workflow, deploy the
API/worker, then activate the permitted statistics source. Keep the generic worker
host allowlist empty until an individual-listing provider is actually approved.
Deploy the frontend after its corresponding endpoints are available.

Run the backend suite in the isolated validation database. It covers source/URL
identity conflicts, private feed exclusion, separate display permission, immutable
benchmark deduplication, source-wide retry pauses, network/robots guards, inert
HTML parsing, discarded contacts, strict units/IDs, licence/schema changes,
geography regions and existing authentication/publication protections. Validate
the live market collection twice: the second unchanged crawl must add no benchmark
duplicates. Test every location level, filtered pagination and source credits on
desktop/mobile. Confirm public inventory remains empty until a public listing
source has genuine display rights.
