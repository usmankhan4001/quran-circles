# Rules for every agent working in this repository

You are one agent in a multi-agent build. Read `docs/agents/README.md` and your lane's brief in `docs/agents/briefs/` before writing code. Product decisions are in `docs/product/decisions.md`. Do not re-decide them.

## Commands

Run from the repository root:

- `pnpm install`
- `pnpm check` runs typecheck, lint, tests and the format check. It must pass before you open a pull request.
- `pnpm --filter <package> <script>` runs one package. Example: `pnpm --filter @qc/api test`.
- `pnpm format` fixes formatting.

## Boundaries

- One owner per directory. The lane map is in `docs/engineering/ownership.md`. Edit only the directories your brief lists.
- If you need a change outside them, write a contract change request (`docs/engineering/contracts-process.md`) and stop. Do not edit another lane's files.
- Shared packages (`contracts`, `db`, `ui`, `i18n`, `messaging`) change only through their own pull request, never as a side effect of a feature.
- Apps never import other apps. Packages never import apps. Lint enforces this.

## Never

- No secrets, tokens, passwords, keys or real personal data in code, tests, fixtures, logs or docs. Use fakes and synthetic data.
- No `@supabase/*`, `@neondatabase/*` or OneSignal. V2 talks to plain Postgres through the API only.
- No production credentials. Production deploys from `main` through Dokploy (auto-deploy is on), so a lane agent never pushes to `main` or deploys.
- No skipped, disabled or deleted tests to make a check pass.
- Do not log phone numbers, names or message bodies.

## Code

- TypeScript strict. No `any`; validate all external input with the Zod schemas in `@qc/contracts`.
- Every user-facing string goes through `@qc/i18n`, with English and Urdu keys added together. Urdu values you write are drafts and carry the review marker.
- Designs must work left-to-right and right-to-left, at all four text sizes, in light and dark.
- Small changes: one work package or part of one per branch and pull request, opened when the owner or orchestrator asks. Branch name `lane/<lane>/<topic>`.
- Write tests with the code, including failure paths. Scope and authorisation code needs a test for every role.

## Finishing a session

Update `docs/agents/status/<lane>.md`: done, in progress, blocked, questions for the orchestrator. Then stop; the orchestrator assigns the next step.
