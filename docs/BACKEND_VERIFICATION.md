# Backend milestone verification — 5 November 2026

Production API and worker are deployed on the existing Neon project. Database changes are additive migrations; no frontend files were edited in this milestone. A before/after SHA-256 comparison covered all 115 frontend files and found no changes. No AI inference or paid upgrade was enabled.

| Check | Observed result |
|---|---|
| TypeScript backend compilation | Passed |
| Full backend suite on isolated Neon database | 18 passed |
| Python compatibility API suite | 9 passed |
| Backend Node dependency audit | 0 known vulnerabilities |
| Locked Python dependency audit | 0 known vulnerabilities |
| Runtime credentials | Dedicated non-admin API/worker logins; no owner fallback |
| Database authorization | Evidence immutable; privilege escalation denied; report RLS enforced; direct live-projection reads denied |
| Worker source permissions | Separate final regression passed: worker cannot create/approve sources, but collection scheduling and housekeeping still work |
| Durable processing | Idempotency after payload scrubbing, scoped IDs, concurrent claims, expired leases/fencing, retries and quarantine tested |
| Publication correctness | Golden-data medians, sale/rent separation, minimum sample and reviewed duplicate suppression passed |
| HTTP authorization | Missing/bad JWT rejected; non-operator denied; other user's report returns 404 |
| Input/security bounds | Unknown/nested/contact fields, malformed JSON, body/pagination/rate limits, SSRF targets and changed source licenses rejected |
| Failure recovery | Failed object upload retains durable cleanup intent; report deletion and pending-object housekeeping tested |
| Deployed worker | Internal invocation 200; anonymous execution and forged Neon scheduler headers 401 |
| Deployed reports | Two-user signup/session restoration, private download, cross-user isolation, live committed update and deletion passed |
| Public data | 104 World Bank annual observations and 47 counties committed; two source jobs succeeded; no listing observations invented |
| Private raw evidence | Three compressed checksum-addressed artifacts retained |
| Automatic collection | Enabled production-only hourly trigger; daily WDI and weekly geography refresh |
| Portable restore drill | Encrypted backup restored to isolated branch; 104 observations, 47 counties and three read-back raw checksums matched; wrong encryption key rejected |
| Restore protection | Exact isolated branch confirmation plus actual DB hostname and storage endpoint checks; production targets rejected |
| Test cleanup | Validation and restore branches deleted; only production remains |

Neon Realtime rejects RLS tables. The live-report metadata projection is transactional, contains no report bodies/download keys, denies API/worker direct reads and is exposed solely through a short-lived, owner-filtered sealed capability. Report CRUD remains RLS protected. The live verification exercised this exact design.

The latest encrypted backup and its separately stored encryption key are ignored local files. Managed Auth recovery remains provider-owned. Scheduled off-device backup retention is not configured; copy encrypted backups off this machine and retain the key independently before relying on them for disaster recovery. The restore drill proves the Atlas snapshot, not recovery of the entire provider account.

No approved partner listing feed exists. WDI and county boundaries supply context, not current rents, achieved sales, household income or property inventory. Market estimates correctly remain unavailable. Granting the first human administrator and approving an actual feed require a real existing Auth account and rights evidence; no account or partner consent was fabricated.

Free-plan quotas, upstream outages and provider beta limitations remain operational constraints. These checks are implementation evidence, not a guarantee of zero future defects or an independent penetration test. The backend/database are live. The implementation is tracked in PR #40; merging the PR and promoting the frontend are separate deployment decisions.

See [operations and recovery](BACKEND_RUNBOOK.md) and [the API contract](BACKEND_API.md) for use and maintenance.
