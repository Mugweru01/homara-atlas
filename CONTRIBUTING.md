# Contributing to Homara Atlas

Thanks for your interest in contributing. This is a public repository —
assume any pull request, including from forks, is untrusted until reviewed.

## Getting started

```bash
git clone https://github.com/Mugweru01/homara-atlas.git
cd homara-atlas
npm install
cp .env.example .env.local   # fill in your own Supabase project values
npm run dev
```

## Before opening a PR

Run the same checks CI runs, locally:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm run type-check    # tsc --noEmit
npm run build          # production build
```

`npm run validate` runs type-check + lint + format:check in one go.

A pre-commit hook (via Husky + lint-staged) already runs formatting and
linting on staged files automatically.

## Branching and commits

- Branch from `main`: `feature/<short-description>`, `fix/<short-description>`,
  `chore/<short-description>`.
- Commit messages must follow
  [Conventional Commits](https://www.conventionalcommits.org/) — this is
  enforced by commitlint on every PR (`type(scope): description`, e.g.
  `fix(auth): handle expired session token`).
- Keep PRs focused. Large, unrelated changes are harder to review and slower
  to merge.

## Pull requests

- Fill out the PR template — it's short by design.
- All required status checks (lint, type-check, build, CodeQL, dependency
  review, secret scanning) must pass before merge.
- Conversations must be resolved before merge.
- A maintainer review is required — see `.github/CODEOWNERS`.

## Security

Do not open public issues for security vulnerabilities — see
[SECURITY.md](SECURITY.md) for the private disclosure process.

Never commit real credentials. `.env.example` documents every environment
variable this project uses; copy it to `.env.local` and fill in your own
values. `.env.local` is gitignored.

## Code style

- TypeScript strict mode is enabled — avoid `any` where a real type is
  available.
- Components follow the existing shadcn/ui + Tailwind conventions already
  in `src/components/ui/`.
- Prettier and ESLint configs are the source of truth for formatting; don't
  hand-format against them.
