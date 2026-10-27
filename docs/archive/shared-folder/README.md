# Shared project folder: what was there and where it went

Before 2026-10-28 the project kept its working material in a shared folder (`/mnt/project-files`, about 540 files, 200 MB) outside git. This page lists every group of files, whether it was checked against `main`, and where it lives now. Imported text is kept as written, apart from the owner's email address and PC paths, which were replaced with placeholders (`<ADMIN_EMAIL>`, `<DOWNLOADS>`). Hostnames and commands in these notes describe 2026-10-25 and 2026-10-26; the live host is `qurancircles.doraquran.pk`, so check against [`../../project-state.md`](../../project-state.md) before running anything.

## Code bundles and patches: all checked against `main`

Each bundle was fetched into a scratch ref and compared with `git merge-base --is-ancestor` and `git cherry`. "In main" means every commit is an ancestor of `main` or has an equivalent commit there (a rebase changes the hash, not the change).

| Folder and file                                                | Branch inside                     | Result                                                                                       |
| -------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `email-otp/email-otp.bundle`, `email-otp-v2.bundle`            | `lane/auth/email-otp`             | In main (sign-in code by email, Resend)                                                      |
| `email-otp/email-otp-fix.bundle`, `email-otp-fix.patch`        | `lane/auth/email-otp-fix`         | **Was missing, now applied**: the API gives messaging its logger                             |
| `email-otp/email-branded-default.patch`                        | commit `e5d81dc`                  | **Was missing, now applied**: the sign-in code email uses the branded template by default    |
| `email-templates-2026-10-25/*.bundle`, `0001-...patch`         | `lane/messaging/email-templates`  | In main                                                                                      |
| `gaps-2026-10-25/gap-fixes.bundle`                             | `fix/gaps-2026-10-25`             | In main                                                                                      |
| `go-live-2026-10-25/go-live.bundle`, `0001-...patch`           | `lane/platform/go-live`           | In main                                                                                      |
| `go-live-2026-10-25/console-map-tiles.bundle`                  | `lane/platform/console-map-tiles` | In main (the console CSP already lists the OpenStreetMap tile hosts in all three Caddyfiles) |
| `go-live-2026-10-25/main-integrated*.bundle`                   | `release-main`                    | In main                                                                                      |
| `join-pledge-2026-10-25/*`                                     | `lane/user-app/join-pledge`       | In main                                                                                      |
| `map-screen-2026-10-25/map-screen.bundle`                      | detached head                     | In main (`TileMapView` and the tile helpers are in `apps/user-app/src/features/maps/`)       |
| `poster-flyer-2026-10-25/poster-flyer.bundle`                  | `lane/console/poster-flyer`       | In main                                                                                      |
| `session-screens-2026-10-25/*.bundle`                          | `lane/ui/session-screens`         | In main                                                                                      |
| `status-check-2026-10-25/fixes.bundle`, `patches/0001`..`0006` | detached head `cbea1f4`           | In main                                                                                      |
| `console-poster-maker-2026-10-25/console-poster-maker.bundle`  | `feat/console-poster-maker`       | In main                                                                                      |

The bundles themselves are not committed: they only duplicate history that `main` already holds. They stay in the shared folder.

## Imported into the repository

