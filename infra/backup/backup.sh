#!/usr/bin/env bash
# Nightly Postgres backup: dump, encrypt, keep locally with retention, copy to a second location.
#
#   QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh            # nightly (cron)
#   QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh pre-deploy # one-off, labelled
#
# - pg_dump runs inside the postgres container (same major version as the server), custom format.
# - The dump is streamed straight into `age` and encrypted to QC_BACKUP_AGE_RECIPIENT (a public
#   key). Nothing unencrypted touches the disk, and this server cannot decrypt its own backups:
#   the private key stays with the owner and on the staging host that runs restore checks.
# - Layout under QC_BACKUP_DIR:
#     daily/<project>-<UTC time>.dump.age (+ .sha256)   kept QC_BACKUP_RETENTION_DAYS days
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

on_exit() {
  local status=$?
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
need docker age sha256sum

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

started=$SECONDS
log "backup: dumping database of $project"
# --no-owner/--no-privileges keep the dump restorable into any database owned by `qc`.
compose exec -T postgres pg_dump -U qc -d qc --format=custom --compress=6 --no-owner --no-privileges |
  age --encrypt --recipient "$recipient" >"$partial"

size="$(stat -c %s "$partial")"
# An encrypted empty dump is still a few hundred bytes; a real one is far larger.
[[ "$size" -gt 1024 ]] || die "backup is suspiciously small ($size bytes)"
mv "$partial" "$target"
(cd "$(dirname "$target")" && sha256sum "$name" >"$name.sha256")
log "backup: wrote $subdir/$name ($size bytes) in $((SECONDS - started))s"

new_files=("$target" "$target.sha256")
if [[ -z "$label" && "$(date -u +%u)" == "7" ]]; then
  cp "$target" "$target.sha256" "$backup_dir/weekly/"
  new_files+=("$backup_dir/weekly/$name" "$backup_dir/weekly/$name.sha256")
  log "backup: kept a weekly copy"
fi

# Local retention. -mtime +N means "older than N whole days".
find "$backup_dir/daily" "$backup_dir/manual" -type f \( -name '*.dump.age' -o -name '*.dump.age.sha256' \) \
  -mtime +"$((retention_days - 1))" -print -delete | sed 's/^/backup: pruned /' >&2 || true
find "$backup_dir/weekly" -type f \( -name '*.dump.age' -o -name '*.dump.age.sha256' \) \
  -mtime +"$((weekly_weeks * 7 - 1))" -print -delete | sed 's/^/backup: pruned /' >&2 || true
find "$backup_dir" -type f -name '*.partial' -mmin +60 -delete || true

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
