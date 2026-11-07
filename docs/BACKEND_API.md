# Backend API contract

All routes below use `/api/v1`. Protected routes require a Managed Auth bearer JWT. Operator roles come from the database, never client metadata. JSON errors contain an error code and request ID. Status codes: invalid input 400, missing/invalid session 401, role failure 403, absent/other-owner resource 404, conflict 409, body too large 413, request budget 429, dependency failure 503. DELETE succeeds with 204. Pagination defaults to 50 with a maximum of 100 and bounded nonnegative offset.

| Routes | Access | Purpose |
|---|---|---|
| GET `/system/health`, `/system/ready`, `/system/data-health` | Public | Liveness, DB readiness, independent source freshness |
| GET `/sources`, `/geography/counties` | Public | Attribution and county IDs/vintage |
| GET `/geography/dataset`, `/geography/openapi.json` | Public | Pinned location provenance and machine-readable contract |
| GET `/geography/regions` | Public | Eight historical province groups; place lists/search accept `region` |
| GET `/listings` | Public | Separately approved public advertisements only; county_id/listing_type/property_type and bounded pagination |
| GET `/research/benchmarks` | Public | Licensed publisher market statistics; market_type/county and pagination; not individual listings |
| GET `/collection/sources` | Public | Reviewed public-source decisions and approved collector status; confidential feeds excluded |
| POST `/collector/kpc`, GET `/collector/kpc/jobs/:id` | Source-scoped collector bearer token | Fixed licensed market-statistics source only; strict envelope, bounded queue, no arbitrary source/job access; see [collection runbook](DAILY_COLLECTION.md) |
| GET `/geography/places`, `/geography/constituencies`, `/geography/wards`, `/geography/sub-counties`, `/geography/localities`, `/geography/areas` | Public | Read-only place references; county_code, constituency_code, parent_id, bounded pagination |
| GET `/geography/search`, `/geography/places/:id` | Public | Literal name/alias search and place/parent detail; attribution included |
| GET `/context/indicators` | Public | Latest annual revisions; optional `code`, pagination |
| GET `/analytics/overview` | Public | Current release and separated sale/monthly-rent summaries |
| GET `/analytics/market`, `/analytics/neighbourhoods`, `/analytics/price-index` | Public | County asking-market cells; optional county/listing_type and pagination. Legacy route names imply no historical index or neighbourhood precision |
| GET, POST `/workspace/reports` | Signed-in user | Own ready reports; create with `{title,content}` |
| GET, DELETE `/workspace/reports/:id` | Owner | Short-lived private download URL or durable deletion |
| POST `/workspace/reports/live` | Signed-in user | Sealed owner-filtered Realtime query |
| GET `/admin/sources` | Operator/admin | Source registry |
| POST `/admin/sources` | Admin | `{slug,name,license,permission_url,attribution}` creates pending source |
| PATCH `/admin/sources/:id` | Admin | `{status,publication_allowed,rights_expire_at?}`; active/disabled/revoked |
| POST `/admin/sources/:id/jobs` | Operator/admin | Idempotency-Key required; manual `{records:[...]}`, automatic empty body |
| GET `/admin/jobs`, `/admin/jobs/:id` | Operator/admin | Durable status, counters and quality issues |
| POST `/admin/jobs/:id/replay` | Admin | Idempotency-Key; manual exact raw replay, automatic current refetch |
| GET `/admin/quality-issues` | Operator/admin | Paginated quarantine metadata |
| PATCH `/admin/quality-issues/:id` | Operator/admin | `{note}` acknowledges without accepting invalid evidence |
| POST `/admin/entity-matches` | Admin | `{listing_ids,reason}` reviewed property grouping |
| POST `/admin/entity-matches/revoke` | Admin | `{listing_id,reason}` reverses a reviewed link |
| GET `/admin/audit` | Admin | Paginated immutable audit |

Manual listing fields: source_listing_id, source_url, observed_at, listing_type, property_type, county_id, bedrooms, price_amount, currency, rent_period, availability, status_evidence, and optional floor_area_sqm/plot_area_sqm. See `functions/backend/validation.ts` for authoritative enums and bounds. County UUIDs come from the geography API. Currency is KES; sale uses null rent_period. Rent accepts day/week/month, but only month enters monthly summaries. Sold/let requires stronger evidence than an advertisement. Missing areas stay null. No owner IDs, contact fields, descriptions, nested values or URL credentials/query strings are accepted. Maximum batch 1 MiB/1,000 records.

The separate worker `/run` requires the internal bearer secret. `/cron` accepts only Neon trigger delivery; the deployed proxy strips client `x-neon-*` headers. Do not expose that secret to a browser or make the raw local worker publicly reachable.

### Geographic reference contract

The [location API and operations guide](LOCATION_REFERENCE.md) documents all
parameters, ID namespaces, provenance classes and source credits. Machine-readable
OpenAPI is served at `/api/v1/geography/openapi.json`. List/detail data includes
attribution to **kenya-locations by David Amunga and contributors** and its
CC BY 4.0 licence. Geography uses read-only, parameterized publication views and
an additional shared 180 requests/minute budget; queries reject unknown/repeated
parameters. The 600/minute overall API budget also applies. This API contains no
Homara property records, customer data, prices or listing counts. Static reference
sources require the reviewed owner import workflow, not an ingestion job.
