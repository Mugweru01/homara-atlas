# Homara Atlas — Neon setup handoff

> Continued and superseded by [NEON_READINESS.md](NEON_READINESS.md). Current scope excludes AI and uses free-plan services.

Updated: 2026-11-05 UTC. This is an incomplete setup, not a deployment report.

## User's authorized goal

Set up the existing Atlas application on Neon, using:

- Organization: `org-soft-bread-75702162`
- Project: `withered-cell-31446643`
- Branch: `production`
- Services: Postgres, Auth, AI Gateway, Object Storage, Functions, Realtime

User explicitly requested installing the latest Neon CLI (fall back to npx), running the init command below, deploying, wiring every service into application code, passing `npm run build`, starting the app, and proving each service works end to end. Report actual outputs and failures. User considers Neon the intended database; Supabase code may be legacy. Do not infer the deployed database from repository files.

## Repository and workspace

- GitHub: https://github.com/Mugweru01/homara-atlas
- Local checkout: `/workspace/homara-atlas`
- Checked-out commit: `c4932cd183d559401147a8276f489dfa4f2409fe`
- Frontend: React 18 + Vite + React Router in `apps/web`.
- Existing backend: Python FastAPI in `api`; analytics and ingestion in `api/app`.
- No application service integrations have been rewritten yet. No commits or pushes made.

## Completed

1. Cloned repository and installed frontend dependencies with `npm ci --ignore-scripts` in `apps/web` (640 packages).
2. Installed Neon skills into `/workspace/scratch/.agents/skills/`; all seven default `SKILL.md` files exist. Top-level `/workspace/.agents` and `.codex` are protected, so use a writable project directory. The initial installer misleadingly reported success there without persistent files; installation into scratch was verified on disk.
3. Attempted `npm i -g neon@latest`; it failed writing `/home/agent/.local/lib`. Use `npx --yes neon@latest`. Version observed: `8.18.0`.
4. Ran, in the repository root:

   ```sh
   npx --yes neon@latest init -y --org-id org-soft-bread-75702162 --project-id withered-cell-31446643 --branch production --services postgres,auth,ai-gateway,object-storage,functions,realtime
   ```

   CLI created `.neon` (gitignored), `neon.ts`, `hello.ts`, root `package.json` and `package-lock.json`, and installed `@neon/config` / `@neon/env`. Added `.neon` to `.gitignore`.
5. Current `neon.ts` declares `auth: true`, `aiGateway: true`, `preview.realtime: true`, private bucket `assets`, and starter function `hello`. Postgres is inherent to the project. It includes starter branch policy. Inspect and evolve this file rather than overwrite blindly.

## Authentication blocker

Init output explicitly said:

```text
Written offline (--no-checks): nothing was verified.
Neon setup failed.
Agents   not installed
Project  linked, not verified
Config   neon.ts created
```

Plugin install failed trying to create `/home/agent/.cache/plugins`. Existing skills are available separately; plugin failure is not proof the project link or services were verified.

`neon login` and `neon deploy` both requested browser authentication. Login timed out:

```text
ERROR: Authentication timed out after 60 seconds
```

User was on their phone and saw no browser window. The OAuth flow redirects to loopback on the machine running the CLI; a phone opening the URL cannot normally deliver that callback to this cloud runtime. Do not reuse expired auth URLs. No authenticated remote deployment or inspection occurred. No `.env.local` was pulled. No remote database changes were made by these commands.

User was asked to configure `NEON_API_KEY` as a cloud-environment secret, not paste it into chat, or complete `neon login` on the execution machine. Do not assume either happened. Check credential readiness without printing values. Do not create a replacement project or claimable database.

Latest user asks for this handoff or access to their already-connected laptop. Browser skill is available, but a fresh tool discovery found no browser `js`, tab, desktop-control, or handoff tools callable in this session. Cannot verify laptop connection or access laptop shell/files. A browser extension connection is not general laptop terminal access. A new agent with laptop execution/browser tools should inspect its own capabilities.

## Cloud execution details

Read the cloud-environment-runtime skill and current environment status/network policy before network work. Ordinary sandbox commands could not reach the proxy. Network-enabled commands succeeded with `sandbox_permissions: with_additional_permissions` and `additional_permissions.network.enabled: true`.

Writable npm/config locations used, without changing HOME:

```sh
XDG_CONFIG_HOME=/tmp/homara-config \
XDG_CACHE_HOME=/tmp/homara-cache \
npm_config_cache=/tmp/homara-npm-cache \
npx --yes neon@latest <command>
```

