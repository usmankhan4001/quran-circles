# Handover folder

Everything a new agent or developer needs beyond the code and the lane files. Start with [`../../HANDOVER.md`](../../HANDOVER.md).

| Page                                                       | What it holds                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`history-by-thread.md`](history-by-thread.md)             | What each working thread built, in order, 2026-10-16 to 2026-10-28                                                     |
| [`decisions-and-incidents.md`](decisions-and-incidents.md) | Owner decisions, and the problems hit (email, DNS wildcard versus MX, Mushaf font, branch scare) with causes and fixes |
| [`resend-email-setup.md`](resend-email-setup.md)           | Email sign-in setup variables and how to diagnose a missing email                                                      |
| [`email-previews/`](email-previews/index.html)             | Rendered previews of every email template, English and Urdu                                                            |
| [`screenshots/`](screenshots/README.md)                    | About 350 screenshots (145 MB): redesign, 25 Oct test pass, Play, store inputs, plus a curated top-level pick          |

## Assets

| What                                                   | Where                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play feature graphics                                  | [`../release/play-assets/`](../release/play-assets/)                                                                                                    |
| Logo master, app icons, store mockups, capture scripts | [`../../tools/store-assets/`](../../tools/store-assets/README.md)                                                                                       |
| Fonts and licences                                     | `packages/ui/assets/fonts/LICENSES.md`, [`../credits-and-licences.md`](../credits-and-licences.md)                                                      |
| UI design prompts, foundation page, comparison notes   | [`../design/archive/`](../design/archive/README.md), [`../archive/shared-folder/design/`](../archive/shared-folder/design/live-vs-design-comparison.md) |
| Urdu proofreading sheet (2026-10-25 snapshot)          | [`../archive/shared-folder/urdu-proofreading/`](../archive/shared-folder/urdu-proofreading/)                                                            |
| Seeding runbooks                                       | [`../archive/shared-folder/seeding/`](../archive/shared-folder/seeding/)                                                                                |
| Gap list, change-request digest, planning notes        | [`../archive/shared-folder/planning/`](../archive/shared-folder/planning/)                                                                              |
| Index of every file in the old shared folder           | [`../archive/shared-folder/README.md`](../archive/shared-folder/README.md)                                                                              |

## Still only in the old shared folder (not in git)

The original large patches, the flyer studio prototype page and the real circles CSV and JSON (phone numbers, kept in `qc-private-data` on the owner's PC) (all already in `main`), the flyer studio prototype page, two more poster samples, and the real circles CSV and JSON (phone numbers; keep them out of git). That folder belongs to the Claude project "Quran Circles" and can be downloaded from the project's Library. If it is ever lost, regenerate screenshots with `tools/store-assets/capture` and posters with the console poster maker.

## Discussion logs

The full threads live in the Claude project, not in git. This folder keeps their substance. To read an original thread, open the project and search for the thread title listed in [`history-by-thread.md`](history-by-thread.md).
