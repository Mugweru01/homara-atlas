# Homara Atlas

<div align="center">

![Status](https://img.shields.io/badge/status-rebuilding-orange.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![License](https://img.shields.io/badge/license-TBD-lightgrey.svg)

**A property intelligence platform, under active ground-up reconstruction.**

</div>

---

## Status

This repository is being rebuilt from a clean slate. The previous
admin/CRM/HomaraDesk panel has been removed; the app currently ships a
single public landing route while the new architecture, data model, and UI
are designed and implemented in phases. Expect the structure described
below to change frequently until the first tagged release.

If you're looking for a stable, feature-complete product, this isn't it
yet — track [issues](../../issues) and [pull requests](../../pulls) for
progress.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | React 18 + TypeScript, built with Vite |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Data | Supabase (Postgres, Auth, Storage, Edge Functions, Row-Level Security) |
| State/data fetching | TanStack Query |
| Forms & validation | React Hook Form + Zod |
| CI/CD | GitHub Actions (lint, type-check, build, CodeQL, Gitleaks, dependency review) |
| Hosting | Vercel |

There is no separate backend server, message broker, or data warehouse in
this repository — Supabase is the data platform (Postgres tables/views for
analytics, RLS for access control, Edge Functions for anything that needs
service-role privileges).

## Getting started

```bash
git clone https://github.com/Mugweru01/homara-atlas.git
cd homara-atlas
npm install
cp .env.example .env.local   # fill in your own Supabase project values
npm run dev
```

The app runs at `http://localhost:5173`.

### Useful scripts

```bash
npm run dev            # start the dev server
npm run build           # production build
npm run lint             # ESLint
npm run type-check       # tsc --noEmit
npm run format:check     # Prettier check
npm run validate         # type-check + lint + format:check
```

## Contributing

This is a public repository — see [CONTRIBUTING.md](CONTRIBUTING.md) for
the branching model, commit conventions (Conventional Commits, enforced by
commitlint), and required checks before opening a PR.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).
Do not open public issues for security reports.

## License

License to be determined as the project stabilizes.
