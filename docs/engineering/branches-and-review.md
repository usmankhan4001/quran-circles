# Branches and review

## Branches

- Integration branch: the branch the orchestrator names for the wave. Agents never push to it directly.
- Lane branches: `lane/<lane>/<topic>`, for example `lane/api-core/venues`. One topic per branch.
- Each agent works in its own git worktree (`docs/agents/worktrees.md`), so two agents never share a working copy.
- Rebase lane branches onto the integration branch before opening a pull request. Do not rewrite history on a branch someone else has pulled.

## Pull requests

- Small: one work package or part of one.
- Use `.github/PULL_REQUEST_TEMPLATE/v2.md`.
- CI must be green before a reviewer looks at it.
- The author never approves their own change.

## Two levels of approval

1. **Reviewer agent approval** for every pull request. A different agent from the author runs the checks in `docs/agents/briefs/reviewer.md` and reports approve or changes-requested with severities.
2. **Human approval** for sensitive areas: sign-in, scope checks, migrations, WhatsApp, account deletion, infrastructure, anything storing personal data, and every contract change. Everything else gets a human spot check.

Configure branch protection on the integration branch: pull request required, status checks required, code owner review required. `.github/CODEOWNERS` lists the sensitive paths.

## Merging

- Squash merge. The commit message names the lane and work package.
- Contract pull requests merge first; affected lanes rebase onto them.
- If two lanes conflict on a file, stop. The lane boundary is wrong; the orchestrator fixes the brief.

## Commit messages

`<lane>: <what changed> (WP<n>)`. Example: `api-core: add venue list endpoint (WP2)`.
