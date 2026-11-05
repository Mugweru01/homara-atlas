# Atlas frontend refresh

The current application is the new `apps/web/src/atlas` workspace. It replaces the previous page layout and routes. Backend schemas and ingestion logic were left unchanged during this milestone.

## Design direction

Visual thesis: a warm, precise research instrument with forest-green navigation, a cream working surface and county geography as the principal visual anchor.

Content plan: orient with dataset coverage, explore geography and national signals, inspect source provenance, then keep research in a private workspace. Property market views explain absent or suppressed evidence rather than inventing figures.

Interaction thesis: restrained page entrances, sticky workspace navigation, direct county selection, and focused search/source overlays. Reduced-motion preferences disable decorative transitions.

Skills selected: the installed frontend skill and the Homara rebrand skill at `C:/Users/wachi/projects/kenya-landlord-link/.claude/skills/homara-rebrand/SKILL.md`. Original logo assets and canonical palette values were reused. Bricolage Grotesque and Figtree form the interface; Spline Sans Mono is reserved for code and numeric prices. No emojis are used in the new interface.

## Product surfaces

- Overview: live coverage totals, interactive county map, switchable annual signals and dataset navigation.
- National context: four real WDI series, time ranges, keyboard-readable observations, expandable data table and attributed CSV exports.
- County explorer: searchable county directory, keyboard/click selection, persistent county URL, boundary vintage and market navigation. County geography is not presented as cadastral evidence or local demographic estimates.
- Property market: sale/rent selection, county filtering, sparse-price suppression, pagination and page exports when observations exist. The live dataset currently has no approved property feed.
- Sources: collection freshness, licence/attribution details, accessible source drawer, refresh and publication principles.
- Workspace: real Managed Auth registration/sign-in, session restoration, private report writing, Realtime updates, download, explicit deletion confirmation and sign-out.
- Developer API: real public endpoint links and a copyable example; no fabricated API keys or usage counters.
- Global search: Ctrl/Cmd+K, pages and counties, Escape dismissal. Mobile navigation supports keyboard dismissal and makes the obscured workspace inert.

Legacy URLs redirect to the matching new surface. Retired source files remain in the repository because automatic approval review blocked their removal; they are not registered as current application routes. Reusable existing UI primitives are retained.

The legacy service worker is retired, including an update worker for old installations. Authenticated responses and private reports are not put into its old generic offline cache. Frontend build variables remain public URLs only: `VITE_API_URL`, `VITE_NEON_AUTH_URL` and `VITE_NEON_REALTIME_URL`. Docker now passes all three.

## Verification

- Production Vite build and TypeScript checks passed.
- Frontend environment suite: three passed. Lint: no errors; seven pre-existing primitive Fast Refresh warnings remain.
- Desktop and 390px mobile layouts inspected. A source-table overflow issue was corrected; wide tables scroll inside their region.
- Live county selection, global keyboard search, source licence drawer/Escape, chart/range/table controls and CSV export verified. Export contained all 104 observations and four indicators.
- A simulated API failure showed a clear error, and Retry restored the live data.
- A temporary real Auth account created a private report, retained it after reload, received live updates, downloaded it, deleted it with confirmation and signed out. The temporary account was removed afterwards.
- Browser-only market fixtures verified 100-row pagination, a second page and null-price suppression. Fixtures were removed and the view returned to the real empty state; no market fixture was written to the backend.

Review locally at `http://127.0.0.1:5184`. This refresh is included in PR #40. Backend deployment, Vercel preview status and promotion of a production frontend are separate from the Git push; inspect the PR checks/deployments for the current preview.

The static county geometry is derived from the backend’s real source artifact. Its licence, publisher and reference vintage are recorded in `apps/web/public/kenya-counties.provenance.json`; refresh this asset deliberately if a later boundary release is adopted.
