# Project state and open issues

Snapshot of 2026-10-28, written during the repository handover. Read this after [`AGENTS.md`](../AGENTS.md) when you need to know where the project stands today. [`handoff.md`](handoff.md) is the older 2026-10-18 snapshot; where the two differ, this page is newer. Re-check anything marked "to confirm" before you rely on it.

## In one paragraph

Quran Circles V2 (for Tanzeem-e-Islami) is built and live. Waves 0 to 5 are done, production runs on Dokploy at `https://qurancircles.doraquran.pk` (console at `https://qurancircles-admin.doraquran.pk`), and `main` auto-deploys, so every push to `main` is a release. Sign-in is by an emailed 6-digit code (Resend). Seat booking was replaced by a join pledge. Production was seeded with the Tanzeem circles on 2026-10-26: 42 cities, 167 venues and 139 published sessions. The Google Play release is prepared but not published. Native Urdu review of the draft strings is still outstanding.

## Where things are

| What                    | Where                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                  | GitHub `usmankhan4001/quran-circles` (public). The only branch on origin is `main`                                                                                            |
| Production              | Dokploy, compose from `infra/`, pulls `main`, auto-deploy on. Settings in [`deployment.md`](deployment.md) and [`release/go-live.md`](release/go-live.md)                     |
| Staging                 | Synthetic data and fake messaging ([`deployment.md`](deployment.md))                                                                                                          |
| Environment variables   | Every name, owner and whether it is required: [`../infra/ENV.md`](../infra/ENV.md). Examples with fake values: `.env.example`, `infra/.env.example`. Never commit real values |
| Local run               | [`getting-started.md`](getting-started.md)                                                                                                                                    |
| Lanes and who owns what | [`agents/README.md`](agents/README.md), [`engineering/ownership.md`](engineering/ownership.md), one status file per lane in [`agents/status/`](agents/status/)                |
| Product decisions       | [`product/decisions.md`](product/decisions.md). Do not re-decide them                                                                                                         |
| Older working material  | [`archive/shared-folder/`](archive/shared-folder/README.md): everything that lived in the project's shared folder before this handover, with where each item went             |

## Architecture in five lines

- pnpm monorepo (Node 22, pnpm 10.28, Postgres 17). Apps: `api`, `worker`, `poster-renderer`, Expo `user-app` and `admin-app`, React `console`. Packages: `contracts` (Zod, OpenAPI, scopes), `db` (migrations, seed), `ui`, `i18n`, `content` (Quran, prayer times), `messaging`.
- Apps talk to the API only; only the API and worker touch Postgres. No Supabase, Neon or OneSignal.
- English and Urdu (right to left) everywhere; Urdu strings are drafts until a native reader signs them off.
- Full diagram and rules: [`architecture.md`](architecture.md), [`engineering/repo-map.md`](engineering/repo-map.md).

## Run, test, deploy

