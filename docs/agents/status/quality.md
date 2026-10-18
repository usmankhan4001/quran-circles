# Status: quality

Shared by the quality agents; each keeps its own section.

## Restore drill

Updated: 2026-10-18. Brief item 6. **Provisional**: local rehearsal only, with no staging and no Docker daemon. Write-up, timings, findings and the staging procedure are in `docs/quality/restore-drill.md`.

- Done: the real `infra/backup/` scripts ran end to end against a throwaway Postgres 16 cluster. It had all migrations applied and the dev seed scaled to 25,000 users, 1,500 sessions, 75,350 registrations, 400,000 reading days and 600 poster files (279 MB database, 310 MB per backup set). The scripts used a throwaway `age` key, since shredded, and stand-ins for `docker` and `rclone`. Backup 6.7 s, `restore-test.sh --remote` 9.1 s, `--check` 7 s, `--replace` 16.5 s. After `--replace`, all 41 tables matched the source in count and row md5, and the sequence, the schema and all 600 posters (sha256, mode, owner) matched too.
- Failure tests: corrupted (with `.sha256`), corrupted (without), truncated and wrong-key files were all refused cleanly by `--check`. **Exception:** `--replace` with a corrupted dump or poster archive and no `.sha256` empties the live database or poster volume before failing, and leaves the stack stopped with no alert. The `pre-restore` safety backup recovered it in 12 s.
- Blocked: Gate 2 "restore works on staging" and Gate 5 "restore drill repeated" need the staging server. Then follow the procedure in the drill doc and add a row to its log.
- Findings for the platform lane (details in the drill doc): (1) high: `--replace` must prove both files decrypt (and `tar -t`) before stopping or dropping anything; better, restore into a new database and swap names, and alert on failure. (2) `.sha256` is optional on `--replace` and on `restore-test.sh --remote`. (3) `--check` compares counts against nothing; suggest a counts manifest written with each backup. (4) No summary line or alert when a manual restore fails. (5) The remote test downloads into `/tmp`. (6) Sizing: about 6.8 GB of retained sets at this volume, posters 86 %. (7) Restoring onto a new server needs the stack deployed first; the README does not say so.
- Questions for the orchestrator: no RPO or RTO is written down anywhere. Nightly dumps mean up to about 24 h of data loss and there is no point-in-time recovery. Who decides the targets the staging drill should pass?
