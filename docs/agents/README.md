# Agent operating guide

How the multi-agent build works. Start at [`AGENTS.md`](../../AGENTS.md) in the repository root (the short version), then read this page, then your lane's brief and status file. [`CLAUDE.md`](../../CLAUDE.md) holds the full rules.

## Current phase

The project was parked on 2026-10-18 ([`handoff.md`](../handoff.md)). Waves 0 to 4 are built, and Wave 5 is done apart from the production restore drill. `handoff.md` (dated 2026-10-18) says Wave 6 (pilot and release) and Wave 7 (circle requests and the demand map) have not started. Work since then shows release preparation under way, with no gate signed: a Firebase Android app, an EAS project and a first Android build ([`status/platform.md`](status/platform.md), 2026-10-25), the go-live plan ([`docs/release/go-live.md`](../release/go-live.md)), a Play Console draft ([`docs/release/play-console.md`](../release/play-console.md)) and public store pages ([`status/web.md`](status/web.md)). Production still does not exist. Ask the orchestrator for the current state of Wave 6.

The wave and work-package model below is the plan the build followed. It is not a queue: new work comes as follow-up lanes (below) that work from the "In progress" section of their own status file, and its "Next step" line where it has one. If you are unsure what to do, ask the orchestrator.

## Where things live

| What                                 | Where                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lane briefs                          | [`briefs/`](briefs/), format in [`brief-template.md`](brief-template.md)                                                                                           |
| Lane status, one file per lane       | [`status/`](status/README.md); gate sign-offs in `status/orchestrator.md`                                                                                          |
| Which lane owns which directory      | [`docs/engineering/ownership.md`](../engineering/ownership.md)                                                                                                     |
| Contract changes and change requests | [`docs/engineering/contracts-process.md`](../engineering/contracts-process.md); requests in [`docs/engineering/change-requests/`](../engineering/change-requests/) |
| Settled product decisions            | [`docs/product/decisions.md`](../product/decisions.md)                                                                                                             |
| Branches, review and commit messages | [`docs/engineering/branches-and-review.md`](../engineering/branches-and-review.md)                                                                                 |
| Worktrees and Windows hazards        | [`worktrees.md`](worktrees.md)                                                                                                                                     |
| Where the project stands             | [`handoff.md`](../handoff.md)                                                                                                                                      |

## Roles

| Role         | Who                                                         | Responsibility                                                                                                   |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Orchestrator | The owner or the lead developer, with a main Claude session | Owns the plan, the contracts and the gates. Writes each lane's brief. Merges                                     |
| Builder      | One Claude agent per lane, in its own worktree and branch   | Implements the lane's work packages and tests inside the directories it owns, in small changes                   |
| UI agent     | A builder for the ui lane                                   | Owns visual and interaction design, the design tokens, the shared component kit and screen specs                 |
| Reviewer     | A separate Claude agent that did not write the code         | Reviews every change for correctness, scope and security. Never edits code                                       |
| Test agent   | A Claude agent for each integration wave (integration lane) | Writes and runs end-to-end tests and reports regressions to the owning lane                                      |
| Humans       | The owner and the full developer                            | Approve contracts, migrations, sign-in and scope code, WhatsApp templates and every release; test on real phones |

## Lanes and briefs

### Original lanes

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

### Follow-up lanes (2026-10)

These lanes have a status file and no brief. They are not in `ownership.md` yet, so the status file says what each one owns. Ask the orchestrator before you write a brief. The "On origin" column was checked on 2026-10-26: "local only" means the branch has not been pushed.

