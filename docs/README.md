# Documentation index

All the written material for Quran Circles V2, grouped by what you are trying to do. Pick the track that fits you; each page and folder is listed once.

| If you want to...                                  | Go to                                               |
| -------------------------------------------------- | --------------------------------------------------- |
| Learn to use the app, or connect to the public API | [Use the app](#1-use-the-app)                       |
| Set the project up, change code, follow the rules  | [Build and run it](#2-build-and-run-it)             |
| Deploy, back up, watch, publish to the stores      | [Operate and release it](#3-operate-and-release-it) |
| Work in this repository as a Claude agent          | [Work as an AI agent](#4-work-as-an-ai-agent)       |

## 1. Use the app

For members, coordinators, admins and partner developers. The source is `docs/public/`: Markdown pages that `node docs/public/build.mjs` turns into a static site, in English and Urdu. Urdu pages are drafts until a native speaker reviews them.

| Page                                                                  | What it covers                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [public/README.md](public/README.md)                                  | How the site is built, its layout, and the rules every public page follows       |
| [Start page](public/content/en/index.md)                              | The site's start page                                                            |
| [Member guide](public/content/en/member-guide.md)                     | Find a session near you, join it, get reminders, read the Quran                  |
| [Coordinator guide](public/content/en/coordinator-guide.md)           | Run today's session from your phone: attendance, updates, time changes, posters  |
| [Console guide](public/content/en/console-guide.md)                   | The web console for admins: sessions, venues, coordinators, exports, bulk import |
| [API overview](public/content/en/api-overview.md)                     | Base URL, versions, formats and a first call                                     |
| [Sign-in and tokens](public/content/en/api-auth.md)                   | Sign-in codes, access and refresh tokens, signing out                            |
| [Errors, limits and pagination](public/content/en/api-conventions.md) | The error format and codes, rate limits, retries, cursor pagination              |
| [API reference](public/content/en/api-reference.md)                   | Every public endpoint, generated from the contract                               |
| [Roles and permissions](public/content/en/api-roles.md)               | Who can do what, in plain language                                               |
| [The staff API](public/content/en/api-staff.md)                       | Why the admin and coordinator endpoints are not published, and how partners ask  |
| [Webhooks](public/content/en/api-webhooks.md)                         | The WhatsApp webhook from Meta, and the fact that there are no outbound webhooks |
| [ERPNext integration](public/content/en/erpnext.md)                   | How Quran Circles and an ERPNext site can exchange data, and the open questions  |
| [Architecture overview](public/content/en/architecture.md)            | The public-safe version of how the parts fit together                            |
| [Deployment overview](public/content/en/deployment.md)                | The public-safe version of how it is built, released, backed up and watched      |
| [Accessibility and languages](public/content/en/accessibility.md)     | The accessibility and right-to-left rules the apps follow                        |
| [Urdu pages](public/content/ur/)                                      | Urdu versions of the start page and the member, coordinator and console guides   |
| [Guide screenshots](public/assets/screens/)                           | The images used in the guides                                                    |
| [Shared images](assets/)                                              | The logo, a banner and app screenshots in English and Urdu                       |
| [Security policy](../SECURITY.md)                                     | How to report a vulnerability                                                    |

## 2. Build and run it

For developers. Read the first table in order if you are new.

| Page                                            | What it covers                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| [Project README](../README.md)                  | What Quran Circles is, the architecture diagram, quick start                 |
| [Getting started](getting-started.md)           | Set up, run each app and service locally, run the tests                      |
| [Repository map](engineering/repo-map.md)       | Every top-level folder, app and package: purpose, owner lane, how to test it |
| [Architecture](architecture.md)                 | How the parts fit together, with links to the decisions behind them          |
| [Contributing](../CONTRIBUTING.md)              | Lanes, branches, releases, CI, worktrees and the rules every change follows  |
| [Credits and licences](credits-and-licences.md) | Fonts, Quran text and translations, and their terms                          |

### Product: what is being built

The agent-facing copy of the product plan. Read-only for lanes; changes come from the owner.

| Page                                         | What it covers                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [decisions.md](product/decisions.md)         | Settled product decisions: places, sessions, roles, registration |
| [features.md](product/features.md)           | The features that make the product distinct                      |
| [features-next.md](product/features-next.md) | Features decided with the owner but not yet scheduled            |
| [experience.md](product/experience.md)       | Navigation, look and accessibility                               |
| [data-model.md](product/data-model.md)       | The data model brief behind `packages/db`                        |
| [messaging.md](product/messaging.md)         | Notifications, reminders and when WhatsApp is used               |

### Engineering: how it is built

| Page                                                         | What it covers                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| [conventions.md](engineering/conventions.md)                 | Language, tooling, naming, testing and logging conventions |
| [ownership.md](engineering/ownership.md)                     | Which lane owns which directory                            |
| [gates.md](engineering/gates.md)                             | The quality gate between each wave                         |
| [branches-and-review.md](engineering/branches-and-review.md) | Branches, pull requests, approvals and commit messages     |
| [contracts-process.md](engineering/contracts-process.md)     | How shared contracts change, and the change request format |
| [i18n-keys.md](engineering/i18n-keys.md)                     | How translation keys are named and where they go           |
| [decisions/](engineering/decisions/README.md)                | Numbered architecture decision records                     |
| [change-requests/](engineering/change-requests/)             | Contract change requests from the lanes, open and decided  |

### Design

Written and kept by the UI lane (WP21). Start with [design/README.md](design/README.md).

| Page                                                  | What it covers                                    |
| ----------------------------------------------------- | ------------------------------------------------- |
| [principles.md](design/principles.md)                 | Design principles                                 |
| [rtl-urdu-guide.md](design/rtl-urdu-guide.md)         | Right-to-left layout and Urdu typography rules    |
| [accessibility.md](design/accessibility.md)           | Accessibility rules every screen follows          |
| [microcopy.md](design/microcopy.md)                   | Voice and wording, in English and Urdu            |
| [catalog.md](design/catalog.md)                       | The component catalog                             |
| [redesign-decisions.md](design/redesign-decisions.md) | The redesign, D1 to D17 (D17 is the current look) |
| [redesign-handoff.md](design/redesign-handoff.md)     | What each app lane changed to match the redesign  |
| [poster-direction.md](design/poster-direction.md)     | Visual direction for posters                      |
| [screens/](design/screens/)                           | One spec per screen                               |
| [archive/](design/archive/README.md)                  | Earlier design briefs kept for the record         |

### Code READMEs outside `docs/`

| Page                                                                    | What it covers                                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`packages/contracts/SCOPES.md`](../packages/contracts/SCOPES.md)       | The role-and-scope matrix                                                    |
| [`packages/contracts/CHANGELOG.md`](../packages/contracts/CHANGELOG.md) | Contract versions                                                            |
| [`packages/contracts/openapi.json`](../packages/contracts/openapi.json) | The generated OpenAPI document that feeds the public API reference           |
| [`packages/db/README.md`](../packages/db/README.md)                     | Migrations, seed and the first admin                                         |
| [`packages/messaging/README.md`](../packages/messaging/README.md)       | Providers, fakes and the email templates (`email:previews`, `email:publish`) |
| [`tools/migration/README.md`](../tools/migration/README.md)             | Moving V1 data                                                               |
| [`tools/circles-load/README.md`](../tools/circles-load/README.md)       | Cleaning a circles CSV into import rows                                      |
| [`tests/e2e/README.md`](../tests/e2e/README.md)                         | The end-to-end suite and its options                                         |
| [`tests/e2e/FINDINGS.md`](../tests/e2e/FINDINGS.md)                     | What the end-to-end suite found                                              |
| [`showcase/README.md`](../showcase/README.md)                           | Building the UI kit showcase page                                            |

## 3. Operate and release it

For whoever runs the servers and ships the apps.

| Page                                                               | What it covers                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Handover folder](handover/README.md)                              | History by thread, decisions and incidents, email setup, screenshots and email previews                                            |
| [Project state](project-state.md)                                  | Where the project stands now (2026-10-28): what is live, open decisions and issues, branches and worktrees, how to start a session |
| [Shared-folder archive](archive/shared-folder/README.md)           | Everything that used to live in the project's shared folder, checked against `main`, and where each item went                      |
| [Handoff](handoff.md)                                              | Written when the project was parked on 2026-10-18: what runs where, open items. Read the go-live plan for what came after          |
| [Deployment](deployment.md)                                        | Staging, production (live), the Dokploy setup for `main`, backups and monitoring                                                   |
| [`infra/README.md`](../infra/README.md)                            | The server runbook                                                                                                                 |
| [`infra/ENV.md`](../infra/ENV.md)                                  | Every environment variable, who reads it, whether it is required                                                                   |
| [release/go-live.md](release/go-live.md)                           | The plan for production on Dokploy and the Android app on Google Play                                                              |
| [release/play-console.md](release/play-console.md)                 | Google Play Console entries: URLs, data safety answers, descriptions, open decisions                                               |
| [release/store-listing.md](release/store-listing.md)               | App Store and Google Play listing text (draft)                                                                                     |
| [`tools/store-assets`](../tools/store-assets/README.md)            | How the app icons and store screenshots are generated                                                                              |
| [engineering/github-settings.md](engineering/github-settings.md)   | Branch protection and other settings to apply on github.com                                                                        |
| [engineering/branch-inventory.md](engineering/branch-inventory.md) | Which branches are merged, active or need a decision                                                                               |
| [security/review.md](security/review.md)                           | The Wave 5 security review and its findings                                                                                        |
| [quality/accessibility-rtl.md](quality/accessibility-rtl.md)       | Accessibility and right-to-left pass, with screenshots                                                                             |
| [quality/low-end-budgets.md](quality/low-end-budgets.md)           | Performance budgets on low-end Android phones                                                                                      |
| [quality/low-end-phone-check.md](quality/low-end-phone-check.md)   | The hands-on check on a real Android phone                                                                                         |
| [quality/restore-drill.md](quality/restore-drill.md)               | Backup restore rehearsal and timings                                                                                               |
| [quality/screens/](quality/screens/)                               | Screenshots from the accessibility and right-to-left pass                                                                          |
| [`tests/load/README.md`](../tests/load/README.md)                  | Scope verification and the Ramadan-evening load test                                                                               |

## 4. Work as an AI agent

For Claude agents and the people who run them. Start with the repository's `AGENTS.md` and `CLAUDE.md`, then the pages below.

| Page                                                 | What it covers                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)                          | Entry point for any agent or developer: reading order, commands, the release line and Windows worktree hazards |
| [`CLAUDE.md`](../CLAUDE.md)                          | The rules every agent follows; most apps and packages have their own short one too                             |
| [agents/README.md](agents/README.md)                 | Roles, lanes, the rules every agent follows, handoffs                                                          |
| [agents/briefs/](agents/briefs/)                     | One brief per lane: goal, directories, deliverables, done                                                      |
| [agents/brief-template.md](agents/brief-template.md) | The template every brief follows                                                                               |
| [agents/status/](agents/status/README.md)            | One status file per lane, plus gate sign-offs                                                                  |
| [agents/worktrees.md](agents/worktrees.md)           | Running agents in parallel with git worktrees                                                                  |

Before you write code, also read the product decisions (`product/decisions.md`), your lane's row in `engineering/ownership.md` and the rules in `CONTRIBUTING.md`. When you finish a session, update your lane's status file and stop.

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