These paths are environment workarounds, not application configuration. If credentials are supplied elsewhere, select their legitimate configured location; do not silently select an empty temporary profile. Never print credentials, connection strings, tokens, or env-file contents.

## Actual build result

Ran `npm run build` in `apps/web`. Ordinary sandbox first failed with a tsx IPC `listen EPERM`; reran with network-enabled execution and reached the actual project failure:

```text
> vite_react_shadcn_ts@0.0.0 build
> tsx vite-env-validate.ts && vite build

Missing required environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
```

This is not a passing build. Root package currently contains only Neon dependencies and has no build script. Establish a deliberate root build command or clearly run the frontend's command. Do not use dummy Supabase variables just to claim a Neon build passed.

## Important existing defects and integration points

- `apps/web/vite-env-validate.ts` still requires Supabase variables.
- `apps/web/src/integrations/supabase/client.ts` creates a browser Supabase client; inspect actual imports before migration/removal.
- `apps/web/vite.config.ts` proxies `/api` to localhost:8000 and manually chunks Supabase; frontend uses `VITE_API_URL`.
- Backend `api/app/db.py` uses `DB_HOST`, `DB_USER`, `DB_PASS` in production (documented as RDS); development uses DuckDB. It has no Neon DATABASE_URL integration yet.
- Only overview has a production PostgreSQL branch; other analytics always load local Parquet. Loader concatenates all partitions without deduplication.
- Ingestion generates six synthetic listings, is unauthenticated, uses process-local background jobs, and `/jobs` is a stub.
- Price Index, Neighbourhoods, Affordability contain hardcoded data. Heat Maps is a placeholder. Do not present these as verified market intelligence.
- Atlas operational SQL contains Supabase-specific `auth.users` / `auth.uid()` and self-referencing RLS. Do not apply legacy migrations wholesale to Neon.
- Legacy `create_admin` security-definer function trusts caller-supplied creator ID; deployment/exposure unknown.
- Frontend CI suppresses typecheck/lint/test failures; test script is a no-op. Root CI workflows reference the wrong directory.
- Compose has wrong health path, a curl healthcheck without curl installed, and mismatched Vite variable naming/runtime injection.

## Resume workflow

1. Read applicable local AGENTS.md and installed Neon skills. Do not spawn agents unless explicitly authorized by user or applicable instructions.
2. Verify credentials, exact project/branch, region, existing schema/data, and service state. Skills list supported regions for Functions/Storage/Gateway/Realtime; confirm project eligibility. Preserve existing data and services.
3. Re-run necessary setup with authentication, inspect `neon config plan`, then run user-authorized `neon deploy`. Empty config slots or hello function are not completed app wiring.
4. Match services to useful Atlas flows: identity/session, warehouse-backed analytics, authenticated API/functions, private report/dataset objects, grounded AI summaries, and live query updates. Existing FastAPI can remain where appropriate; do not force a framework rewrite just because skills prefer another stack.
5. Keep database, storage, AI, realtime sealing secrets server-side. Browser receives only public URLs and user tokens. Validate JWTs and resource authorization in handlers.
6. Skills recommend module-scope small `pg` pools with `attachDatabasePool` for long-running Neon Functions; preserve compatible Python PostgreSQL driver if keeping FastAPI. Read current service references before implementing.
7. Run real build and start app. Exercise sign-up/sign-in/sign-out/session restoration/protected requests; database read/write; deployed Function invocation; object upload/download; actual Gateway inference; and realtime committed update observed by a subscription. Clean up test artifacts. Report failed/blocked checks honestly, including external limitations.
8. Capture sanitized command output and write a final report listing changed files, deployed URLs, build evidence, service-by-service evidence, and remaining blockers. No claims of success from config creation or env presence alone.

## Relevant skills

Installed at `/workspace/scratch/.agents/skills/`:

- `neon/SKILL.md`
- `neon-postgres/SKILL.md`
- `neon-auth/SKILL.md` and `references/managed-auth.md`
- `neon-functions/SKILL.md` and `references/production-hardening.md`
- `neon-object-storage/SKILL.md`
- `neon-ai-gateway/SKILL.md`
- `neon-realtime/SKILL.md` and references for queries/subscriptions/reactivity

Use current Neon documentation as source of truth. Skills contain some evolving CLI notes; verify against installed CLI help. Auth, schema, and all service end-to-end verification remain outstanding.
