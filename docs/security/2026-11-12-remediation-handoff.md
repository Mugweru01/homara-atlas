# Homara security remediation — developer implementation and review handoff
Date: 2026-11-12 | PR: #51 | Branch: `security/2026-11-12-vite-node-remediation`
Status: **DRAFT / NOT MERGEABLE**. This document is the source of truth; update it on every push.

## 1. Executive summary and severity
**P0 — Vite development-server RCE (Critical, CVSS 9.1)**: GHSA-p4f5-76q4-ffq7, published 2026-11-10. Official advisory: https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7 . Vite 7.x affected `>=7.0.0 <=7.3.7`; fixed `7.3.8`. Only remotely exploitable if a Vite development server is explicitly network-exposed via `--host` or `server.host`. Compiled static assets alone are not the vulnerable server. **Version-level exposure previously identified, deployed exploitability NOT established.**

**P1 — Node.js runtime vulnerabilities (High)**: official bulletin published 2026-11-11: https://nodejs.org/en/blog/vulnerability/november-2026-security-releases . Fixed versions: Node 22.23.5, 24.22.3, 26.13.1. Relevant High CVEs include:
- CVE-2026-123863: HTTP/2 session teardown process abort (24.x, 26.x).
- CVE-2026-123864: HTTPS parser re-entrancy, possible cross-connection memory disclosure (22.x, 24.x, 26.x; conditional on application handler behavior).
- CVE-2026-123865: HTTP/2 session resource leak (22.x, 24.x, 26.x).
- CVE-2026-123866: HTTP/2 stream teardown memory disclosure (22.x, 24.x, 26.x).
- CVE-2026-126051: TLS handshake deferred-callback process crash (24.x, 26.x).
- CVE-2026-123872: TLS 1.2 renegotiation client-certificate policy bypass (22.x, 24.x, 26.x; multi-host mTLS configuration).
- CVE-2026-123874: HTTP/2 `respondWithFile`/`respondWithFD` use-after-free (24.x, 26.x).
Other medium issues can still be actionable where app features match; see bulletin. **Actual production runtime and feature exposure NOT verified**. Never equate `@types/node` with the deployed runtime.

## 2. Evidence and verification matrix
| Component | Observed source | Evidence | Exposure classification | Required follow-up |
|---|---|---|---|---|
| Vite | `apps/web/package.json` | Direct devDependency `"vite": "^7.1.12"`; prior lockfile inspection reported `node_modules/vite@7.3.7` | Affected version previously observed; deployed exploitability unknown | Recheck lockfile current version; identify network-facing dev server and patch |
| Node.js | `apps/web/package.json` | `@types/node: ^22.16.5` is **types only**, not runtime | Not verifiable | Obtain actual `node -v` from deployed services/CI |
| React, Supabase JS | Frontend manifest | Direct dependencies present | No new confirmed advisory match in this handoff | Scan actual lockfile and upstream advisories |
| Next.js, Convex, DOMPurify, Puppeteer | Not established from inspected manifest | May exist elsewhere in repo/deployments | Not verifiable | Inventory other manifests/lockfiles, production artifacts |

No runtime, CI, endpoint or regression test has been executed by this PR yet.

## 3. Workstream A — patch Vite (P0)
1. From repo root identify package-manager choice and lockfile ownership. In `apps/web`, run `npm ls vite --all` and inspect `node_modules/vite.version` in lockfile. Paste before-state version and dependency path here.
2. Update direct Vite requirement to a compatible patched 7.x (minimum 7.3.8); use `npm install -D vite@^7.3.8` in `apps/web`, assuming npm is canonical. Commit **both** `apps/web/package.json` and `apps/web/package-lock.json`. Never manually forge lockfile integrity values.
3. Re-run `npm ci` and `npm ls vite --all`; verify no installed affected version remains. Check `@vitejs/plugin-react-swc` compatibility and any Vite transitive dependencies.
4. Search `vite.config.*`, package scripts, Docker/compose, hosting, GitHub Actions and preview environments for `--host`, `server.host`, `0.0.0.0`, port 5173 and public tunnels. Record each result and whether accessible from untrusted networks. Restrict access with binding, firewall and/or auth; do not expose Vite dev server to the internet.
5. Verify static production build and preview separately. Do not execute public exploit payloads; use safe configuration checks and local regression tests.

