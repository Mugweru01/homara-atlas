# Research studio: evidence, assumptions and context

Implemented 8 November 2026. Atlas is an aggregated research product, not a
property-advert directory. Homara observations are excluded from these features.
No advertiser contacts, images, descriptions or property-level records are
published. `/listings` redirects to research confidence; the legacy JSON listing
and comparable-detail endpoints return HTTP 410 even when a source has display
permission. This is a product-wide boundary, separate from ingestion rights.

## Product surfaces

Open `/research`. Tool selection, comparison counties, focus county, market and
reference month are shareable URL state. Comparing one to four counties keeps
the scope readable. The focus county controls amenities, infrastructure and new
watchlists; it defaults to Nairobi when selected. Rent, sale and short-let
populations stay separate. There is no composite investment ranking.

| Tool | Behaviour | Evidence limits |
| --- | --- | --- |
| Compare areas | Side-by-side publisher asking figures, reference months, samples, historical census context and captured amenity counts | Broad publisher populations are not matched property segments; amenity counts measure dataset coverage, not service quality |
| Investment scenarios | User-entered nominal-KES rent, vacancy, expenses, acquisition costs, deposit, fixed interest, term and rent/expense growth; ten-year cash flow and exports | Illustrative defaults are assumptions, not market averages; no automatic appreciation, tax calculation, insurance or lender fees |
| Market history | Reference-month slider, honest single-point charts, exact values and source table | Only actually captured months; initial property benchmark coverage has one month, not a manufactured historical series |
| Market activity | Newly observed adverts, explicit withdrawals, latest price reductions and median observed duration | Minimum 30 fresh distinct entities per county; no measured buyer demand, disappearance inference, achieved transaction or sell-through claim |
| Amenities | Search category, paginate points, inspect a coordinate map, calculate straight-line proximity from browser-only reference coordinates and download attributed open data | Gazetteer points may be approximate/historical; no routing, opening-status or service-quality claim |
| Infrastructure | Dated, sourced project milestones with proposed/funded/underway/completed/on-hold/cancelled distinctions | Historical documentary evidence, not a live construction audit or proof of property-price uplift |
| Data confidence | Captured source feeds, source concentration, sample visibility, captured periods and collection status | Coverage indicators, not statistical confidence intervals or investment-success probabilities |
| Saved research | Owner-only immutable-at-save evidence and optional assumptions; reopen, download JSON, print/save PDF, delete with confirmation | A private snapshot may outlive changes to collection status; current rights/freshness must be checked before acting |
| Watchlists | Owner-only location/market thresholds and in-app month-on-month publisher-change notifications | Future captured figures only, no alert without fresh evidence; external email/SMS/webhook delivery remains disabled |

## Data and attribution

### Market and location references

The existing 21 October 2026 Kenya Property Centre benchmarks remain licensed
publisher statistics, separate from Atlas-derived activity. Automated refresh
remains paused after HTTP 403; no proxy or identity bypass is introduced. Review
[daily collection operations](DAILY_COLLECTION.md) before resuming anything.
Location metadata remains credited to **kenya-locations by David Amunga and
contributors**, CC BY 4.0, with IEBC/KNBS and historical HDX/American Red Cross
provenance retained. County population is the 2019 census reference.

### Facility gazetteer

