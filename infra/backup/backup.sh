#!/usr/bin/env bash
# Nightly backup of Postgres and the poster files: dump, encrypt, keep locally with retention, copy
# to a second location.
#
#   QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh            # nightly (cron)
#   QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh pre-deploy # one-off, labelled
#
# - pg_dump runs inside the postgres container (same major version as the server), custom format.
# - The dump is streamed straight into `age` and encrypted to QC_BACKUP_AGE_RECIPIENT (a public
#   key). Nothing unencrypted touches the disk, and this server cannot decrypt its own backups:
#   the private key stays with the owner and on the staging host that runs restore checks.
# - The poster-files volume (rendered posters, decision: local disk on the VPS for now) is archived
#   with tar in a throwaway container (no network, read-only) and encrypted the same way, as a
#   second file next to the dump: <same name>.posters.tar.age (+ .sha256). It is skipped, with a
#   log line, while the volume does not exist yet.
# - A manifest goes with each set: <same name>.manifest (+ .sha256), plain text, counts only, no
#   data: the exact row count of every public table, taken in the same snapshot pg_dump uses, and
#   the number of files in the poster archive. restore.sh refuses a restore that does not match it.
# - Layout under QC_BACKUP_DIR:
#     daily/<project>-<UTC time>.dump.age (+ .sha256)   kept QC_BACKUP_RETENTION_DAYS days
#     daily/<project>-<UTC time>.posters.tar.age (+ .sha256)   the poster files, same retention
#     daily/<project>-<UTC time>.manifest (+ .sha256)          counts only, same retention
#     weekly/...                                           Sunday copies, kept ..._WEEKLY_RETENTION_WEEKS
#     manual/...-<label>.dump.age                          labelled runs, kept like daily
#     last-success                                         UTC time of the last good backup
# - With QC_BACKUP_RCLONE_REMOTE set, each new file is copied there with rclone and the same
#   retention is applied to the remote.
#
# Exit status is non-zero on any failure, and a failure raises an alert (QC_ALERT_WEBHOOK_URL).
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

tmp=""
snap_pid=""
on_exit() {
  local status=$?
  if [[ -n "$snap_pid" ]]; then kill "$snap_pid" 2>/dev/null || true; fi
  if [[ -n "$tmp" ]]; then rm -rf "$tmp"; fi
  if [[ $status -ne 0 ]]; then
    alert "backup FAILED (exit $status). Check the backup log on the server."
  fi
}
trap on_exit EXIT

label="${1-}"
if [[ -n "$label" && ! "$label" =~ ^[a-z0-9-]{1,32}$ ]]; then
  die "label must be 1-32 characters of a-z, 0-9 and -"
fi

require_env_file
need docker age sha256sum tar

project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
backup_dir="$(env_get QC_BACKUP_DIR /srv/qc/backups)"
recipient="$(env_get QC_BACKUP_AGE_RECIPIENT)"
retention_days="$(env_get QC_BACKUP_RETENTION_DAYS 14)"
weekly_weeks="$(env_get QC_BACKUP_WEEKLY_RETENTION_WEEKS 8)"
remote="$(env_get QC_BACKUP_RCLONE_REMOTE)"

[[ "$recipient" =~ ^age1[0-9a-z]{58}$ ]] ||
  die "QC_BACKUP_AGE_RECIPIENT must be an age public key (age1...); refusing to write an unencrypted backup"
[[ "$retention_days" =~ ^[0-9]+$ && "$retention_days" -ge 1 ]] || die "QC_BACKUP_RETENTION_DAYS must be a whole number >= 1"
[[ "$weekly_weeks" =~ ^[0-9]+$ ]] || die "QC_BACKUP_WEEKLY_RETENTION_WEEKS must be a whole number"
if [[ -n "$remote" ]]; then need rclone; fi

umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -n "$label" ]]; then
  subdir="manual"
  name="${project}-${stamp}-${label}.dump.age"
else
  subdir="daily"
  name="${project}-${stamp}.dump.age"
fi
mkdir -p "$backup_dir/daily" "$backup_dir/weekly" "$backup_dir/manual"
target="$backup_dir/$subdir/$name"
partial="$target.partial"
tmp="$(mktemp -d "$backup_dir/.backup-tmp.XXXXXX")"

started=$SECONDS
log "backup: dumping database of $project"
# One read-only REPEATABLE READ session exports its snapshot, pg_dump dumps exactly that snapshot,
# and the same session then counts every table's rows for the manifest. So the counts describe the
# data in the dump even while the app is writing.
coproc SNAP {
  compose exec -T -e PGOPTIONS='-c client_min_messages=warning' postgres \
    psql -X -q -At -v ON_ERROR_STOP=1 -U qc -d qc
}
# shellcheck disable=SC2153 # SNAP_PID is set by coproc
snap_pid="$SNAP_PID"
snap_out="${SNAP[0]}"
snap_in="${SNAP[1]}"
printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;' 'SELECT pg_export_snapshot();' >&"$snap_in"
snapshot=""
read -r -t 60 snapshot <&"$snap_out" || true
[[ "$snapshot" =~ ^[0-9A-F]+-[0-9A-F]+-[0-9]+$ ]] || die "could not export a snapshot for the dump"
# --no-owner/--no-privileges keep the dump restorable into any database owned by `qc`.
compose exec -T postgres pg_dump -U qc -d qc --snapshot="$snapshot" --format=custom --compress=6 \
  --no-owner --no-privileges |
  age --encrypt --recipient "$recipient" >"$partial"
