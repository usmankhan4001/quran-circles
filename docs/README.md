# Documentation index

Everything written about Quran Circles V2, grouped by what you are trying to do. If you are new, read the first section in order.

## Start here

| Page                                            | What it covers                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| [Project README](../README.md)                  | What Quran Circles is, the layout of the repository, quick start    |
| [Getting started](getting-started.md)           | Set up, run each app and service locally, run the tests             |
| [Architecture](architecture.md)                 | How the parts fit together, with links to the decisions behind them |
| [Deployment](deployment.md)                     | Staging, production, backups and monitoring                         |
| [Contributing](../CONTRIBUTING.md)              | Lanes, ownership, the rules every change follows                    |
| [Credits and licences](credits-and-licences.md) | Fonts, Quran text and translations, and their terms                 |

## Product: what is being built

The agent-facing copy of the product plan. Read-only for lanes; changes come from the owner.

| Page                                         | What it covers                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [decisions.md](product/decisions.md)         | Settled product decisions: places, sessions, roles, registration |
| [features.md](product/features.md)           | The features that make the product distinct                      |
| [features-next.md](product/features-next.md) | Features decided with the owner but not yet scheduled            |
| [experience.md](product/experience.md)       | Navigation, look and accessibility                               |
| [data-model.md](product/data-model.md)       | The data model brief behind `packages/db`                        |
| [messaging.md](product/messaging.md)         | Notifications, reminders and when WhatsApp is used               |

## Engineering: how it is built

| Page                                                         | What it covers                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| [conventions.md](engineering/conventions.md)                 | Language, tooling, naming, testing and logging conventions |
| [ownership.md](engineering/ownership.md)                     | Which lane owns which directory                            |
| [gates.md](engineering/gates.md)                             | The quality gate between each wave                         |
| [branches-and-review.md](engineering/branches-and-review.md) | Branches, pull requests, approvals and commit messages     |
| [contracts-process.md](engineering/contracts-process.md)     | How shared contracts change, and the change request format |
| [i18n-keys.md](engineering/i18n-keys.md)                     | How translation keys are named and where they go           |
| [decisions/](engineering/decisions/README.md)                | Numbered architecture decision records (0001 to 0012)      |
| [change-requests/](engineering/change-requests/)             | Contract change requests from the lanes, open and decided  |

## Design

Written and kept by the UI lane (WP21). Start with [design/README.md](design/README.md).

| Page                                                  | What it covers                                 |
| ----------------------------------------------------- | ---------------------------------------------- |
| [principles.md](design/principles.md)                 | Design principles                              |
| [rtl-urdu-guide.md](design/rtl-urdu-guide.md)         | Right-to-left layout and Urdu typography rules |
| [accessibility.md](design/accessibility.md)           | Accessibility rules every screen follows       |
| [microcopy.md](design/microcopy.md)                   | Voice and wording, in English and Urdu         |
| [catalog.md](design/catalog.md)                       | The component catalog                          |
| [redesign-decisions.md](design/redesign-decisions.md) | Decisions of the current UI redesign           |
| [screens/](design/screens/)                           | One spec per screen                            |
| [poster-direction.md](design/poster-direction.md)     | Visual direction for posters                   |

## Quality and security

| Page                                                         | What it covers                                         |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| [security/review.md](security/review.md)                     | The Wave 5 security review and its findings            |
| [quality/accessibility-rtl.md](quality/accessibility-rtl.md) | Accessibility and right-to-left pass, with screenshots |
| [quality/low-end-budgets.md](quality/low-end-budgets.md)     | Performance budgets on low-end Android phones          |
| [quality/restore-drill.md](quality/restore-drill.md)         | Backup restore rehearsal and timings                   |

## Agents: how the work is run

| Page                                                 | What it covers                                            |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [agents/README.md](agents/README.md)                 | Roles, lanes, the rules every agent follows, handoffs     |
| [agents/briefs/](agents/briefs/)                     | One brief per lane: goal, directories, deliverables, done |
| [agents/status/](agents/status/README.md)            | One status file per lane, plus gate sign-offs             |
| [agents/worktrees.md](agents/worktrees.md)           | Running agents in parallel with git worktrees             |
| [agents/brief-template.md](agents/brief-template.md) | The template every brief follows                          |

## Elsewhere in the repository

- [`infra/README.md`](../infra/README.md): the server runbook. [`infra/ENV.md`](../infra/ENV.md): every environment variable.
- [`packages/contracts/SCOPES.md`](../packages/contracts/SCOPES.md): the role-and-scope matrix. [`CHANGELOG.md`](../packages/contracts/CHANGELOG.md): contract versions.
- [`packages/db/README.md`](../packages/db/README.md): migrations, seed and the first admin.
- [`tools/migration/README.md`](../tools/migration/README.md): moving V1 data.
- [`tests/e2e/FINDINGS.md`](../tests/e2e/FINDINGS.md): what the end-to-end suite found.

## Where the plans live

The planning documents are shared docs, not files in this repository:

- **Quran Circles V2 Plan**: what is being built and why. `product/` is the agent-facing copy of its decisions.
- **Quran Circles V2 Development Plan**: waves, work packages, gates and the agent operating model. `agents/` and `engineering/gates.md` mirror it.

If this repository and a plan disagree, stop and ask the orchestrator. Do not pick one.

## Terms

- **V1**: the current Nearby Dora Quran web app, in its own repository. **V2**: this platform.
- **Dora**: the Ramadan and seasonal programme. **Circles**: year-round study groups.
- **Venue**: a place that hosts sessions. **Session**: a recurring schedule or a one-off lecture at a venue. **Occurrence**: one dated instance of a session.
- **Wave**: a stage of the build, 0 to 7. A gate sits between waves.
- **Lane**: the set of directories and work packages one agent owns.
- **Work package (WP)**: a numbered unit of work in the development plan.
- **Contract**: the database schema, API contract, scope matrix, message formats, design tokens and translation keys that several lanes depend on.
- **Orchestrator**: the human, with a main Claude session, who owns the plan, the contracts and the gates.
