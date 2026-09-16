# Homara Atlas

Homara Atlas is a property intelligence platform for the Kenyan real-estate market. It turns public listing data, rental data, neighbourhood metrics, and affordability signals into an analytics dashboard and API designed for deployment in a lightweight AWS environment. The project combines a React dashboard frontend, a FastAPI analytics backend, and cloud-ready infrastructure for EC2, PostgreSQL, and S3-based ingestion.

## Overview

This repository is a full-stack market intelligence application focused on helping users understand:

- property price and rent trends across counties
- neighbourhood-level market conditions
- affordability and value-per-square-foot analysis
- data-backed market dashboards and visualizations
- developer access to aggregated property analytics through a REST API

The repo is not just a frontend prototype; it includes deployment automation, infrastructure-as-code, and production-oriented AWS setup to run the platform in a real environment.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, Python
- Data layer: PostgreSQL / Supabase-compatible schema
- Data processing: pandas, pyarrow, Parquet-based ingestion flow
- Infrastructure: Terraform, Docker, Docker Compose, AWS EC2, RDS, S3
- CI/CD: GitHub Actions

## Architecture

The project is organized into a few main areas:

- `apps/web` — React dashboard frontend
- `api` — FastAPI backend and ingestion endpoints
- `database` — PostgreSQL/Supabase schema and database assets
- `data-platform` — ingestion and analytics processing assets
- `infrastructure` — Terraform for AWS free-tier deployment
- `docs` — implementation and planning documentation
- `.github/workflows` — GitHub Actions CI/CD automation

At runtime, the web app calls the FastAPI API, which is designed to read local Parquet data in development and connect to PostgreSQL-backed warehouse data in production.

## AWS Deployment Model

The repository includes an AWS-focused deployment setup intended for the free tier:

- EC2 Ubuntu instance (`t3.micro`) for hosting the app stack
- RDS PostgreSQL instance (`db.t4g.micro`) as the data warehouse
- S3 bucket for raw ingestion data with lifecycle cleanup
- Docker Compose to run the API and web services together
- GitHub Actions SSH deployment to EC2

Key files:

- `infrastructure/aws-free-tier.tf`
- `docker-compose.prod.yml`
- `.github/workflows/deploy.yml`

## Core Features

- Market overview dashboard with KPI summaries
- County and property-type price index views
- Neighbourhood intelligence and ranking tables
- Affordability analysis and value comparisons
- Heat-map and trend-based visualizations
- Developer API with Swagger docs
- Ingestion workflow for public market datasets

## Repository Structure

```text
.
├── .env.example
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── api/
│   ├── app/
│   │   ├── ingestion/
│   │   ├── routers/
│   │   ├── __init__.py
│   │   ├── db.py
│   │   └── main.py
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── apps/
│   └── web/
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── vite.config.ts
│       ├── Dockerfile
│       └── ...
├── database/
│   ├── atlas_supabase_schema.sql
│   └── migrations/
├── data-platform/
├── docs/
├── infrastructure/
│   └── aws-free-tier.tf
├── supabase/
├── docker-compose.prod.yml
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── ADMIN_FEATURES_MISSING.md
├── ADMIN_FEATURES_QUICK_REFERENCE.md
├── CRM_IMPLEMENTATION_DETAILED.md
├── CRM_IMPLEMENTATION_SUMMARY.md
├── DEPLOYMENT_GUIDE.md
├── KNOWLEDGE_BASE_README.md
├── PERFORMANCE_OPTIMIZATION_GUIDE.md
├── PRE_LAUNCH_CHECKLIST.md
├── SECURITY_AUDIT_REPORT.md
└── ...
```

## Frontend App

The frontend is a Vite + React dashboard built for property analytics.

Main routes include:

- `/` — market overview dashboard
- `/price-index` — price trends and benchmark analysis
- `/neighbourhoods` — neighbourhood comparison views
- `/affordability` — affordability and value analysis
- `/heatmaps` — visualized market signals
- `/api-docs` — developer API access page

Run the web app locally:

```bash
cd apps/web
npm install
npm run dev
```

Default local URL:

- http://localhost:5173

## Backend API

The backend is a FastAPI service with versioned routes under `/api/v1`.

Implemented endpoints include:

- `GET /api/v1/system/health`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/price-index`
- `GET /api/v1/analytics/neighbourhoods`
- `POST /api/v1/ingestion/trigger/kenya-listings`

Swagger UI is available at:

- http://localhost:8000/docs

Start the API locally:

```bash
cd api
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API base URL:

- http://localhost:8000

## Environment Configuration

Copy the example env file before running the app:

```bash
cp .env.example .env.local
```

Expected values include:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Production deployment secrets for EC2, RDS, and Docker Hub are injected through GitHub Actions secrets rather than stored in source control.

## Database and Schema

The project contains a PostgreSQL/Supabase schema for the operational layer:

- `database/atlas_supabase_schema.sql`

It defines tables for:

- organizations
- user profiles
- API keys
- ingestion job logs

It also includes row-level security (RLS) policies for access control.

## Data Pipeline and Ingestion

The backend is designed around an analytics and ingestion flow that fetches, normalizes, and aggregates public market data for dashboard consumption. In development, the app reads local Parquet files; in production, it is designed to work against PostgreSQL-backed warehouse data.

The analytics code computes summary metrics such as:

- average listing price
- average rent
- county coverage
- price per square foot
- neighbourhood summaries

## Deployment

### Infrastructure

Terraform in `infrastructure/aws-free-tier.tf` provisions:

- EC2 instance for the app stack
- RDS PostgreSQL warehouse
- S3 bucket for raw ingestion data

### Container Deployment

`docker-compose.prod.yml` runs:

- API container on port `8000`
- Web container on port `3000`
- environment variables for DB credentials and API URL

### CI/CD

The repo has GitHub Actions workflows for validation and deployment, including the main AWS deploy flow:

- `.github/workflows/deploy.yml`

This workflow builds both Docker images, pushes them to Docker Hub, and deploys the stack over SSH to the EC2 instance.

## Security and Privacy

The project follows a privacy-first model:

- no customer or employee PII is stored in the app
- data is aggregated from public market sources
- production system boundaries are isolated from operational systems

## Contributing

For contributor workflow, recent changes, and development notes:

- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `docs/README.md`

## License

Copyright © Homara. All rights reserved.

## Summary

Homara Atlas is a production-oriented property intelligence platform built for Kenyan market analysis, with a React dashboard, FastAPI backend, PostgreSQL/Supabase-ready schema, and AWS-focused deployment architecture. The repo reflects a real cloud deployment setup as well as a working analytics app for property price, rent, affordability, and neighbourhood market intelligence.