printf '%s\n' "$QC_COUNT_SQL" "SELECT 'end-of-counts';" 'COMMIT;' >&"$snap_in"
counts=()
while :; do
  line=""
  read -r -t 600 line <&"$snap_out" || die "could not count the rows for the manifest"
  [[ "$line" == "end-of-counts" ]] && break
  [[ "$line" =~ ^table\ [^[:space:]]+\ [0-9]+$ ]] || die "unexpected row count line for the manifest"
  counts+=("$line")
done
exec {snap_in}>&-
wait "$snap_pid" || die "the snapshot session failed"
snap_pid=""
[[ ${#counts[@]} -ge 1 ]] || die "no tables counted for the manifest"

size="$(stat -c %s "$partial")"
# An encrypted empty dump is still a few hundred bytes; a real one is far larger.
[[ "$size" -gt 1024 ]] || die "backup is suspiciously small ($size bytes)"
mv "$partial" "$target"
(cd "$(dirname "$target")" && sha256sum "$name" >"$name.sha256")
log "backup: wrote $subdir/$name ($size bytes) in $((SECONDS - started))s"

names=("$name")

posters_name="${name%.dump.age}.posters.tar.age"
posters_count=""
if [[ -n "$(poster_volume)" ]]; then
  posters_target="$backup_dir/$subdir/$posters_name"
  log "backup: archiving the poster files"
  # The archive stream is also listed on the way to age, to count its files for the manifest
  # (entries that are not directories, as restore.sh counts them).
  mkfifo "$tmp/posters.fifo"
  tar -tf - <"$tmp/posters.fifo" | awk '!/\/$/ { n++ } END { print n + 0 }' >"$tmp/posters.count" &
  counter=$!
  in_poster_volume ro tar -C /data -cf - . | tee "$tmp/posters.fifo" |
    age --encrypt --recipient "$recipient" >"$posters_target.partial"
  wait "$counter" || die "could not list the poster files archive"
  posters_count="$(cat "$tmp/posters.count")"
  [[ "$posters_count" =~ ^[0-9]+$ ]] || die "could not count the poster files"
  mv "$posters_target.partial" "$posters_target"
  (cd "$(dirname "$posters_target")" && sha256sum "$posters_name" >"$posters_name.sha256")
  log "backup: wrote $subdir/$posters_name ($(stat -c %s "$posters_target") bytes, $posters_count files)"
  names+=("$posters_name")
else
  log "backup: no poster-files volume yet, poster files skipped"
fi

# The manifest: counts only (table names, row counts, poster file count), never data.
manifest_name="${name%.dump.age}.manifest"
{
  printf '# Counts only, no data. Written by backup.sh, checked by restore.sh.\n'
  printf 'format qc-backup-manifest 1\n'
  printf 'backup %s\n' "$name"
  printf '%s\n' "${counts[@]}"
  if [[ -n "$posters_count" ]]; then printf 'posters %s\n' "$posters_count"; fi
} >"$backup_dir/$subdir/$manifest_name"
(cd "$backup_dir/$subdir" && sha256sum "$manifest_name" >"$manifest_name.sha256")
log "backup: wrote $subdir/$manifest_name (${#counts[@]} tables)"
names+=("$manifest_name")

new_files=()
for file_name in "${names[@]}"; do
  new_files+=("$backup_dir/$subdir/$file_name" "$backup_dir/$subdir/$file_name.sha256")
done
if [[ -z "$label" && "$(date -u +%u)" == "7" ]]; then
  for file_name in "${names[@]}"; do
    cp "$backup_dir/$subdir/$file_name" "$backup_dir/$subdir/$file_name.sha256" "$backup_dir/weekly/"
    new_files+=("$backup_dir/weekly/$file_name" "$backup_dir/weekly/$file_name.sha256")
  done
  log "backup: kept a weekly copy"
fi

# Local retention (dumps, poster archives, manifests). -mtime +N means "older than N whole days".
find "$backup_dir/daily" "$backup_dir/manual" -type f \
  \( -name '*.age' -o -name '*.age.sha256' -o -name '*.manifest' -o -name '*.manifest.sha256' \) \
  -mtime +"$((retention_days - 1))" -print -delete | sed 's/^/backup: pruned /' >&2 || true
find "$backup_dir/weekly" -type f \
  \( -name '*.age' -o -name '*.age.sha256' -o -name '*.manifest' -o -name '*.manifest.sha256' \) \
  -mtime +"$((weekly_weeks * 7 - 1))" -print -delete | sed 's/^/backup: pruned /' >&2 || true
find "$backup_dir" -type f -name '*.partial' -mmin +60 -delete || true
# Work directories a killed restore or backup left behind (a restore's can hold a decrypted dump).
find "$backup_dir" -mindepth 1 -maxdepth 1 -type d \
  \( -name 'qc-restore.*' -o -name 'qc-restore-test.*' -o -name '.backup-tmp.*' \) \
  -mmin +1440 -exec rm -rf {} + || true

if [[ -n "$remote" ]]; then
  log "backup: copying to the second location"
  for file in "${new_files[@]}"; do
    rel="${file#"$backup_dir"/}"
    rclone copyto --no-traverse "$file" "$remote/$rel"
  done
  rclone delete --min-age "${retention_days}d" "$remote/daily" || log "warning: remote daily prune failed"
  rclone delete --min-age "${retention_days}d" "$remote/manual" || log "warning: remote manual prune failed"
  rclone delete --min-age "$((weekly_weeks * 7))d" "$remote/weekly" || log "warning: remote weekly prune failed"
else
  log "backup: QC_BACKUP_RCLONE_REMOTE not set, no copy to a second location"
fi

date -u +%Y-%m-%dT%H:%M:%SZ >"$backup_dir/last-success"
log "backup: done"
