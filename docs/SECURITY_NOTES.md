# Historical credential finding

During the 5 November 2026 GitHub publication checks, the staged changes passed Gitleaks and checks against the current local credentials. A separate scan of all 70 existing commits flagged historical values that need to be distinguished from current runtime secrets.

## Old Upstash Redis token

- Historical commit: `78de6b1f0a086e5e37679847f4eb0274748be3a1`.
- Historical file/key: `.env`, `VITE_UPSTASH_REDIS_REST_TOKEN`.
- The credential value is deliberately not reproduced here.
- The current Atlas implementation uses Neon and does not use this legacy Redis credential. This does **not** establish that the old token has been revoked.

The account owner should revoke or rotate that token in the old Upstash account and review access there if the service is still active. Deleting a file or adding it to `.gitignore` does not revoke an already published credential. Rotation has not been performed or verified in this session.

No force-push or history rewrite was performed. Rewriting shared history is a separate coordinated operation and does not replace revocation. This note does not whitelist the token or disable detection of new secrets.

## Other historical detections

Three historical JWT detections decode to Supabase's `anon` role; these were browser-facing public project keys, not the current Neon owner/runtime credentials. A fourth detection appears under a `SUPABASE_PUBLISHABLE_KEY` label in an old audit document. Their presence is not evidence that the retired deployment's authorisation configuration was safe; it simply distinguishes public client keys from the Redis token above.

Current env files, encryption keys, local database files, scanner output and backup files remain ignored. Do not commit them when updating this project.
