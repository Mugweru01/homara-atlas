# Security Policy

Homara Atlas is a public, open-source repository. We follow a zero-trust
posture: nothing sensitive (production secrets, customer data, credentials,
certificates) is expected to ever live in this repository, its history, its
CI logs, or its build artifacts. If you find something that contradicts
that, please report it — see below.

## Supported Versions

This project does not yet have tagged releases with independent long-term
support. Security fixes are applied to the `main` branch only.

| Branch | Supported |
| ------ | --------- |
| `main` | ✅ |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report vulnerabilities privately using
[GitHub Security Advisories](https://github.com/Mugweru01/homara-atlas/security/advisories/new)
for this repository. This creates a private discussion visible only to the
maintainers until a fix is ready.

Include, where possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof of concept
- Affected files, endpoints, or Supabase RLS policies
- Any suggested remediation

### What to expect

- **Acknowledgement:** within 3 business days
- **Initial assessment:** within 7 days of acknowledgement
- **Fix or mitigation timeline:** communicated once severity is assessed;
  critical issues are prioritized immediately

We will credit reporters (unless anonymity is requested) once a fix has
shipped and been disclosed responsibly.

## Scope

In scope:

- The application code in this repository (`src/`, `supabase/`)
- GitHub Actions workflows in `.github/workflows/`
- Supabase Row-Level Security policies and database migrations

Out of scope:

- Third-party services this project depends on (Supabase, Vercel, npm
  packages) — report those upstream
- Social engineering, physical security, or denial-of-service testing
  against production infrastructure

## Secret Scanning

This repository runs automated secret scanning (Gitleaks) on every push and
pull request, in addition to GitHub's native secret scanning and push
protection. If a secret is ever accidentally committed, treat it as
compromised, rotate it immediately, and report it via a security advisory
so history can be scrubbed.
