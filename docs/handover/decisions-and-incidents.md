# Decisions and incidents log

Decisions the owner made, and problems that were hit and how they were solved, as seen in the project threads. Settled product decisions live in [`docs/product/decisions.md`](../product/decisions.md); do not re-decide them. All dates are 2026.

## Owner decisions

| Date  | Decision                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10-16 | Push to a branch only. No pull requests and no waiting for GitHub Actions unless asked. Run several agents in parallel                                                                        |
| 10-18 | Licence: proprietary to Tanzeem-e-Islami, not open source (`LICENSE`)                                                                                                                         |
| 10-25 | No seat booking. Joining a session is a pledge to come, then a confirmation, reminders and notices of changes                                                                                 |
| 10-25 | Venue coordinates stay required (every venue needs a real pin) and are never guessed. 75 approximate pins were imported as test data on the owner's call                                      |
| 10-25 | Domain `qurancircles.doraquran.pk` (with an s) and console `qurancircles-admin.doraquran.pk`; app id `pk.doraquran.circles` recommended                                                       |
| 10-25 | Sign-in is by an emailed code (Resend). WhatsApp sign-in is off; WhatsApp stays for confirmations and optional reminders                                                                      |
| 10-26 | Dokploy auto-deploy is on: every push to `main` deploys production. Lane agents never push to `main` or deploy                                                                                |
| 10-26 | First admin comes from the environment, with its sign-in codes delivered to another mailbox (`lane/auth/admin-bootstrap`)                                                                     |
| 10-26 | The circles load went into production through the console CSV import; the owner pasted the commands in the Dokploy terminal because the agent's PC permission layer refuses production writes |
| 10-27 | Mushaf: stopgap font fix now. A switch to Amiri Quran was proposed and is **not decided**                                                                                                     |

## Incidents and how they were solved

### 1. Sign-in emails not arriving, then arriving as plain text (10-25 to 10-27)

- No email went out because production still had `APP_ENV=staging` with `MESSAGING_MODE=fake`, and live mode demanded WhatsApp credentials. Fix: live mode now runs with only `RESEND_API_KEY`; the worker asks for WhatsApp secrets only when `WHATSAPP_PHONE_NUMBER_ID` is set.
- The API never logged Resend's answer. Fix: pass the logger to messaging, so `code.sent` and `code.email_failed` (with `errorCode`) are logged.
- Emails then arrived as plain text because the sign-in sender still defaulted to the placeholder renderer. Fix: the branded template is now the default.
- The last two fixes sat in loose patches until the 2026-10-28 handover applied them to `main`.
- Setup and diagnosis steps: [`resend-email-setup.md`](resend-email-setup.md).

### 2. The site did not open: DNS wildcard versus MX (10-26 and 10-27)

- Symptom: `https://qurancircles.doraquran.pk` unreachable (Chrome `ERR_NAME_NOT_RESOLVED`) while the admin host worked and all five containers (api, web, worker, poster-renderer, postgres) were healthy.
- Cause: Cloudflare has a proxied wildcard CNAME `*` to the tunnel. A wildcard only answers names that have no records of their own. `qurancircles` has its own MX records (Resend) and `send` records, so the wildcard did not apply and the name resolved to "exists, no address". The admin host has no records of its own, so the wildcard served it.
- Fix: an explicit proxied CNAME `qurancircles` pointing at the same tunnel target as the wildcard. Leave the MX and `send` records alone. The agent could not make the change (the PC permission layer blocks DNS changes), so the owner added it.
- Afterwards the owner's PC still failed because the home router, the PC's only DNS server, had cached the "no address" answer (the zone's negative TTL is 30 minutes). Fix: set the PC's DNS to 1.1.1.1 and 8.8.8.8, or wait.
- Lessons: any subdomain that also carries mail records needs its own explicit web record. When something "does not work", test from a different network and resolver before touching the stack.

### 3. Mushaf page unreadable (10-27)

- First fix `65e2c79`: larger text, no justification, smaller ayah marks.
- Still wrong: the text and end marks were nested runs that fell back to the body style (16 px UI font, left-to-right, 68 px line height), which caused tiny text, huge line gaps, glued words and end marks before their ayah. Fix `8687a20`: each run uses the Quran font, the reader's text size and right-to-left direction.
- Black dots inside words: the bundled KFGQPC Uthmanic HAFS font (v0.09) is too old for the Tanzil text and draws a filled dotted circle for four signs: U+06DF (silent alef after waw, about 4,000 uses), U+06ED (small low meem, about 4,800), U+06EA and U+06EB (once each). Stopgap `4e7f28a` (`packages/content/src/quran/quranFontMarks.ts`): U+06DF becomes U+06E0, the other three are dropped. This loses the low-meem recitation sign. It runs when text is fetched and when it is shown, so cached text is covered.
- Proper fix, not done: switch to Amiri Quran (SIL OFL), which draws all four signs. It changes the shared UI kit (font tokens, sources, licences, font tests), so it belongs to the ui lane on a branch, not a quick push to `main`.

### 4. The branch-deletion scare (10-27)

- After the owner deleted `lane/auth/admin-bootstrap`, `lane/data/tanzeem-seed` and `lane/content/mushaf-ui` on GitHub, they feared work was lost. A comparison against `main` found: admin-bootstrap fully merged; mushaf-ui's content already in `main` as `65e2c79`; only three `tanzeem-seed` commits (`1ccfb29`, `9e11ea9`, `f905abb`) were missing, and they survived in the local branch. Nothing was lost; they were applied to `main` on 2026-10-28.
- Lessons: compare with `git cherry` (content), not hashes. A command typed as `git commit ... then git push` fails with `pathspec` errors and commits nothing. Locked worktrees need `git worktree remove -f -f`.

### 5. Production seed (10-26)

- Steps used: database backup in the Dokploy postgres terminal, `places.sql` (provinces, 42 cities, areas), invite the first admin, console CSV import of `venues.csv` and `sessions.csv`. The result matched the approved plan. Runbooks: [`../archive/shared-folder/seeding/`](../archive/shared-folder/seeding/). There is no manifest for a console import, so undo means archiving the rows.

### 6. Limits of the agent environments

- Cloud sessions cannot push to GitHub or reach production. Work on the owner's PC runs through Remote Control sessions, which need the PC awake and online, and a permission layer there refuses production writes, DNS changes and some pushes.
- Worktree registrations on the PC went missing before; the lane worktrees are locked on purpose ([`../agents/worktrees.md`](../agents/worktrees.md)).
- Windows: LF endings, `git diff --ignore-cr-at-eol`, stale `.git/*.lock` files after an interrupted commit.

### 7. Secrets pasted in chat

- A Resend API key, the database passwords (in a pasted Dokploy env) and an earlier Dokploy API key were pasted into chats. They must be rotated. Whether that has been done is not recorded.
