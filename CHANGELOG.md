# Changelog

All notable changes to Homara Atlas are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
> Changes staged on `development` and `feature/*` branches, awaiting merge to `main`.

---

## [1.1.0] — 2026-07-12

### Added
- **Frontend**: Complete multi-page dashboard redesign
  - `PriceIndex` page: Interactive area charts showing historical price trends across Nairobi, Mombasa, Kiambu
  - `Neighbourhoods` page: Full data table with search, sorting, safety/growth/yield metrics
  - `Affordability` page: Housing Affordability Index with rent-to-income ratio bar charts
  - `HeatMaps` page: Geospatial intelligence view with legend and investment potential markers
  - `DeveloperAPI` page: Developer portal linking to Swagger documentation
- **Frontend**: Persistent `DashboardLayout` sidebar with links to all product pages
- **Frontend**: `concurrently` setup — `npm run dev` now starts both API and Vite together
- **API**: Vite dev proxy (`/api → localhost:8000`) eliminating all CORS issues in development
- **API**: Enhanced OpenAPI documentation with full markdown description, contact info, license, and endpoint table
- **API**: Proper HTTP status codes documented on all analytics endpoints
- **CI/CD**: Added `workflow_dispatch` to `deploy.yml` enabling manual GitHub Actions triggers
- **Branching**: Established `main`, `development`, and `feature/*` branch strategy with protection rules

### Changed
- **API**: CORS origins expanded to cover all local dev network IPs
- **Frontend**: API base URL made relative so Vite proxy handles routing automatically
- **Frontend**: React Router v7 future flags added to silence deprecation warnings
- **Infrastructure**: `.gitignore` hardened to exclude Terraform binaries and state files

### Fixed
- `HeatMaps.tsx`: JSX syntax error from unescaped `<` character (replaced with `&lt;`)

---

## [1.0.0] — 2026-07-12

### Added
- **Infrastructure**: Full AWS Free Tier provisioning via Terraform
  - `t3.micro` EC2 instance (Ubuntu 22.04)
  - `db.t4g.micro` RDS PostgreSQL 15
  - Security Groups for SSH (22), HTTP (80), API (8000), and PostgreSQL (5432)
- **API**: FastAPI backend with versioned routing under `/api/v1/`
  - `GET /api/v1/system/health` — platform health check
  - `GET /api/v1/analytics/overview` — dashboard KPI summary
  - `GET /api/v1/analytics/price-index` — Property & Rental Price Index
  - `GET /api/v1/analytics/neighbourhoods` — Neighbourhood intelligence
  - `POST /api/v1/ingestion/trigger/{source}` — EL pipeline trigger
- **API**: Environment-aware database switching (`app/db.py`)
  - Production: AWS RDS PostgreSQL via `psycopg2`
  - Development: Local SQLite fallback (`app.db`)
- **Frontend**: Initial React/Vite dashboard with Recharts
  - Market Overview KPIs
  - Average Price by Property Type bar chart
  - Top Neighbourhoods leaderboard
- **CI/CD**: GitHub Actions `deploy.yml` — builds Docker images, pushes to Docker Hub, deploys to EC2 via SSH
- **Documentation**: Comprehensive `README.md` covering architecture, local dev setup, and deployment guide
- **Repository**: Monorepo structure with `api/`, `apps/web/`, `infrastructure/`, `data-platform/`

---

## Versioning Policy

| Version | When to increment |
|---|---|
| `MAJOR` (X.0.0) | Breaking API changes — routes removed/renamed, response schema changed |
| `MINOR` (1.X.0) | New features added in a backwards-compatible manner |
| `PATCH` (1.0.X) | Bug fixes and documentation improvements |

### Branch Strategy

```
main          ← production only. Protected. PRs required. No direct pushes.
  └── development  ← integration branch. All features merge here first.
        └── feature/*  ← individual feature branches off development.
```

**Merge path**: `feature/*` → `development` (PR) → `main` (PR, owner approval required)
