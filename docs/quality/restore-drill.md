# Restore drill

**Status: PROVISIONAL.** This is a local rehearsal, not the drill Gate 5 asks for. There is no staging server and no Docker daemon yet, so the real `infra/backup/` scripts ran against a throwaway Postgres 16 cluster, with small stand-ins for `docker` and `rclone`. Gate 2 ("a restore works on staging") and Gate 5 ("the restore drill has been repeated") stay open until the staging run below is done and logged.

Rehearsed: 2026-10-18, quality lane (brief item 6). Scripts as of the platform lane's status of 2026-10-17, **before commit `b375c9b`**. Synthetic data only.

**The scripts have changed since.** Commit `b375c9b` (platform lane) rewrote `backup.sh`, `restore.sh` and `restore-test.sh` in answer to the findings below. The results, timings and failure tests in this document are historical facts about the scripts as rehearsed; they are kept as measured. The procedure on staging has been updated to the scripts as they are now. What changed and which findings it fixes is under "Since the rehearsal".

## Result

- The backup restored completely. After `restore.sh --replace`, every one of the 41 tables matched the source in row count and in an md5 over all its rows. The `audit_log_id_seq` sequence and the schema (hash of `pg_dump --schema-only`) matched too. All 600 poster files came back with the same path, mode, owner and sha256.
- `restore.sh --check` and `restore-test.sh --remote` passed and printed the same row counts as the source.
- Times at this volume: backup 6.7 s end to end, check 7 s, replace 16.5 s (5 s of that is the safety backup). See the timing table below.
- Corrupted, truncated and wrong-key files were all refused, and the live database was not touched, **except** in one case. `--replace` with a damaged file and no `.sha256` file next to it empties the live database (or the poster volume) before it finds out the file is unreadable. That is finding 1. The safety backup that `--replace` takes first brought everything back (12 s). The rehearsal's procedure therefore required a `--check` before every `--replace`. **Fixed in `b375c9b`**: `--replace` now proves the whole set first and restores beside the live database, so that rule is gone from the procedure. Step 9 tests the fix on staging.

## Since the rehearsal: commit `b375c9b`

What the scripts do now (from `infra/backup/` and the "Restore" section of `infra/README.md`):

- **Checksums are mandatory.** `restore.sh` refuses a dump, poster archive or manifest without its `.sha256`, and compares the hash directly (a `.sha256` that names another file cannot vouch for this one). `--allow-missing-checksum` is only for backups made without checksums.
- **Each backup has a counts manifest.** `backup.sh` writes `<name>.manifest` (+ `.sha256`): every public table with its exact row count, taken in the same snapshot `pg_dump` uses, and the number of poster files. Counts only, never data. `restore.sh` refuses a set without it, and fails if a restored table count or the poster count differs. `--allow-missing-manifest` is only for backups made before manifests.
- **Both modes check the whole set first**, before touching anything: checksums, the manifest, a full decrypt of the dump into a private work directory, `pg_restore --list` on it, and a full decrypt and `tar -t` of the poster archive, whose file count must match the manifest.
- **`--replace` restores beside the live data.** It restores into `qc_restore_new` and compares it with the manifest while the stack keeps running. Only then does it stop the api and the worker, take the `pre-restore` backup, unpack the posters into `.restore-new` in the volume, and swap by rename: the poster files, then the databases in one transaction (`qc` becomes `qc_before_restore`). It starts the stack and waits for health. A failure before the swap leaves the live data as it was and starts the stack again. `qc_before_restore` stays until `restore.sh --cleanup` or the next `--replace`.
- **Every run ends with `RESTORE OK` or `RESTORE FAILED`** (with the step and whether live data was touched) and the time. `--replace` also alerts, and after a failed swap prints the command that brings back the `pre-restore` backup.
- **`restore-test.sh --remote`** fetches every file of the set (dump, posters, manifest and their `.sha256`) into a mode-700 directory under `TMPDIR`, else `QC_BACKUP_DIR`. A failed download, a missing `.sha256` or a missing manifest fails the test.