The first successful facility import contains **1,527 points across 41 counties**,
selected from the [GeoNames Kenya country download](https://download.geonames.org/export/dump/KE.zip).
The [publisher readme](https://download.geonames.org/export/dump/readme.txt)
licenses the data CC BY 4.0 and disclaims accuracy, timeliness and completeness.
Keep GeoNames attribution on screen and in exports. Atlas selects documented
[facility feature codes](https://www.geonames.org/export/codes.html), then assigns
each point to exactly one bundled 2020 geoBoundaries county polygon. Ambiguous or
unmatched points are withheld. Zero were unmatched in the initial extract.

Included codes: HSP hospital; HSPC/HSPD outpatient/dispensary facilities grouped
as clinics; SCH school; SCHC/SCHT college/technical school; UNIV university;
MKT marketplace; BSTN bus station. Dataset absence is not physical absence.
GeoNames per-feature modification dates are not presented as operating-status
verification; the API labels the Atlas retrieval date. No population-based
amenity score or location quality ranking is calculated.

The OpenStreetMap adapter is prepared separately for a bounded Nairobi extract,
under ODbL 1.0 with a downloadable derivative and attribution. Its initial
Overpass request received HTTP 406; no OSM extract was published. The successful
GeoNames download is a distinct documented open dataset, not a proxy for the
denied service. The map uses source coordinates and a coordinate graticule;
there are no third-party map tiles, location tracking or geocoding requests.

Owner commands (direct database credential, never a browser credential):

```sh
node --env-file=.env.backend-production.local --import tsx scripts/import-geonames-amenities.mts --apply
node --env-file=.env.backend-production.local --import tsx scripts/import-research-context.mts --projects
```

Imports have fixed HTTPS sources, TLS/DNS protections, request time/byte limits,
strict schemas, retained download/licence SHA-256 evidence, source approval
metadata and audited atomic writes. GeoNames compressed downloads are limited to
2 MiB; only `KE.txt` is extracted in memory, up to 16 MiB. No filesystem archive
paths, raw contact tags or arbitrary user-supplied URLs are used. Facility
imports replace one source's reviewed extract transactionally; stable source IDs
prevent duplicate source records. Neither import is a new unattended network job.

### Infrastructure milestones

Two reviewed factual summaries currently cover Nairobi transport:

- **10 November 2020:** commissioning of the revitalised commuter service,
  documented by [Kenya Railways](https://krc.co.ke/the-nairobi-commuter-rail/).
  This does not imply all future network upgrades were completed.
- **3 July 2025:** the State Department for Roads reported Cabinet approval for
  the central-station/public-realm project, recorded as proposed rather than
  delivered. [Official evidence](https://www.roads.go.ke/nairobi-railway-city-central-station-and-public-realm-project).

These are original short factual summaries with links; whole articles, photos
and government forecasts are not republished. Later status changes are new
append-only events, not edits that erase the documentary timeline. Other
counties honestly show no reviewed milestones until evidence is added.

## Scenario arithmetic (`scenario/1`)

Loan = purchase price × (1 − deposit fraction). Cash required = deposit amount +
acquisition costs. A fixed-rate amortising loan uses monthly rate r and n monthly
payments: payment = principal × r / (1 − (1+r)^−n); zero interest uses principal/n.
All-cash purchases have zero debt service. Operating income = annual rent ×
(1 − vacancy) − annual operating expenses. Cash flow subtracts debt service.
Gross and net operating yields divide by purchase price plus acquisition costs.
Cash-on-cash divides year-one cash flow by cash required; zero cash required
returns null. Break-even occupancy divides expenses plus debt service by gross
annual rent; zero rent returns null, and values over 100% remain visible.

The ten-year projection compounds only the explicit rent and expense assumptions.
Debt service stops when the selected loan term ends. It is nominal, pre-tax and
excludes appreciation, disposal proceeds and any cost the user has not entered.
Inputs are finite and bounded; the server rejects unknown fields and validates
each parameter. There is no automatic ratio of unmatched county sale/rent medians.

## API contract

All paths below follow `/api/v1`. Public research has the existing global API
budget plus 120 intelligence requests/minute. County IDs must be currently
published geoBoundaries counties. Unknown and repeated query keys are rejected.
Expensive evidence/activity transactions have a 3-second statement timeout.

| Method and route | Input / output |
| --- | --- |
| GET `/research/intelligence/evidence` | Required `county_ids` (one to four comma-separated UUIDs), `market_type=rent|sale|short_let`, optional `as_of=YYYY-MM`; county metadata, up to 240 captured county-period figures and amenity coverage |
| POST `/research/intelligence/scenario` | Exact numeric fields defined in `functions/backend/scenarios.ts`; calculated metrics and ten-year cash flows |
| GET `/research/intelligence/liquidity` | County IDs, `market_type=rent|sale`, `days=30|90`; suppressed aggregate activity |
| GET `/research/intelligence/amenities` | Required `county_id`, optional category, bounded `limit`/`offset`; public facility projection with provenance |
| GET `/research/intelligence/amenities/export` | Required county ID; up to 2,000 attributed source points with their original licences |
| GET `/research/intelligence/projects` | Required county ID; up to 100 dated documentary milestones |
| GET, POST `/workspace/research/items` | Verified Auth session; list own snapshots or create `{name,filters,scenario?}`; source evidence is selected by the server, never trusted from the client |
| GET `/workspace/research/items/:id` | Owner only; load a complete snapshot on demand for a brief/export; the list endpoint returns compact summaries |
| DELETE `/workspace/research/items/:id` | Owner only; absent or other-owner IDs return 404 |
| GET, POST `/workspace/research/watchlists` | Own watches/alerts, or `{name,county_id,market_type,threshold_percent,direction}`; threshold 0.1–100, direction up/down/either |
| DELETE `/workspace/research/watchlists/:id` | Owner only; cascades that watch's notifications |

Saved snapshots and watchlists are limited to 100 each per user; creation locks
per owner so concurrent requests cannot overrun quotas. SQL binds parameters;
owner IDs come only from the verified identity. Row-level policies enforce the
same ownership boundary even if an application query misses its owner filter.
Other-owner deletes return 404. Unknown payload keys, client owner IDs and
client-supplied evidence are rejected. Browser private data is not persisted to
local storage. Downloads require an explicit user action.
Snapshot creation is bounded to 190 KB of evidence; larger selections return 413.
List responses omit historical series to avoid downloading every private brief
whenever a user opens their workspace.

## Watchlist evaluation and privacy

Migrations 019–020 add the research schema, projected rights-gated public views,
private snapshots, watchlists and notifications. API/worker roles cannot read the
context base tables. The worker cannot read private watchlists or snapshots and
has only EXECUTE on a fixed `SECURITY DEFINER` evaluator with a pinned search path
and PUBLIC execution revoked. The API cannot execute it. The hourly worker calls
it after collection/publication; it never sends outbound notifications.

Evaluation selects the latest revision for each reference period, compares the
latest two different periods within the same publisher/series, then applies each
watch's direction and percentage threshold. Figures must have been captured after
watch creation. One notification per watch/benchmark makes replay idempotent.
Revoked/expired/unpublished sources cannot produce alerts and their existing
alerts disappear from API reads. Deleting a watch deletes its alerts. Retention
is 90 days and at most 200 notices per owner. Corrections within one period do
not become an invented new time point.

Backups now include `atlas_research` and the private public-schema tables.
Off-device backup and external alert delivery remain disabled as instructed.

## Verification and limitations

The isolated fresh PostgreSQL 18 suite passes **45 tests**. New contracts cover
scenario edge cases, publication rights, captured-only history, strict filters,
snapshot ownership, watchlist role boundaries, idempotent evaluation, source
revocation, immutable project evidence and the 29/30-observation activity boundary.
Frontend type checks, lint and production build are required before release.
Test the eight studio tabs on desktop and mobile; verify save/reopen/delete,
watchlists, JSON downloads, print output and that old listing URLs redirect.

Current limits are explicit: one captured property reference month, a paused
external property collector, no permitted public property observation cohort,
incomplete amenity mapping and only two reviewed historical infrastructure
milestones. These constrain conclusions, not the existence of the tools. No
universal duplicate, future uptime, investment-return or completeness guarantee
is made.
