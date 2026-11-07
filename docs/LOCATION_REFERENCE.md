# Kenya location reference: integration and operation

Atlas imports a reviewed snapshot into **Neon PostgreSQL** and serves it through
the existing Hono API. No upstream hosted API, extra service, browser database
credential or paid location subscription is required. Requests never call the
upstream demo website or send it search terms, properties or customer data.

## Source, attribution and licence

**kenya-locations, by David Amunga and contributors**:
[repository](https://github.com/davidamunga/kenya-locations),
[pinned source](https://github.com/davidamunga/kenya-locations/tree/6c837b48a29ea2424ecda2abaea2ae6d3670db68),
[data licence](https://github.com/davidamunga/kenya-locations/blob/6c837b48a29ea2424ecda2abaea2ae6d3670db68/data/LICENSE.md).

Data is **CC BY 4.0**. Upstream library code is separately MIT licensed; Atlas
vendors the data and implements its own import/API. Preserve the credit, source
link, licence link and transformation notice when redistributing results.

Attribution also acknowledges IEBC and KNBS, and HDX/American Red Cross for
historical DHIS2 sub-counties and ward links. Source metadata, licence, change
history and matching-evidence records are retained in
[the vendored snapshot](../data-platform/reference/kenya-locations/README.md).
The dataset is identified in the public source registry, Sources interface,
Developer API interface and every successful geographic data response.

Pinned commit: `6c837b48a29ea2424ecda2abaea2ae6d3670db68`; package/data version
`0.12.0`. The manifest covers exact upstream file bytes with SHA-256 digests.
Git attributes preserve those bytes across Windows/Linux checkouts.

| Kind | Count | Identity and limitations |
| --- | ---: | --- |
| County | 47 | IEBC code string `001`–`047`; distinct ISO codes |
| Constituency | 290 | IEBC code string `001`–`290`; electoral reference IEBC 2012 |
| Ward | 1,450 | IEBC code string `0001`–`1450`; repeated names require codes |
| Sub-county | 302 | Historical HDX/DHIS2 layer; project-assigned five-digit codes |
| Locality | 917 | County-scoped names; informal and provenance incomplete |
| Area | 1,829 | County + locality + name; informal and provenance incomplete |

There are 4,835 places and 9,517 explicit parent relationships. Wards have
county, constituency and sub-county relationships. Localities and areas are a
separate hierarchy: no ward membership is invented for an informal place.
Of the ward-to-sub-county links, 104 are guided/fuzzy matches or inference;
the API exposes their method. `exact` means the source names matched, not that
Atlas performed a current official boundary survey.

The snapshot's areas cover 42 counties and localities 44; absence does not imply
that a place does not exist. County population metadata is from **2019**;
postal codes refer to **county capitals**. The data supplies **no map polygons,
property coordinates, geocoding guarantees or market observations**.

## Database model

Migration: [013_location_reference.sql](../database/neon/013_location_reference.sql).

- `atlas_geo.releases`: immutable pinned revision, manifest hash and provenance.
- `atlas_geo.places`: Atlas UUIDs and unique source identities, independent of releases.
- `atlas_geo.versions`: immutable names, codes, metadata and provenance per release.
- `atlas_geo.relations`: immutable parent edges with explicit matching methods.
- `atlas_geo.county_mapping`: maps all 47 codes to existing Atlas county UUIDs.
- `atlas_geo.current_release`: owner-controlled atomic publication pointer.
- `atlas_geo.published_*`: read-only views gated by current source approval/rights.

Existing `atlas_core.locations` county IDs and boundary vintage remain intact.
The retained geoBoundaries layer labels county 013 **Tharaka**; the reviewed
crosswalk maps it to **Tharaka-Nithi** without changing its county UUID or legacy
boundary name. `/counties` includes the canonical `reference_name` separately.
This crosswalk is included in dataset provenance; no fuzzy match is used.
Atlas retains zero-padded source codes as strings and NFC-normalizes imported
names. Informal places receive internal UUIDs; their source key includes county
and parent locality as appropriate. A rename needs reviewed identity migration,
not a global name replacement. The upstream `history.json` is review evidence.

The API role has SELECT only on the published views, with no access to the
geography base tables, import writes or publication pointer. The ingestion worker
does not receive access to the new schema. Import/publication uses the existing
trusted owner deployment workflow, never an HTTP upload endpoint.

## API contract

All paths below have prefix `/api/v1/geography`. Public GET/HEAD requires no API
key because responses contain only public reference data. No write methods are
supported. Machine-readable contract: **GET `/openapi.json`**. The web Developer
API page lists examples with the configured backend URL.

| Path | Parameters | Response |
| --- | --- | --- |
| `/dataset` | None | Source, licence, revision, import time, counts and limitations |
| `/counties` | None | Existing county IDs/name/boundary year, plus code and metadata |
| `/places` | `kind`, common filters/pagination | All supported place kinds |
| `/constituencies` | Common filters/pagination | Constituency records |
| `/wards` | Common filters/pagination | Ward records |
| `/sub-counties` | Common filters/pagination | Historical DHIS2 sub-counties |
| `/localities` | Common filters/pagination | Informal localities |
| `/areas` | Common filters/pagination | Informal areas |
| `/search` | Required `q`; `kind`, common filters/pagination | Literal name/alias substring results |
| `/places/:id` | Atlas place UUID | Place, parents and their matching methods |

Common filters: `county_code` (three-digit string), `constituency_code`
(three-digit string), `parent_id` (Atlas geography UUID). A constituency filter
only returns places with that explicit relationship. Use a locality ID as
`parent_id` to select its areas. The existing county endpoint returns boundary
IDs; `/places?kind=county` returns geography place IDs. List results also include
`atlas_county_id` for the preserved boundary ID. These ID namespaces are distinct.

Pagination: `limit` defaults to 50, maximum 100; `offset` is 0–10,000. Search
caps its effective limit at 25 and requires 2–80 characters. Results have stable
name/kind/UUID ordering and a `has_more` flag. Search is literal and
case-insensitive, including county aliases. It does not automatically assign a
property to a place or perform fuzzy geocoding.

Example, using your actual Atlas Function origin:

```sh
curl "$ATLAS_API_BASE_URL/api/v1/geography/wards?county_code=047&limit=10"
curl "$ATLAS_API_BASE_URL/api/v1/geography/search?q=Westlands&kind=locality"
```

List envelope:

```json
{
  "results": [],
  "limit": 10,
  "offset": 0,
  "has_more": false,
  "dataset": {
    "repository": "https://github.com/davidamunga/kenya-locations",
    "revision": "6c837b48a29ea2424ecda2abaea2ae6d3670db68",
    "version": "0.12.0",
    "license": "CC-BY-4.0",
    "attribution": "kenya-locations by David Amunga and contributors; see actual response for full credit",
    "limitations": ["Informal-place provenance is incomplete"]
  }
}
```

This is an illustrative empty envelope, not a coverage claim. Actual dataset
metadata includes full attribution, source links, import timestamp, checksums,
counts, transformation notice and all limitations.

## Security and confidentiality

- Requests pass the existing shared API budget of 600/minute and an additional
  shared geography budget of 180/minute. These are global budgets, not per-IP
  promises. Spoofed forwarding/IP headers do not create new budgets.
- HTTP 429 includes `Retry-After: 60`. Rate storage failure fails closed.
- Exact query allowlists reject unknown or repeated parameters. Codes, UUIDs,
  enums, search length, limit and offset are validated before data queries.
- SQL is parameterized; search `%`/`_` characters have no wildcard semantics.
- Reads use a read-only, repeatable-read transaction and a 2-second SQL statement
  timeout, so a response's records and provenance refer to one release.
- Only explicit columns from geography publication views are returned. No
  listing, observation, report, identity or private artifact table is joined.
- GET/HEAD/OPTIONS only; POST/PATCH/DELETE return 405. CORS remains an explicit
  origin allowlist. Responses retain security headers, no-store and request IDs.
- Invalid input returns 400, unknown place 404, unpublished/unavailable dataset
  503. Database errors use generic public messages without SQL or credentials.
- Source disable/revocation/rights expiry removes the release immediately from
  publication views. County boundaries can still respond independently with
  `dataset: null`; no revoked reference metadata is included.

**Homara's confidential feed remains isolated.** Geography endpoints return no
property records, links, source listing IDs, asking prices, user data, listing
counts or property-derived aggregates. Location counts describe this public
reference snapshot only. Geography import does not change Homara's publication
prohibition, RLS policies, private buckets or secret-gated export.

## Import and deployment

```sh
node scripts/import-locations.mjs --check
node --env-file=.env.local scripts/migrate.mjs
node --env-file=.env.local scripts/import-locations.mjs --apply
npm run check:functions
```

Use an owner connection on an isolated database/Neon branch to rehearse first;
never run database contract tests against production. Follow the repository's
existing reviewed migration/deployment procedure for an already provisioned
environment. Do not edit previously applied migration checksums to suppress a
baseline mismatch: investigate it and apply an audited forward migration.

`--check` performs no database writes or network fetches. It validates pinned
revision, licence/vintage, exact file checksums, expected totals, code sequences,
unique identities, parent names/codes and matching evidence. `--apply` requires
a direct owner connection and all 47 existing approved boundary counties. Any
ambiguous/missing county map fails the whole transaction for manual review.

An advisory import lock prevents simultaneous imports. Version rows, relations,
county mappings, registry provenance, audit event and publication pointer commit
atomically. An identical import is a no-op; changed bytes under an existing
revision are rejected. This is a static reviewed source, excluded from automatic
collection scheduling. A recent import does not imply current administrative
boundaries; source health treats a pinned release separately from live feeds.

Deploy the API after the migration and successful import. Verify `/dataset`,
`/counties`, paginated `/wards`, alias search, `/sources`, malformed query denial,
unsupported methods and missing place responses. Confirm source attribution in
the Sources interface and API docs. Re-run the Homara confidentiality checks.

## Update, rollback and recovery

1. Review a new upstream commit, licence, per-file sources and `history.json`.
2. Replace vendored files from that exact revision and regenerate the manifest.
3. Update the reviewed revision/version/count contract and add identity mappings
   for upstream renames, replacements or removals. Do not reuse codes blindly.
4. Rehearse validation, county mapping, import, security and API tests in isolation.
5. Apply the reviewed release through the owner workflow. Retain old versions.

For emergency withdrawal, disable/revoke the `kenya-locations` source through the
audited admin controls. Public dataset reads then fail closed. A rollback to an
earlier imported release must be an owner transaction updating
`atlas_geo.current_release` after checking the release's provenance/rights and
recording an `atlas_control.audit_events` reason. Never delete history or disable
the append-only triggers. This first import has no earlier release to roll back
to; use source withdrawal instead.

The encrypted backup tool must include `atlas_geo` along with existing Atlas
schemas. Restores remain restricted to isolated approved restore targets.
Off-device backup and operational-alert delivery remain disabled until the
owner selects destinations and explicitly enables them.

## Verification

The backend suite checks validation failures, idempotency, immutable evidence,
base-table/pointer permission denial, preserved county IDs, attribution,
pagination, alias search, literal wildcard treatment, provenance labels,
malformed/repeated queries, read-only methods, CORS/security headers, source
revocation and rate limits with spoofed forwarding headers. Existing Homara,
JWT, report ownership, durable job and publication tests remain required.

Verified on **7 November 2026**: 29 backend tests and three frontend environment
tests passed, both TypeScript checks passed, and the production build succeeded.
Production import and repeat-import checks passed; all 47 county UUIDs were
preserved. Live API checks covered attribution/licence, the Tharaka crosswalk,
pagination, parent detail, informal labels, alias search, malformed/repeated
parameters, unsupported writes and OpenAPI. The deployed Sources dialog showed
the author, licence, pinned version and limitations and fit a 390-pixel viewport.
Existing Homara public-output/database/storage denial checks still passed.

Lint reported zero errors and the seven existing Fast Refresh warnings. Changed
frontend files passed scoped Prettier checks; the repository-wide formatting
check still flags pre-existing line-ending/style differences in untouched files.