| Task                 | Command or place                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install              | `corepack enable`, then `pnpm install`                                                                                                                                    |
| The only gate        | `pnpm check` (typecheck, lint, tests, format check). CI is manual and never deploys. Run `pnpm env:check` too when you touch an env example file                          |
| One package          | `pnpm --filter @qc/api test`                                                                                                                                              |
| End-to-end           | `pnpm e2e` (needs Postgres and Playwright's Chromium, see `AGENTS.md`)                                                                                                    |
| Deploy               | Push to `main`. Dokploy builds and deploys. Only the owner or orchestrator pushes to `main`                                                                               |
| Load the circles     | [`../tools/circles-load/README.md`](../tools/circles-load/README.md); the 2026-10 runbooks are kept in [`archive/shared-folder/seeding/`](archive/shared-folder/seeding/) |
| Poster renderer test | Needs Chromium: `pnpm --filter @qc/poster-renderer exec playwright-core install --only-shell chromium`                                                                    |

## What changed on 2026-10-28 (handover)

- The branded email template became the default for the sign-in code email, and the API now gives messaging its logger so Resend results (`code.sent`, `code.email_failed`) appear in the logs. Both were only in loose patches before.
- The three `lane/data/tanzeem-seed` commits that were not in `main` (export command notes, sign-in code from a file, API error codes in `circles-load`) were applied.
- Every bundle and patch in the shared folder was checked against `main`; all other code in them was already merged. See the table in [`archive/shared-folder/README.md`](archive/shared-folder/README.md).

## Open issues and decisions

Owner decisions first, then work that is ready to be picked up, then things only a person can do. Status of lane work is in the lane's status file.

### Owner decisions

| #   | Item                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Placeholder features that look real (seat pass leftovers, livestream, "Join online", reciter audio, photos, request a circle): hide or label "Coming soon" (gap U9, `archive/shared-folder/planning/gap-list-2026-10-25.md`) |
| D2  | Quran Arabic edition credit: confirm it is the Tanzil text and whether the credit must name CC BY 3.0. Urdu translation rights (Maududi) are still open ([`credits-and-licences.md`](credits-and-licences.md))               |
| D3  | English translation of the ayah of the day: choose one whose licence allows app use                                                                                                                                          |
| D4  | Venue photos: needs a contract change, a migration, upload storage and each masjid's permission                                                                                                                              |
| D5  | Geocoding service for the circles load (the 75 approximate venue pins were imported as test data on the owner's call)                                                                                                        |
| D6  | Mushaf reader font: a switch to Amiri Quran has been proposed. Not decided. Another thread owns `packages/content/src/ui/MushafView.tsx`; do not edit it from here                                                           |

### Ready to pick up

| #   | Item                                                                                                                                                                                                                          | Lane                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| W1  | Attendance is lost if the coordinator's phone is offline (needs an offline queue)                                                                                                                                             | admin-app             |
| W2  | The Quran text needs the internet and `api.alquran.cloud`; an offline copy needs confirmed rights                                                                                                                             | content               |
| W3  | Web app keeps the refresh token where page scripts can read it (SEC-10); move to an http-only cookie, API and web together                                                                                                    | auth-scopes, user-app |
| W4  | Rate limits live in memory per process; needed before a second API container                                                                                                                                                  | auth-scopes           |
| W5  | Reviewer access for Google Play (allow-list or reviewer mailbox, `release/play-console.md` decision 5)                                                                                                                        | auth-scopes           |
| W6  | `tools/store-assets/capture` still drives the old seat-booking flow; rewrite it for the join pledge                                                                                                                           | release               |
| W7  | Console numbers that need new API endpoints (registrations this month, attendance percentage, exact totals, attendance export) `archive/.../showcase-gaps-needing-data.md`                                                    | api-core, console     |
| W9  | The store listing text ([`release/store-listing.md`](release/store-listing.md)) still says "reserve your seat" and "reserve a seat", but seat booking was replaced by the join pledge. Reword it before the first Play upload | release               |
| W8  | Mark the gap list items from 2026-10-25 against `main` (most "fix now" items went in with `fix/gaps-2026-10-25`); re-verify before reporting any as open                                                                      | any                   |

### Needs a person

| #   | Item                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Rotate the Resend API key that was pasted in chat, and the Dokploy API key from the earlier gap list (T1). To confirm whether either is done                                      |
| P2  | Confirm production has `RESEND_API_KEY` set, `AUTH_PHONE_SIGN_IN` unset and `QC_DOMAIN`, `QC_CONSOLE_DOMAIN`, `PUBLIC_WEB_BASE` on the `qurancircles` host (with an s)            |
| P3  | Cloudflare tunnel hostnames, Google Maps key referrers, Play Console URLs and Firebase authorised domains on the new host                                                         |
| P4  | Inbound mail for `support@` and `privacy@qurancircles.doraquran.pk` (both appear on the store listing and privacy page)                                                           |
| P5  | A native Urdu reader goes through the proofreading sheet (`archive/shared-folder/urdu-proofreading/`; regenerate it from `packages/i18n` before use, it is a 2026-10-25 snapshot) |
| P6  | Meta WhatsApp Business verification and template approval (WhatsApp is optional for sign-in now; it is still the channel for confirmations)                                       |
| P7  | Google Play and Apple developer accounts, first Play upload                                                                                                                       |

## Branches, worktrees and stashes

Reconciled on 2026-10-28; details in [`engineering/branch-inventory.md`](engineering/branch-inventory.md).

- origin has one branch, `main`. Every lane branch that used to be there is gone (merged and deleted on GitHub earlier).
- Local: `main`, plus `lane/auth/admin-bootstrap` (fully merged into `main`) and `lane/data/tanzeem-seed` (its last three commits are now in `main`). Both sit in locked sibling worktrees (`qc-admin-bootstrap`, `qc-tanzeem-local`). They are safe to remove with `git worktree remove` once the owner no longer needs them: `qc-tanzeem-local` also holds the owner's local `.env` and the local seed database setup used by the seeding runbooks, which is why neither was removed.
- No stashes exist.

## How to start a session

1. `AGENTS.md`, then the `CLAUDE.md` of the directory you will edit.
2. Your lane's brief and status file. No brief: work from the status file and ask the orchestrator.
3. This page for the current state, `product/decisions.md` only if a decision is in question.
4. Small commits on `lane/<lane>/<topic>`; `pnpm check` before you ask for a merge; update `docs/agents/status/<lane>.md` last.
