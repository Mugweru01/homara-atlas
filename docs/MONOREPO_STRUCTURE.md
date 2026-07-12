# Homara Atlas: Monorepo Structure

Homara Atlas uses a strict monorepo structure to keep the frontend, backend, infrastructure, and data platforms tightly coupled in version control, ensuring cross-system consistency.

## 1. Directory Layout

```text
homara-atlas/
├── api/                   # Phase 7 & 10: FastAPI Backend (Ingestion & Serving)
│   ├── app/               # Application source code
│   ├── tests/             # Pytest suite
│   ├── requirements.txt
│   └── Dockerfile
├── apps/
│   └── web/               # Phase 10: React/Vite Dashboards
│       ├── src/
│       ├── tailwind.config.ts
│       └── package.json
├── data-platform/         # Phase 8 & 9: Data Lake, Warehouse, and Transformation
│   ├── dbt/               # dbt project for analytics engineering
│   ├── airflow/           # Airflow DAGs for orchestration
│   └── schemas/           # Event definitions and JSON schemas
├── infrastructure/        # Phase 5: Terraform Infrastructure as Code
│   ├── modules/           # Reusable Terraform modules (VPC, S3, Redshift)
│   ├── environments/      # Environment specific vars (prod, staging)
│   └── main.tf            # Root module
├── database/              # Phase 4: Operational SQL (Supabase)
│   └── atlas_supabase_schema.sql
└── docs/                  # Architectural blueprints and roadmap
    ├── STRATEGIC_BLUEPRINT.md
    ├── ENTERPRISE_ARCHITECTURE.md
    ├── AWS_ARCHITECTURE.md
    ├── MASTER_ROADMAP.md
    └── MONOREPO_STRUCTURE.md
```

## 2. Package Sharing & Boundaries
- **Python:** The `/api` package handles both ingestion workers and the REST/GraphQL serving API. Code is shared via standard Python modules.
- **Frontend:** `/apps/web` consumes the API. We maintain strict separation; the frontend does not contain any business logic related to data aggregation.
- **Data Platform:** `/data-platform` houses all `dbt` models. The `api` layer is only permitted to query the final materialised views produced by `dbt`, never the raw tables.
