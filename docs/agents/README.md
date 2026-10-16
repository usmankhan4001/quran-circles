# Agent operating guide

How the multi-agent build works. Read this, then `CLAUDE.md`, then your lane's brief in `briefs/`.

## Roles

| Role         | Who                                                         | Responsibility                                                                                                   |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Orchestrator | The owner or the lead developer, with a main Claude session | Owns the plan, the contracts and the gates. Writes each lane's brief. Merges                                     |
| Builder      | One Claude agent per lane, in its own worktree and branch   | Implements the lane's work packages and tests inside the directories it owns, in small pull requests             |
| UI agent     | A builder for the ui lane                                   | Owns visual and interaction design, the design tokens, the shared component kit and screen specs                 |
| Reviewer     | A separate Claude agent that did not write the code         | Reviews every pull request for correctness, scope and security. Never edits code                                 |
| Test agent   | A Claude agent for each integration wave (integration lane) | Writes and runs end-to-end tests and reports regressions to the owning lane                                      |
| Humans       | The owner and the full developer                            | Approve contracts, migrations, sign-in and scope code, WhatsApp templates and every release; test on real phones |

## Lanes and briefs

| Lane           | Brief                      | Work packages         | Starts in                                        |
| -------------- | -------------------------- | --------------------- | ------------------------------------------------ |
| platform       | `briefs/platform.md`       | WP0, WP10             | Wave 0                                           |
| contracts      | `briefs/contracts.md`      | WP1                   | Wave 1                                           |
| ui             | `briefs/ui.md`             | WP21                  | Wave 2 (first, because others depend on the kit) |
| api-core       | `briefs/api-core.md`       | WP2, WP19 (API part)  | Wave 2                                           |
| auth-scopes    | `briefs/auth-scopes.md`    | WP3                   | Wave 2                                           |
| messaging      | `briefs/messaging.md`      | WP4, WP14             | Wave 2                                           |
| user-app       | `briefs/user-app.md`       | WP5, WP17, WP19, WP20 | Wave 2                                           |
| admin-app      | `briefs/admin-app.md`      | WP6, WP17             | Wave 2                                           |
| console        | `briefs/console.md`        | WP7, WP15, WP19       | Wave 2                                           |
| content        | `briefs/content.md`        | WP8, WP18             | Wave 2                                           |
| data-migration | `briefs/data-migration.md` | WP9                   | Wave 2                                           |
| integration    | `briefs/integration.md`    | WP11                  | Wave 3                                           |
| renderer       | `briefs/renderer.md`       | WP16                  | Wave 4                                           |
| quality        | `briefs/quality.md`        | WP12                  | Wave 5                                           |
| release        | `briefs/release.md`        | WP13                  | Wave 6                                           |
| reviewer       | `briefs/reviewer.md`       | all                   | Every wave                                       |

## Rules every agent follows

- **One owner per directory.** A change outside your lane's directories is a contract change request.
- **Contracts live in shared packages.** They change only through their own pull request, which every affected lane then rebases onto.
- **Every brief has the same parts:** goal, directories owned, contracts to follow, deliverables, definition of done, and the exact commands that must pass.
- **Small pull requests that pass CI first.** `pnpm check` must be green before a reviewer looks at a change.
- **Two levels of approval.** Sensitive areas need a human approval. Everything else needs a reviewer-agent approval and a human spot check.
- **No production secrets for agents.** Deployments run through CI.
- **No two agents edit the same file.** A conflict means the lane boundary is wrong. Stop and tell the orchestrator.

## Starting an agent

See `worktrees.md`. In short: create a worktree on a lane branch, open a Claude session there, and give it this prompt:

> Read `v2/CLAUDE.md`, `v2/docs/agents/README.md` and `v2/docs/agents/briefs/<lane>.md`. Do the next unfinished item in the brief's deliverables. Stay inside the directories you own. Run `pnpm check` before you finish and update `v2/docs/agents/status/<lane>.md`.

## Handoffs

- **Status files:** each agent updates `status/<lane>.md` at the end of every session (`status/README.md`).
- **Contract change requests:** `docs/engineering/contracts-process.md`.
- **Outside dependencies:** if you are blocked by something outside the repository, use the stand-in your brief lists and say so in your status file.
- **Review:** open the pull request with `.github/PULL_REQUEST_TEMPLATE/v2.md`. A reviewer agent reviews it with `briefs/reviewer.md`.
