# Branch Protection & Repository Settings

These are GitHub *repository settings*, not files in this repo, so they
can't be applied by merging a PR. Run the commands below (or the
equivalent Settings UI steps) once, as the repo owner, using the
[GitHub CLI](https://cli.github.com/) (`gh auth login` first).

## 1. Protect `main`

Requires: PR before merge, passing status checks, resolved conversations,
no force-push, no branch deletion, admins included.

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  repos/Mugweru01/homara-atlas/branches/main/protection \
  -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=Code Quality Checks' \
  -f 'required_status_checks.contexts[]=Security Audit' \
  -f 'required_status_checks.contexts[]=Build Application' \
  -f 'required_status_checks.contexts[]=Analyze Code' \
  -f 'required_status_checks.contexts[]=Gitleaks Secret Scan' \
  -f 'required_status_checks.contexts[]=Review Dependencies' \
  -F enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_pull_request_reviews.require_code_owner_reviews=true \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_conversation_resolution=true
```

Status check context names must match the exact job `name:` fields in the
workflow files — re-check these after any workflow rename
(`ci.yml`, `codeql-analysis.yml`, `gitleaks.yml`, `dependency-review.yml`).

## 2. Require a manual reviewer for the `production` environment

The `production` GitHub Environment already exists (referenced in
`deploy-production.yml`). Add a required reviewer via the UI — this isn't
exposed through a simple `gh api` one-liner:

**Settings → Environments → production → Required reviewers → add yourself
(and any other maintainers)**, then check "Prevent self-review" only if
more than one maintainer exists.

This ensures every deploy to production needs an explicit human approval
click, even though the workflow itself is already gated to `push` on
`main`/tags (which forks cannot trigger).

## 3. Enable secret scanning + push protection

```bash
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  repos/Mugweru01/homara-atlas \
  -F security_and_analysis.secret_scanning.status=enabled \
  -F security_and_analysis.secret_scanning_push_protection.status=enabled \
  -F security_and_analysis.dependabot_security_updates.status=enabled
```

Push protection rejects a `git push` containing a recognized secret pattern
*before* it ever lands in the repo — this is a stronger guarantee than the
Gitleaks Action alone (which only flags secrets after they're already
pushed).

## 4. Verify Dependabot alerts are on

Usually on by default for public repos, but confirm:
**Settings → Code security and analysis → Dependabot alerts → Enabled.**
`dependabot.yml` (added in this repo) handles version-update PRs; this
setting handles vulnerability alerts on existing dependencies.

## Why this isn't automated

Branch protection and environment reviewer settings are live changes to
how collaboration works on this repo (who can merge, whether pushes are
blocked). They're deliberately left as commands for you to run and review
rather than applied silently by an agent or CI job.
