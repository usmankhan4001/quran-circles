#!/usr/bin/env bash
# Weekly restore test: restores the newest backup into a scratch database and reports the result.
# Run it on the staging host, which holds the age private key (QC_BACKUP_AGE_IDENTITY); the
# production host cannot decrypt its own backups.
#
#   QC_ENV_FILE=/srv/qc/staging.env infra/backup/restore-test.sh            # newest local backup
#   QC_ENV_FILE=/srv/qc/staging.env infra/backup/restore-test.sh --remote   # newest in the second location
#
# --remote fetches the newest daily backup from QC_BACKUP_RESTORE_SOURCE (an rclone path such as
# offsite:qc-backups/prod; defaults to QC_BACKUP_RCLONE_REMOTE) into a temporary directory.
# Success and failure both raise a message through QC_ALERT_WEBHOOK_URL, so silence means the
# test did not run. The result is also written to <QC_BACKUP_DIR>/last-restore-check.
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_env_file
backup_dir="$(env_get QC_BACKUP_DIR /srv/qc/backups)"
mkdir -p "$backup_dir"
workdir=""
cleanup() { [[ -n "$workdir" ]] && rm -rf "$workdir"; }
trap cleanup EXIT

if [[ "${1-}" == "--remote" ]]; then
  need rclone
  source_path="$(env_get QC_BACKUP_RESTORE_SOURCE "$(env_get QC_BACKUP_RCLONE_REMOTE)")"
  [[ -n "$source_path" ]] || die "set QC_BACKUP_RESTORE_SOURCE or QC_BACKUP_RCLONE_REMOTE"
  newest="$(rclone lsf --files-only --include '*.dump.age' "$source_path/daily" | sort | tail -n 1)"
  [[ -n "$newest" ]] || die "no backups found in $source_path/daily"
  workdir="$(mktemp -d)"
  rclone copyto "$source_path/daily/$newest" "$workdir/$newest"
  rclone copyto "$source_path/daily/$newest.sha256" "$workdir/$newest.sha256" || true
  file="$workdir/$newest"
else
  file="$(find "$backup_dir/daily" -maxdepth 1 -type f -name '*.dump.age' 2>/dev/null | sort | tail -n 1)"
  [[ -n "$file" ]] || die "no backups found in $backup_dir/daily"
fi

started=$SECONDS
if "$(dirname "${BASH_SOURCE[0]}")/restore.sh" --check "$file"; then
  result="passed: $(basename "$file") restored and verified in $((SECONDS - started))s"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$result" >"$backup_dir/last-restore-check"
  alert "weekly restore test $result"
else
  result="FAILED: $(basename "$file") after $((SECONDS - started))s"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$result" >"$backup_dir/last-restore-check"
  alert "weekly restore test $result"
  exit 1
fi
