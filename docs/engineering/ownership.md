# Ownership map

One owner per directory. A lane edits only the directories listed for it. A change anywhere else is a contract change request (`contracts-process.md`).

| Lane           | Work packages                                 | Owns                                                                                                                                          | Human approval needed for                      |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| platform       | WP0, WP10                                     | `infra/`, `.github/`, root config files (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`) | All of it                                      |
| contracts      | WP1                                           | `packages/contracts/`, `packages/db/`, `docs/engineering/i18n-keys.md`                                                                        | All of it                                      |
| ui             | WP21                                          | `packages/ui/`, `docs/design/`, microcopy review of `packages/i18n/` values                                                                   | Design review of tokens and the kit            |
| api-core       | WP2, WP19 (API part)                          | `apps/api/src/modules/` except `auth`, `apps/api/src/middleware/`                                                                             | Sensitive modules named in the brief           |
| auth-scopes    | WP3                                           | `apps/api/src/auth/`, `apps/api/src/modules/auth/`                                                                                            | All of it                                      |
| messaging      | WP4, WP14                                     | `apps/worker/`, `packages/messaging/`                                                                                                         | All of it                                      |
| user-app       | WP5, WP17 (user part), WP19 (user part), WP20 | `apps/user-app/`                                                                                                                              | Store build configuration                      |
| admin-app      | WP6, WP17 (admin part)                        | `apps/admin-app/`                                                                                                                             | Store build configuration                      |
| console        | WP7, WP15, WP19 (console part)                | `apps/console/`                                                                                                                               | Bulk import and handover code                  |
| content        | WP8, WP18                                     | `packages/content/`                                                                                                                           | Anything that stores Quran text or translation |
| data-migration | WP9                                           | `tools/migration/`                                                                                                                            | All of it                                      |
| renderer       | WP16                                          | `apps/poster-renderer/` (created in Wave 4)                                                                                                   | Container and template changes                 |
| integration    | WP11                                          | `tests/e2e/`                                                                                                                                  | None                                           |
| quality        | WP12                                          | `tests/load/` (created in Wave 5), `docs/security/` (created in Wave 5)                                                                       | Security findings                              |
| release        | WP13                                          | `docs/release/` (created in Wave 6)                                                                                                           | Every release step                             |
| reviewer       | all                                           | Nothing. Reviewers never edit code                                                                                                            | n/a                                            |

## Shared packages

`contracts`, `db`, `ui`, `i18n`, `messaging` are read by many lanes. Nobody edits one as a side effect. The owning lane changes it in its own pull request, and every affected lane rebases onto it.

`packages/i18n` is the one exception: any lane adds its own keys and values, English and Urdu together, in the same pull request as the screen that uses them. The contracts lane writes the key structure rules (`i18n-keys.md`), and the ui lane reviews the wording of English text and Urdu drafts.

## Sensitive areas

Sign-in, scope checks, migrations, WhatsApp, account deletion, infrastructure and anything that stores personal data need a human approval. `.github/CODEOWNERS` enforces this when branch protection requires code owner review.
