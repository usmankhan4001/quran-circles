# Running agents in parallel with git worktrees

Each agent gets its own working copy and branch, so agents never overwrite each other. Run these from the repository root.

```sh
# one worktree per lane, on a lane branch cut from the integration branch
git fetch origin
git worktree add ../qc-api-core -b lane/api-core/venues origin/<integration-branch>
cd ../qc-api-core
pnpm install
claude
```

Then give the agent the standard prompt from `docs/agents/README.md`.

## Rules

- One worktree and one branch per agent. Never run two agents in the same worktree.
- V1 lives in its own repository (`usmankhan4001/nearby-dora-quran`) and is off limits to agents.
- `pnpm install` is fast after the first run because pnpm shares its store across worktrees.
- Remove a worktree when its pull request merges:

```sh
git worktree remove ../qc-api-core
git branch -d lane/api-core/venues
```

## Running many at once

- Start the Wave 1 contracts lane alone. Nothing else starts until Gate 1.
- At Wave 2, start the ui lane first. Its component kit is what the user app, admin app and content lanes wait on. The other lanes can start at the same time against the mock server.
- Keep a list of open worktrees in `docs/agents/status/orchestrator.md`.

## Cloud sessions

The same flow works with cloud sessions: one session per lane, each on its own lane branch, started with the same prompt. Do not give a session production credentials.