| Lane              | Branches                                            | On origin                                                                   | Status file                                                   | Covers                                                                                                 |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| repo              | `lane/repo/*`                                       | `lane/repo/tidy` only; `polish`, `integrate` and `merge-all` are local only | `status/repo.md`                                              | Root files, `scripts/`, `.gitattributes`, issue templates, branch clean-up, agent entry docs           |
| docs              | `lane/docs/public-docs`                             | yes                                                                         | `status/docs.md`                                              | `docs/public/`: source and generator of the public documentation site                                  |
| web               | `lane/web/store-pages`                              | yes                                                                         | `status/web.md`                                               | Public store pages in the user app (`src/app/`, `src/screens/public/`), `docs/release/play-console.md` |
| data              | `lane/data/tanzeem-seed`                            | yes                                                                         | `status/data.md`                                              | `tools/circles-load`, the circles data load                                                            |
| auth              | `lane/auth/email-otp`                               | yes                                                                         | `status/auth-scopes.md`                                       | Sign-in code by email                                                                                  |
| messaging (email) | `lane/messaging/email-templates-bundle`             | local only; origin has `lane/messaging/email-templates`                     | `status/messaging.md`                                         | Branded email templates in `packages/messaging/src/email/`                                             |
| ui follow-ups     | `lane/ui/design-fidelity`, `lane/ui/member-journey` | yes, both                                                                   | `status/ui-design-fidelity.md`, `status/ui-member-journey.md` | Screens brought to the 25 October 2026 design boards, and the member journey screens                   |
| unassigned        | `lane/release/play-readiness`                       | local only                                                                  | none                                                          | No owner, status file or documented scope. Ask the orchestrator before you use the branch              |

`status/db.md` and `status/i18n.md` record work on the shared packages `packages/db` and `packages/i18n`, owned by the contracts and ui lanes.

Some older status files (`auth-scopes.md`, `messaging.md` and others) name the branch `claude/peaceful-archimedes-ain95k` in their header, from before lane branches existed. For the lane branch, use this table.

A path that no lane owns (for example `docs/quality/`, `showcase/`): ask the orchestrator.

## Rules every agent follows

- **One owner per directory.** A change outside your lane's directories is a contract change request.
- **Contracts live in shared packages.** They change only through their own change, which every affected lane then rebases onto.
- **Every brief has the same parts:** goal, directories owned, contracts to follow, deliverables, definition of done, and the exact commands that must pass.
- **Small changes that pass `pnpm check` locally.** CI is manual only, so the check runs on your machine. A reviewer looks only at a change that passes it.
- **Two levels of approval.** Sensitive areas need a human approval. Everything else needs a reviewer-agent approval and a human spot check.
- **No production secrets for agents.** Only the orchestrator or the owner deploys.
- **No two agents edit the same file.** A conflict means the lane boundary is wrong. Stop and tell the orchestrator.
- **Only the orchestrator or the owner merges to `main`.** A push there can go live ([`AGENTS.md`](../../AGENTS.md), "Release line").

## Starting an agent

See [`worktrees.md`](worktrees.md). In short: create a sibling worktree on a lane branch, open a session there, and give it this prompt:

> Read `AGENTS.md`, `docs/agents/README.md`, `docs/agents/briefs/<lane>.md` if it exists, and `docs/agents/status/<lane>.md`. Do the next unfinished item: the status file's "Next step" if it has one, otherwise its "In progress" section, or the next deliverable in the brief. If none of these tells you, ask the orchestrator. Stay inside the directories you own. Run `pnpm check` before you finish and update `docs/agents/status/<lane>.md`.

`pnpm check` needs Node 22 and pnpm 10 through Corepack (`corepack enable`), and the poster renderer tests need Chromium. `pnpm e2e` needs Postgres and Playwright's browser. The commands are in `AGENTS.md`.

## Handoffs

- **Status files:** each agent updates `status/<lane>.md` at the end of every session ([`status/README.md`](status/README.md)).
- **Contract change requests:** [`docs/engineering/contracts-process.md`](../engineering/contracts-process.md).
- **Outside dependencies:** if you are blocked by something outside the repository, use the stand-in your brief lists and say so in your status file.
- **Review:** the owner decides whether a change goes through a pull request ([`CONTRIBUTING.md`](../../CONTRIBUTING.md)); agents open one only when asked. Where `CLAUDE.md` says "pull request", read "small change on your lane branch" ([`AGENTS.md`](../../AGENTS.md), "Release line"). When a pull request is opened, use `.github/pull_request_template.md`; a reviewer agent reviews it with `briefs/reviewer.md`.