| Finding                                   | State after `b375c9b`                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. `--replace` destroys live data first   | **Fixed**: whole set checked first, restore into `qc_restore_new`, swap by rename, alert and recovery command on failure                   |
| 2. Checksums optional                     | **Fixed**: mandatory in `restore.sh` and `restore-test.sh`; `--allow-missing-checksum` for old backups only                                |
| 3. `--check` compares counts with nothing | **Fixed**: counts manifest written by `backup.sh` and compared by `restore.sh`; `--allow-missing-manifest` for old backups only            |
| 4. No summary line or alert on failure    | **Fixed**: `RESTORE OK` / `RESTORE FAILED` on every run; `--replace` alerts                                                                |
| 5. Remote test downloads into `/tmp`      | **Fixed**: private directory under `TMPDIR`, else `QC_BACKUP_DIR`                                                                          |
| 6. Sizing                                 | **Open**, and larger: a `--replace` now also needs room for the decrypted dump, `qc_restore_new` beside `qc`, and `qc_before_restore` kept |
| 7. No recovery targets                    | **Written down, not decided**: proposed RPO and RTO in `infra/README.md` ("Recovery targets"), open for the owner to accept                |
| 8. New server not covered by the README   | **Fixed**: README says deploy first; `restore.sh` refuses to start without a running stack                                                 |

The platform lane tested `b375c9b` against a throwaway Postgres 16 cluster with stand-ins for `docker` and `rclone`, the same method as this rehearsal (`docs/agents/status/platform.md`). The quality lane has not re-run this rehearsal against the new scripts. The staging drill below is the first independent run of the new `--replace` and of the failure tests against it.

## What was real and what was stood in

| Part                    | Rehearsal                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scripts                 | Real, unchanged: `backup.sh`, `restore.sh`, `restore-test.sh`, `lib.sh`                                                                                                                                                                                                   |
| Postgres                | Real Postgres 16.15 from `/usr/lib/postgresql/16/bin`, private cluster in a temp directory, run as the `postgres` user, fsync on                                                                                                                                          |
| Schema                  | All 10 migrations from `packages/db` (`pnpm --filter @qc/db migrate`), then the dev seed                                                                                                                                                                                  |
| Encryption              | Real `age` with a throwaway key pair generated for the drill and shredded afterwards                                                                                                                                                                                      |
| `docker compose exec`   | Stand-in: runs `pg_dump`, `pg_restore` and `psql` on the host against the drill cluster (same major version as the image)                                                                                                                                                 |
| `docker run` (posters)  | Stand-in: a directory plays the `poster-files` volume. Each call runs in a new mount and network namespace with the directory bind-mounted (read-only for `:ro`), as uid 1000 with no new privileges, so the script's real `tar`, `find` and `rm` commands run as written |
| `docker volume/inspect` | Stand-in: prints the volume name and a fake image                                                                                                                                                                                                                         |
| `compose stop` / `up`   | Logged no-ops. Restarting the api and worker, migrations on `up` and the health wait were **not** exercised. The migration runner was run by hand after the restore and reported nothing to apply                                                                         |
| Second location         | Stand-in `rclone` (`copyto`, `lsf`, `delete`) on a local directory. Upload and download are local copies, with no network                                                                                                                                                 |
| Alerts                  | No webhook set; the alert lines appear in the log only                                                                                                                                                                                                                    |
| Machine                 | 4 vCPU Xeon 2.1 GHz, 15 GB RAM, local SSD                                                                                                                                                                                                                                 |

## Data volume

The dev seed was scaled up with SQL. Phone numbers came from an unassigned country code and the names were generated, so there is no real personal data.

| Table                                           | Rows    |
| ----------------------------------------------- | ------- |
| `reading_days`                                  | 400,000 |
| `message_outbox`                                | 100,000 |
| `registrations`                                 | 75,350  |
| `consents`, `update_reads`                      | 50,000  |
| `attendance`                                    | 40,000  |
| `audit_log`                                     | 30,000  |
| `occurrences`                                   | 29,939  |
| `users`, `profiles`, `auth_sessions`, `follows` | 25,000  |
| `devices`                                       | 19,998  |
| `sessions`                                      | 1,500   |
| `posters`                                       | 600     |
| `updates`                                       | 502     |
| `venues`                                        | 200     |

Database on disk: 279 MB. Custom-format dump (`-Z6`): 41.6 MB. Poster volume: 600 files (PNG 120 to 600 KB, PDF 300 KB to 1 MB, random content so they do not compress, as with real images), 258 MB, owned by uid 1000. One file in ten has mode 0600. One backup set: 310 MB, of which the posters are 86 %.

## Timings

The first group times each step on its own, outside the scripts. The second group times the scripts end to end, which is what an operator will see. These are the scripts before `b375c9b`. The new `--replace` decrypts the dump to disk first, restores while the stack runs and swaps instead of dropping, so its time will differ; the staging drill measures it again.

