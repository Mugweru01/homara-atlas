# Secrets Management Guide

Homara Atlas uses a Zero-Trust security model. No production secrets should ever be committed to the repository.

## GitHub Encrypted Secrets
The repository relies on GitHub Actions Environments for managing deployments. Secrets are scoped to environments (`staging`, `production`) and require manual approval before deployment.

### Required Secrets
To fully enable the CI/CD pipeline, the following secrets must be provisioned in the GitHub Repository Settings:

- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: For deploying infrastructure via Terraform.
- `SUPABASE_ACCESS_TOKEN`: For running database migrations.
- `REDSHIFT_ADMIN_PASSWORD`: For the data warehouse provisioning.

### Local Development
- Copy `.env.example` to `.env.local` for local frontend development.
- Never commit `.env.local` or `.env` files. (They are in `.gitignore`).

### Secret Scanning
TruffleHog and GitHub Advanced Security are configured to automatically scan all commits and PRs. If a secret is detected, the pipeline will fail immediately, and the commit must be amended to remove the secret before it can be merged.