| Shared folder                                                                           | Now at                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `production-steps.md`, `seed-locally.md`, `seed-with-csv.md`, `paste-step-1-backup.txt` | [`seeding/`](seeding/): copy-paste runbooks for loading the circles locally and in production (2026-10-26)                                                                                                             |
| `tanzeem-circles-2026-10-25/README.md`                                                  | [`data/tanzeem-circles-source-notes.md`](data/tanzeem-circles-source-notes.md): how the source sheet was cleaned and what it lacks                                                                                     |
| `gaps-2026-10-25/gap-list.md`                                                           | [`planning/gap-list-2026-10-25.md`](planning/gap-list-2026-10-25.md)                                                                                                                                                   |
| `v2-waves/change-request-digest.md`                                                     | [`planning/change-request-digest-wave-2.md`](planning/change-request-digest-wave-2.md)                                                                                                                                 |
| `v2-waves/showcase-gaps-needing-data.md`                                                | [`planning/showcase-gaps-needing-data.md`](planning/showcase-gaps-needing-data.md)                                                                                                                                     |
| `.notes/inputs.md`                                                                      | [`planning/project-inputs-notes.md`](planning/project-inputs-notes.md): the logo input note                                                                                                                            |
| `email-otp/deploy-notes.md`                                                             | [`release/email-otp-deploy-notes.md`](release/email-otp-deploy-notes.md)                                                                                                                                               |
| `v2-waves/font-and-translation-licences.md`                                             | [`release/font-and-translation-licences-research.md`](release/font-and-translation-licences-research.md): the research behind [`credits-and-licences.md`](../../credits-and-licences.md)                               |
| `v2-waves/low-end-phone-check.md`, `store-assets/README.md`                             | [`release/`](release/): older drafts; the maintained versions are [`quality/low-end-phone-check.md`](../../quality/low-end-phone-check.md) and [`tools/store-assets/README.md`](../../../tools/store-assets/README.md) |
| `design-fidelity/live-vs-design-comparison.md`                                          | [`design/live-vs-design-comparison.md`](design/live-vs-design-comparison.md)                                                                                                                                           |
| `urdu-proofreading/` (md and xlsx)                                                      | [`urdu-proofreading/`](urdu-proofreading/): the 2026-10-25 snapshot of all Urdu strings with a Fix column; regenerate before a review round                                                                            |
| `play/edit_i18n.py`                                                                     | [`scripts/edit_i18n.py`](scripts/edit_i18n.py): one-off script that rewrote the sign-in wording in the public pages                                                                                                    |
| `design/quran-circles-ui-prompts.md`                                                    | [`../../design/archive/quran-circles-ui-prompts.md`](../../design/archive/quran-circles-ui-prompts.md)                                                                                                                 |
| `ui-from-scratch-2026-10-25/quran-circles-foundation.html`                              | [`../../design/archive/quran-circles-foundation.html`](../../design/archive/quran-circles-foundation.html): the from-scratch UI foundation page (open it in a browser)                                                 |
| `play-assets/feature-graphic-1024x500-{en,ur}.png`                                      | [`../../release/play-assets/`](../../release/play-assets/): the Play feature graphics                                                                                                                                  |

## Already in the repository (newer copy kept)

| Shared folder                                                                              | Repository copy                                                                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `go-live-2026-10-25/go-live.md`                                                            | [`docs/release/go-live.md`](../../release/go-live.md) (the shared copy still has the old `circles.` host and auto-deploy off) |
| `store-assets/listing/store-listing.md`                                                    | [`docs/release/store-listing.md`](../../release/store-listing.md) (newer: says the sign-in code comes by email)               |
| `store-assets/generator/`, `icons/`, `icons-admin/`, `source/`, `play-assets/icon-512.png` | [`tools/store-assets/`](../../../tools/store-assets/README.md)                                                                |
| `fonts/Jameel_Noori_Nastaleeq_Regular.ttf`                                                 | `packages/ui/assets/fonts/` (the repository has the full font and the licence files)                                          |
| `email-templates-2026-10-25/previews/`                                                     | Regenerate with `pnpm --filter @qc/messaging email:previews`                                                                  |

## Deliberately not imported

| Shared folder                                                                                                                 | Why, and how to get it                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `tanzeem-circles-2026-10-25/quranic_circles_clean.{csv,json}`                                                                 | Real coordinator phone numbers. The repository rules forbid real personal data. Keep them outside git                                        |
| `store-assets/screenshots*/`, `store-assets/screenshots-input/`, `store-assets/contact-sheet.png`, `play-assets/screenshots/` | About 130 MB of generated screenshots. Regenerate with `tools/store-assets/capture` (see W6 in [`project-state.md`](../../project-state.md)) |
| `ui-redesign/`, `status-check-2026-10-25/screens/`, `status-check-2026-10-25/key/`                                            | Review screenshots from the redesign and the 25 October test pass. Findings are in the status files                                          |
| `console-poster-maker-2026-10-25/*.png`, `flyer-studio*.html`, `v2-waves/poster-samples/`                                     | Render outputs and a prototype page; the code is in `apps/console` and `apps/poster-renderer`                                                |
| `places.sql`                                                                                                                  | Generated. `tools/circles-load` `places` writes it (idempotent SQL for 5 provinces, 42 cities and areas)                                     |

If you need a file in the last two tables, ask the owner for the shared folder or regenerate it as described.