| Step                                                                   | Time         | Notes                                                                                    |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Dump (`pg_dump -Fc -Z6`)                                               | 3.9 s        | 41.7 MB                                                                                  |
| Encrypt the dump (`age -r`)                                            | 0.06 s       |                                                                                          |
| Dump and encrypt streamed (as `backup.sh` does)                        | 3.8 s        | Encryption costs nothing measurable                                                      |
| Poster `tar` and encrypt                                               | 0.5 s        | 268 MB                                                                                   |
| Upload stand-in (8 files, daily plus Sunday weekly copy, 620 MB)       | ~2 s         | Local copy. At 100 Mbit/s the real upload is about 25 s a night, 50 s on Sundays         |
| Download stand-in (4 files, 310 MB)                                    | 1.1 s        | Local copy. At 100 Mbit/s the real download is about 25 s                                |
| sha256 check (both files)                                              | 0.3 s        |                                                                                          |
| Decrypt the dump (`age -d`)                                            | 0.07 s       |                                                                                          |
| Decrypt the posters                                                    | 0.4 s        |                                                                                          |
| Restore (decrypt streamed into `pg_restore`)                           | 5 to 8 s     | 5 s into the scratch database (`--check`); 8 s including drop and recreate (`--replace`) |
| Checks in `restore.sh` (migrations, 41 table counts, poster count)     | 2 s          |                                                                                          |
| Drill-only checks (row md5 of every table; poster sha256 manifest)     | 4.6 s, 2.5 s | Not part of the scripts; see "Verify" in the procedure                                   |
| **`backup.sh`** (dump, posters, checksums, weekly copy, upload, prune) | **6.7 s**    |                                                                                          |
| **`restore-test.sh --remote`** (download, `--check`, report)           | **9.1 s**    | `--check` itself 7 s                                                                     |
| **`restore.sh --replace`**                                             | **16.5 s**   | Safety backup 5 s, recreate and restore 8 s, verify 1 s, posters 2 s                     |
| `--replace` again, recovering from the safety backup                   | 12 s         | Twice, after the failure tests                                                           |

At this volume the restore itself is quick. On staging, the restore time will mostly be the transfer from the second location and the person's own steps (getting the key, confirming), not the scripts.

## Failure tests