## 4. Workstream B — Node.js runtime (P1)
1. Inventory production services, Vercel/other hosting runtimes, edge/serverless functions, containers, worker processes, CI runners and local build images. Capture actual versions, source of truth (`engines`, Docker base, hosting dashboard, `node -v`), and whether each runs user-facing HTTP(S).
2. Compare each deployed version to the official bulletin. Upgrade affected supported lines to **at least** 22.23.5 / 24.22.3 / 26.13.1 as appropriate. Prefer current supported LTS and avoid unnecessary major upgrades without compatibility testing.
3. Map HTTP/2, TLS/mTLS, session resumption, HTTPS request-body streaming, `flushHeaders`, file responses, `server.addContext` and custom TLS callbacks. Record yes/no/unknown and owning code paths. If TLS/HTTP2 is terminated by a managed proxy, verify where vulnerable Node APIs actually execute.
4. Roll out staging first, monitor crash rate, latency, memory, open sockets, auth failures and error budgets. Record production deployment SHA and verified runtime version after release.

## 5. Workstream C — whole-repository inventory and audit
Search tracked `package.json`, npm/pnpm/yarn/bun lockfiles, Dockerfiles, workflows and deployment manifests; include backend, staff and scripts, not just `apps/web`. For each of Next.js, React, Node.js, Supabase, Convex, DOMPurify, Puppeteer and relevant transitives, report: manifest path, dependency path, locked version, advisory ID/date/severity, affected/fixed versions, reachable functionality, and status **confirmed version match / potential / not verifiable / not affected**. Distinguish runtime vs devDependency, production artifact vs development tooling. Document missing/untracked deployment configuration as gaps, not negative findings.

## 6. Required commands and regression evidence
Run from `apps/web` (adjust script names to actual `package.json`; never claim a missing script passed):
```bash
node --version
npm --version
npm ci
npm ls vite --all
npm run build
npm run lint
npm audit --omit=dev
npm audit
```
Also run TypeScript/type-check and test scripts **only if defined**, plus project-specific backend/staff checks. Save exact commands, exit codes, summarized failures and relevant log links in this PR; distinguish environment/billing failures from code failures.

Regression matrix — record pass/fail/not applicable/not run and evidence for each:
- [ ] Vite dev-server access restrictions, hot reload, module imports, build and static asset routes.
- [ ] Authentication login/logout, OTP/session expiry, tenant isolation, authorization and privilege boundaries.
- [ ] Supabase RLS: anonymous/tenant/owner/staff negative-access tests, service-role isolation, storage rules.
- [ ] Convex: server-side claims and role checks, cross-tenant denial, mutation/query permission boundaries.
- [ ] API: status/error contracts, CORS, rate limits, upload/download, pagination and secrets.
- [ ] SSR/Next.js only if present: route rendering, cache isolation, headers, cookies, server actions.
- [ ] XSS/sanitization: untrusted HTML/Markdown, DOMPurify if present, CSP and injection regressions.
- [ ] Puppeteer only if present: PDF generation, sandbox/remote URL restrictions, timeout/resource controls.
- [ ] Node TLS/HTTP2: session isolation, malformed input handling, mTLS policies where applicable, resource stability.
- [ ] CI: clean install, lint, type-check, build, test, dependency scan, deployment smoke test.

## 7. Developer reporting contract
**For every push**, update this handoff with:
- Commit SHA, timestamp, files changed, and what risk each change mitigates.
- Before/after dependency versions and exact dependency paths.
- Commands run, exit codes, evidence links, blocked tests and their reasons.
- Updated checklist and outstanding risks; no blanket “all done” without proof.
- Explicit questions requiring owner decision, if any.

Use PR comments for concise milestone updates and point reviewers to exact changed files/lines. Do not silently expand scope, suppress audit findings, disable security controls or merge. If additional advisories are discovered, add them to the matrix and explain production relevance.

## 8. Merge gates
- [ ] Advisory and affected/fixed versions reconfirmed from official sources.
- [ ] Patched Vite version committed in manifest **and** lockfile; clean install succeeds.
- [ ] Public dev-server exposure closed or disproven with configuration evidence.
- [ ] Deployed Node versions verified and patched where vulnerable.
- [ ] All in-scope manifests/lockfiles inventoried; findings and exceptions documented.
- [ ] Relevant regression tests and CI run; failures explained and accepted by reviewer.
- [ ] Staging smoke test and production rollout/rollback plan documented.
- [ ] Independent code review approval; PR converted from draft only when complete.
**No merge or production-security-complete claim until gates are met.**

## 9. Work log
- 2026-11-12: Draft PR #51 created with documentation only; no remediation code.
- 2026-11-12: Expanded official advisory details, implementation steps, test matrix, developer reporting protocol and merge gates. **No patches or tests performed yet.**
