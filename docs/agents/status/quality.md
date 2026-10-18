# Status: quality

Shared by the quality agents; each keeps its own section.

## Restore drill

Updated: 2026-10-18. Brief item 6. **Provisional**: local rehearsal only, with no staging and no Docker daemon. Write-up, timings, findings and the staging procedure are in `docs/quality/restore-drill.md`.

- Done: the real `infra/backup/` scripts ran end to end against a throwaway Postgres 16 cluster. It had all migrations applied and the dev seed scaled to 25,000 users, 1,500 sessions, 75,350 registrations, 400,000 reading days and 600 poster files (279 MB database, 310 MB per backup set). The scripts used a throwaway `age` key, since shredded, and stand-ins for `docker` and `rclone`. Backup 6.7 s, `restore-test.sh --remote` 9.1 s, `--check` 7 s, `--replace` 16.5 s. After `--replace`, all 41 tables matched the source in count and row md5, and the sequence, the schema and all 600 posters (sha256, mode, owner) matched too.
- Failure tests: corrupted (with `.sha256`), corrupted (without), truncated and wrong-key files were all refused cleanly by `--check`. **Exception:** `--replace` with a corrupted dump or poster archive and no `.sha256` empties the live database or poster volume before failing, and leaves the stack stopped with no alert. The `pre-restore` safety backup recovered it in 12 s.
- Blocked: Gate 2 "restore works on staging" and Gate 5 "restore drill repeated" need the staging server. Then follow the procedure in the drill doc and add a row to its log.
- Findings for the platform lane (details in the drill doc): (1) high: `--replace` must prove both files decrypt (and `tar -t`) before stopping or dropping anything; better, restore into a new database and swap names, and alert on failure. (2) `.sha256` is optional on `--replace` and on `restore-test.sh --remote`. (3) `--check` compares counts against nothing; suggest a counts manifest written with each backup. (4) No summary line or alert when a manual restore fails. (5) The remote test downloads into `/tmp`. (6) Sizing: about 6.8 GB of retained sets at this volume, posters 86 %. (7) Restoring onto a new server needs the stack deployed first; the README does not say so.
- Questions for the orchestrator: no RPO or RTO is written down anywhere. Nightly dumps mean up to about 24 h of data loss and there is no point-in-time recovery. Who decides the targets the staging drill should pass?

### Restore drill doc after `b375c9b` (2026-10-18)

- `docs/quality/restore-drill.md` updated to the scripts as rewritten in `b375c9b`. Measured results, timings and failure tests kept as historical facts and labelled as the scripts before `b375c9b`. New section "Since the rehearsal" lists what changed and the state of each finding: 1, 2, 3, 4, 5 and 8 fixed; 6 (sizing) open and larger; 7 written down in `infra/README.md`, waiting for the owner.
- Staging procedure: `--check` before `--replace` is no longer required; step 6 also compares the manifest with the baseline fingerprint; step 8 checks `qc_before_restore`; step 9 now runs failure tests against `--replace` (missing checksum, checksum mismatch, damage caught by `age` with `--allow-missing-checksum`, manifest off by one row), with the hand-made set carrying a copied manifest, poster archive and `.sha256` files; step 11 runs `restore.sh --cleanup`. `npx prettier --check` clean.
- Not done: the quality lane has not re-run the local rehearsal against the new scripts. The staging drill is the first independent run.

## Security review

Updated: 2026-10-18. Brief items 1 and 7. **Provisional**: code review of `main` at `3c84b79` plus local throwaway probes; no staging. Full write-up: `docs/security/review.md`.

- Done: security review of authentication, the scope engine and all 95 endpoints, registration and exports, the worker, the renderer, infrastructure, logs, account deletion, secrets in the tree and in history, and dependencies. Result: 0 Critical, 0 High, 5 Medium, 10 Low, 11 Info. No secrets in the code or the history. None of the exposed V1 credentials (Supabase, Neon, OneSignal) are in V2. Both `pnpm audit` runs reached the registry; the only advisories are in Expo and drizzle-kit build tooling.
- Blocked: the tool refused to write `docs/security/findings.md` (the tracking table, 26 rows, all `open`). The table content went to the orchestrator in this session's report; it needs to be committed by the orchestrator or a quality session that is allowed to write it. `review.md` points to it.
- In progress: none. Next steps are owner-lane fixes, then re-verification, then staging checks.
- Questions for the orchestrator: owner decisions are needed on SEC-04 (Pakistan-only sign-in), SEC-05 (legacy data retention and deletion) and SEC-22 (whether handover by invite should cut the old coordinator's access at once). A human must approve the findings (brief).

Reports to owner lanes (each lane fixes in its own directories; details and fixes in `review.md`):

- messaging: SEC-01 Medium (web push SSRF: allowlist push hosts, no redirects); SEC-02 Medium (wire the WhatsApp daily cap and city budget; budget and a hard ceiling for critical templates too); SEC-06 Low (clear outbox payloads after send); SEC-21 Info (code message says 10 minutes, codes expire after 5).
- api-core: SEC-03 Medium (cancel and re-register repeats paid confirmations; bulk coordinator invitations); SEC-05 Medium (deletion leaves legacy V1 rows); SEC-13 Low (poster throttle); SEC-20, SEC-22, SEC-24, SEC-25, SEC-26 Info. Also check registration-side web push validation for SEC-01.
- auth-scopes: SEC-04 Medium (codes to any country, no global cap); SEC-07 Low (refresh unthrottled, in-memory limiters, no daily per-phone cap); SEC-20 Info (shared client-address helper).
- contracts: SEC-08 Low (control and bidi characters in names and place text); SEC-09 Low (`onlineLink` schemes). Supporting changes for SEC-01, SEC-04, SEC-12 and SEC-15 (drizzle-kit).
- platform: SEC-10 Low (CSP and frame protection); SEC-12 Low (non-superuser application role); SEC-14 Low (CI permissions, SHA pins, CODEOWNERS); SEC-17, SEC-18, SEC-19 Info.
- renderer: SEC-11 Low (fails open without `APP_ENV`); SEC-16 Info (Chromium sandbox).
- user-app: SEC-15 Low (Expo advisories); SEC-23 Info (service worker caches non-page responses); token storage part of SEC-10.
- admin-app: SEC-15 Low (Expo advisories).
- Needs staging: SEC-20 (forged `X-Forwarded-For` through Caddy), re-test SEC-01 after the fix, SEC-10 headers, audit on the release candidate, and deliverable 2 (scope matrix against staging).