Run against the scripts before `b375c9b`. With `b375c9b` the two bold cases are refused before anything is stopped (platform lane's test); step 9 of the procedure confirms this on staging.

| Case                                                              | Command                   | Outcome                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dump corrupted (64 random bytes in the middle), `.sha256` present | `--check` and `--replace` | Refused at once: `checksum mismatch`, exit 1, nothing touched                                                                                                                                                             |
| Dump corrupted, no `.sha256`                                      | `--check`                 | `age` rejects the damaged chunk, `pg_restore` stops, exit 1 after 3 s, scratch database dropped, live database untouched                                                                                                  |
| Dump truncated (a cut-off download), no `.sha256`                 | `--check`                 | Same: refused, exit 1                                                                                                                                                                                                     |
| Wrong age key                                                     | `--check`                 | `no identity matched any of the recipients`, exit 1                                                                                                                                                                       |
| **Dump corrupted, no `.sha256`**                                  | **`--replace`**           | **Live database dropped and recreated, then the restore failed partway: 41 tables, 0 users, 0 reading days. api and worker left stopped, stack not restarted, no alert, exit 1.** Recovered from the `pre-restore` backup |
| Poster archive corrupted, no `.sha256`                            | `--check`                 | `verify: poster files archive is not readable`, exit 1                                                                                                                                                                    |
| **Poster archive corrupted, no `.sha256`** (dump fine)            | **`--replace`**           | **Database replaced, then the poster volume was emptied and only 336 of 600 files came back. Stack not restarted, no alert, exit 2.** Recovered with a good backup                                                        |

After each refused case, the live database's fingerprint was compared with the source and matched.

## Findings for the platform lane

As reported from the rehearsal. The state of each after `b375c9b` is in the table under "Since the rehearsal".

1. **[Fixed in `b375c9b`] High. `--replace` destroys the live data before it knows the backup is readable.** It stops the api and the worker, drops `qc` and only then decrypts. A damaged file with no `.sha256` next to it leaves an empty or half-filled database and a stopped stack. The poster volume has the same problem: `restore_posters` runs `find /data ... -exec rm -rf` before the archive is proven readable. The `pre-restore` backup makes it recoverable, but only for someone who knows to do that. Suggested fix, in order of value:
   - Before `compose stop`, decrypt both files completely to `/dev/null` (`age -d` checks every chunk; 0.07 s for the dump and 0.4 s for the posters here), and `tar -t` the poster archive. `pg_restore --list` is not enough: from a pipe it reads only the table of contents (0.03 s).
   - Restore into a new database, check it, then swap names (`qc` becomes `qc_before_restore`, the new one becomes `qc`) and keep the old one until a human confirms. Unpack posters into a directory inside the volume and swap the same way.
   - On any failure after `compose stop`: an alert, a final `RESTORE FAILED` line, and the exact command to bring back the `pre-restore` file it just wrote.
2. **[Fixed in `b375c9b`] Medium. Checksums are optional.** A missing `.sha256` is only a warning in `restore.sh`, and `restore-test.sh --remote` ignores a missing remote `.sha256` (`|| true`). `age` caught every corruption tried here, so this is a second line of defence. While finding 1 is open, though, it is the only guard before data is destroyed. Suggest `--replace` refuses to run without the `.sha256` unless a `--no-checksum` flag is given.
3. **[Fixed in `b375c9b`] Medium. `--check` proves a backup restores, not that it is complete.** It prints row counts but compares them with nothing, so a dump missing rows would still pass. Suggest `backup.sh` writes a small manifest next to each set: table names with exact row counts from the dump's own snapshot, and the poster file count. That is counts only, never data. `restore.sh` would then compare against it.
4. **[Fixed in `b375c9b`] Low. Failure output.** When decryption fails, `restore.sh` ends with raw `age` and `pg_restore` lines and no summary line of its own. `restore-test.sh` does alert, but a manual `--check` or `--replace` does not.
5. **[Fixed in `b375c9b`] Low. `restore-test.sh --remote` downloads into `mktemp -d`, which defaults to `/tmp`.** That is 310 MB per run at this volume and it grows. Use a directory under `QC_BACKUP_DIR`, or check free space first.
6. **[Open] Sizing.** One set is 310 MB here and the posters are 86 % of it. With 14 daily sets, 8 weekly sets and the labelled runs, that is at least 22 sets, about 6.8 GB on the VPS and the same at the second location. Every `--replace` adds a `pre-restore` set; this rehearsal's 8 runs used 1.9 GB. The staging host needs room for a downloaded set, a scratch database the size of production, and a safety backup. This supports the platform lane's own open point about incremental poster backups.
7. **[Written down in `infra/README.md`, waiting for the owner] For the orchestrator and the owner: no recovery targets are written down.** With nightly logical dumps, up to about 24 hours of data can be lost (less right after a `pre-deploy` backup). There is no WAL archiving or point-in-time recovery. A recovery point objective (RPO) and recovery time objective (RTO) should be decided and recorded, so the staging drill has something to pass or fail against.
8. **[Fixed in `b375c9b`] Note: restoring onto a brand-new server is not covered by the README.** `--replace` needs the stack up first: the safety backup needs a `qc` database and the posters need the volume. Untested here. Suggest one line in the README's restore section: deploy first (the migrations create an empty schema), then run `--replace`.

## Gaps: what this rehearsal could not show

- The scripts of `b375c9b` were not rehearsed by the quality lane; see "Since the rehearsal".
- No real Docker. The stand-ins replaced `compose exec`, `compose stop`, `compose up` and `docker run`. The api and worker restart, migrations on `up`, the health wait, the image's own `tar`, and the container's read-only root were not exercised.
- No network. Upload and download times are local copies. Real numbers depend on the VPS and the second location's bandwidth.
- No alert delivery and no human receiving it. The platform lane tested the webhook earlier against a local receiver.
- Synthetic data of a guessed size. The staging data (anonymised V1 data after migration) will be shaped differently and may be larger.
- No load during the backup. Nightly runs happen at 02:30, but `pre-deploy` backups can run while people are using the app.
- Key handling (copying the owner's key onto the host, then `shred -u`) was done only with a throwaway key.

## Procedure on staging (repeat for the real drill)

Run as the deploy user on the staging host, from `/srv/qc/app`, with the staging stack deployed and healthy, anonymised data loaded, and the poster templates inserted. The staging env file sets `QC_BACKUP_AGE_RECIPIENT`, `QC_BACKUP_AGE_IDENTITY` (staging holds the private key) and `QC_BACKUP_RCLONE_REMOTE`. Record every time in the log table at the end. Never run this against production.

```sh
cd /srv/qc/app
export QC_ENV_FILE=/srv/qc/staging.env
C=infra/scripts/compose.sh
mkdir -p /srv/qc/state/drill && chmod 700 /srv/qc/state/drill
D=/srv/qc/state/drill

# 0. Preconditions
$C ps                                              # every service running and healthy
df -h /srv/qc "$(docker info -f '{{.DockerRootDir}}')"   # room: 2x the database (qc_restore_new beside qc,
                                                   # then qc_before_restore kept), the decrypted dump, 2x the
                                                   # posters, a downloaded set and the pre-restore backup
rclone lsd "$(grep ^QC_BACKUP_RCLONE_REMOTE= "$QC_ENV_FILE" | cut -d= -f2)"   # second location reachable

# 1. Freeze writes so the before and after fingerprints are comparable
$C stop api worker

# 2. Baseline fingerprint: per table, row count and md5 over all rows (hashes only, no data)
$C exec -T postgres psql -X -U qc -d qc -At <<'SQL' >"$D/before.fp"
SELECT format('SELECT %L, count(*), md5(coalesce(string_agg(x::text, %L ORDER BY x::text), %L)) FROM public.%I x',
              table_name, '|', '', table_name)
FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1
\gexec
SQL
$C run --rm --no-deps --entrypoint sh worker -c \
  'cd /var/lib/qc/posters && find . -type f | sort | xargs sha256sum' >"$D/before.posters"
wc -l "$D/before.fp" "$D/before.posters"

# 3. Timed backup (labelled, so it lands in manual/ and is copied to the second location)
time infra/backup/backup.sh drill                 # note the dump, posters and upload times from the log
NAME=$(basename "$(ls -t /srv/qc/backups/manual/*-drill.dump.age | head -n 1)" .dump.age)

# 4. Timed download from the second location into an empty directory (as after losing the host)
R="$(grep ^QC_BACKUP_RCLONE_REMOTE= "$QC_ENV_FILE" | cut -d= -f2)"
mkdir -p "$D/dl"
time rclone copy "$R/manual/" "$D/dl/" --include "$NAME.*"
ls -l "$D/dl"                                      # dump, posters, manifest and their three .sha256 files

# 5. Timed decrypt (also proves every chunk is intact)
KEY="$(grep ^QC_BACKUP_AGE_IDENTITY= "$QC_ENV_FILE" | cut -d= -f2)"
time age -d -i "$KEY" "$D/dl/$NAME.dump.age" >/dev/null
time age -d -i "$KEY" "$D/dl/$NAME.posters.tar.age" >/dev/null

# 6. Timed check restore. restore.sh compares every row count with the manifest itself
#    ("all N table row counts match the manifest"); also compare the manifest with the baseline
time infra/backup/restore.sh --check "$D/dl/$NAME.dump.age"
diff <(awk '$1 == "table" { print $2 "|" $3 }' "$D/dl/$NAME.manifest" | LC_ALL=C sort) \
     <(cut -d'|' -f1,2 "$D/before.fp" | LC_ALL=C sort) && echo "MANIFEST MATCHES BASELINE"

# 7. Simulate damage (staging only), then a timed replace. --replace checks the whole set itself
#    before it touches anything, so step 6 is for timing, not a precondition.
$C exec -T postgres psql -X -U qc -d qc -c "DELETE FROM reading_days WHERE day > current_date - 7"
$C run --rm --no-deps --entrypoint sh worker -c 'find /var/lib/qc/posters -type f | head -n 5 | xargs rm -f'
time infra/backup/restore.sh --replace "$D/dl/$NAME.dump.age"   # type the project name (qc-staging)
#    Ends with "RESTORE OK"; note the times of the restore into qc_restore_new, the safety backup,
#    the swap and the health wait from the log

# 8. Verify: same fingerprint commands as step 2, written to after.*; both diffs must be empty
$C stop api worker                                 # restore.sh started them; freeze again to compare
#    ... repeat the two commands of step 2 with "$D/after.fp" and "$D/after.posters" ...
diff "$D/before.fp" "$D/after.fp" && diff "$D/before.posters" "$D/after.posters" && echo MATCH
#    The database from before the replace is kept; it should still show the step 7 damage
$C exec -T postgres psql -X -U qc -d qc_before_restore -At \
  -c "SELECT count(*) FROM reading_days WHERE day > current_date - 7"   # 0
$C up -d --wait
curl -fsS "https://<staging domain>/api/health"
#    By hand: sign in to the staging app, open a session with a poster, open the console.

# 9. Failure tests (staging only), now including --replace. Each must exit non-zero, end with
#    "RESTORE FAILED ... live data untouched", and never reach "stopping api and worker".
#    Freeze first so the fingerprint at the end is comparable with after.fp.
$C stop api worker
#    A hand-made copy of the set with a damaged dump. The manifest, the poster archive and their
#    .sha256 files are copied too (restore.sh compares the hash, not the file name inside), so the
#    damaged dump is the only fault.
B="$D/bad"
for ext in manifest manifest.sha256 posters.tar.age posters.tar.age.sha256; do
  cp "$D/dl/$NAME.$ext" "$B.$ext"
done
cp "$D/dl/$NAME.dump.age" "$B.dump.age"
dd if=/dev/urandom of="$B.dump.age" bs=1 count=64 seek=1000000 conv=notrunc
# 9a. No .sha256 for the dump: refused at once, checksums are mandatory
infra/backup/restore.sh --replace "$B.dump.age" --yes >"$D/9a.log" 2>&1; echo "exit $?"  # "no bad.dump.age.sha256"
# 9b. The good dump's .sha256 next to the damaged dump: checksum mismatch
cp "$D/dl/$NAME.dump.age.sha256" "$B.dump.age.sha256"
infra/backup/restore.sh --check "$B.dump.age" >"$D/9b-check.log" 2>&1; echo "exit $?"    # "checksum mismatch"
infra/backup/restore.sh --replace "$B.dump.age" --yes >"$D/9b.log" 2>&1; echo "exit $?"  # "checksum mismatch"
# 9c. Damage caught by age alone (the old-backup path; in the rehearsal this emptied the database)
rm "$B.dump.age.sha256"
infra/backup/restore.sh --replace "$B.dump.age" --yes --allow-missing-checksum \
  >"$D/9c.log" 2>&1; echo "exit $?"                                                     # "does not decrypt completely"
# 9d. A good dump whose manifest disagrees by one row: restored into qc_restore_new, compared,
#     refused, qc_restore_new dropped
S="$D/short"
for ext in dump.age dump.age.sha256 posters.tar.age posters.tar.age.sha256; do
  cp "$D/dl/$NAME.$ext" "$S.$ext"
done
awk '$1 == "table" && $2 == "users" { $3 += 1 } { print }' "$D/dl/$NAME.manifest" >"$S.manifest"
sha256sum "$S.manifest" >"$S.manifest.sha256"
infra/backup/restore.sh --replace "$S.dump.age" --yes >"$D/9d.log" 2>&1; echo "exit $?"  # "do not match the manifest"
#     Each log: one RESTORE FAILED line ending "live data untouched", no "stopping api and worker"
grep -H -E 'RESTORE (OK|FAILED)|stopping api and worker' "$D"/9*.log
$C exec -T postgres psql -X -U qc -d postgres -At \
  -c "SELECT datname FROM pg_database WHERE datname LIKE 'qc_restore%'"               # nothing left behind
#     Live data unchanged: repeat the two commands of step 2 into "$D/fail.fp" and "$D/fail.posters"
diff "$D/after.fp" "$D/fail.fp" && diff "$D/after.posters" "$D/fail.posters" && echo UNTOUCHED
$C up -d --wait

# 10. Weekly test path, as cron runs it (fetches dump, posters, manifest and every .sha256)
time infra/backup/restore-test.sh --remote && cat /srv/qc/backups/last-restore-check

# 11. Clean up: drop qc_before_restore (type qc-staging), and delete the drill directory; the
#     fingerprints are hashes of personal data, keep them off the repository
infra/backup/restore.sh --cleanup
rm -rf "$D"
```

Then record the run below, and in `docs/agents/status/quality.md`. The orchestrator signs the gate off in `docs/agents/status/orchestrator.md`.

## Drill log

| Date       | Where              | Data                                             | Backup | Download      | Check | Replace | Matched                                                           | Failure tests                                                     | By            |
| ---------- | ------------------ | ------------------------------------------------ | ------ | ------------- | ----- | ------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------- |
| 2026-10-18 | Local, provisional | Synthetic, 279 MB database, 600 posters (258 MB) | 6.7 s  | 1.1 s (local) | 7 s   | 16.5 s  | Yes: all 41 tables (count and md5), sequence, schema, 600 posters | Refused cleanly, except `--replace` without `.sha256` (finding 1) | quality agent |
