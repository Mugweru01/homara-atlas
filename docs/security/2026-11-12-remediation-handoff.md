# Security remediation handoff — 2026-11-12

Status: **OPEN — remediation not yet implemented; do not merge as a security fix.**

## Scope and evidence
Repository: Mugweru01/homara-atlas. Inspected `apps/web/package.json`; Vite is declared as `^7.1.12`. Prior security watch observed Vite 7.3.7 in `apps/web/package-lock.json`; recheck the current locked version before changes.

Security-watch advisory candidates (verify details against the authoritative sources before asserting exposure):
- Vite: https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7 — previously reported affected Vite 7.x through 7.3.7, fixed 7.3.8; potential RCE when development server exposed. **Version match alone is not proof of production exploitability.**
- Node.js: https://nodejs.org/en/blog/vulnerability/november-2026-security-releases — verify current bulletin, individual CVEs, affected ranges and actual runtime versions.

## Developer implementation checklist
- [ ] Reconfirm advisory authenticity, publication date, severity, affected ranges and fixed releases using vendor bulletins and GitHub Security Advisories; correct this document if details differ.
- [ ] In `apps/web`, update Vite to a patched compatible 7.x version, regenerate `package-lock.json` using the project package manager, and commit both manifest and lockfile. Do **not** hand-edit lockfile integrity hashes.
- [ ] Check every other workspace manifest and lockfile for direct and transitive Vite, React, Next.js, Supabase, Convex, DOMPurify and Puppeteer exposure; record exact installed versions and dependency paths.
- [ ] Inspect Vite dev/preview server bindings, Docker, CI and hosting configuration. Ensure development servers are not publicly exposed; distinguish deployed static assets from dev server use.
- [ ] Identify Node.js versions in production hosting, functions, containers and CI. Upgrade vulnerable runtime lines to the official fixed release or later supported security patch. Document proof of deployed versions.
- [ ] Run `npm ci`, `npm run build`, `npm run type-check`, `npm run lint`, `npm audit --omit=dev` and `npm audit` from `apps/web` (where supported). Capture outputs; do not claim tests passed if unavailable.
- [ ] Regression-test authentication, user/tenant isolation, Supabase RLS, Convex staff authorization, API responses, HTTPS/HTTP2, SSR (where applicable), HTML/XSS sanitization, Puppeteer PDF/rendering (where applicable), Vite asset routing, and CI.
- [ ] Record before/after versions, commands, outputs, known limitations, production deployment verification and any residual risk in this file.

## Acceptance criteria
1. All confirmed vulnerable dependencies in scope have patched locked versions, or a documented justified exception.
2. Production Node.js runtime is verified and patched where applicable.
3. Tests and deployment verification evidence are attached to the PR.
4. A reviewer verifies remediation and marks the PR ready; **no automatic merge**.

## Work log
- 2026-11-12: Created security remediation handoff. **No dependency upgrades, runtime changes, or tests completed yet.**
