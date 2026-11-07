# kenya-locations snapshot

Source: [kenya-locations](https://github.com/davidamunga/kenya-locations), by **David Amunga and contributors**.

Pinned revision: [`6c837b48a29ea2424ecda2abaea2ae6d3670db68`](https://github.com/davidamunga/kenya-locations/tree/6c837b48a29ea2424ecda2abaea2ae6d3670db68).
Upstream JavaScript package/data version: **0.12.0**.

The upstream data files are retained without modification. `manifest.json`
records the source revision and SHA-256 digest and byte length of each file.
`matches.json` comes from upstream `sources/hdx-kenya-wards/matches.json`;
the other source files come from upstream `data/`.

**Data licence: [CC BY 4.0](LICENSE.md).** The upstream library code is separately
MIT licensed; Atlas imports the data rather than installing that library.

Attribution: kenya-locations (David Amunga and contributors), with data from IEBC
and KNBS; HDX/American Red Cross for historical DHIS2 sub-counties and ward links.
Keep the source link, licence, attribution and Atlas's transformation notice when
redistributing this data. Full per-file provenance is retained in `meta.json`.

| Dataset | Records |
| --- | ---: |
| Counties | 47 |
| Constituencies | 290 |
| Wards | 1,450 |
| Historical HDX/DHIS2 sub-counties | 302 |
| Informal localities | 917 |
| Informal areas | 1,829 |

The electoral reference is IEBC 2012. The sub-county layer is historical third-party
DHIS2 data with project-assigned codes; 104 ward links are guided, fuzzy or
inferred. Informal-place provenance is undocumented upstream and coverage is
incomplete. Population metadata refers to 2019. This snapshot provides no map
polygons or property coordinates.

Atlas assigns internal UUIDs, keeps source codes as strings, maps county codes to
existing Atlas boundary UUIDs, and stores relationship confidence separately.
Names are NFC-normalized in the database; the vendored source files remain intact.
No Homara listing or customer data is included in this directory.

Run `node scripts/import-locations.mjs --check` from the repository root to verify
all checksums, counts and parent references. See [the integration guide](../../../docs/LOCATION_REFERENCE.md)
for import, API, security, updates and rollback instructions.
