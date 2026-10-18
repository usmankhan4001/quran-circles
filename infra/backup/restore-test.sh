#!/usr/bin/env bash
# Weekly restore test: restores the newest backup into a scratch database with `restore.sh --check`
# (which also checks the poster files archive and compares the counts with the manifest) and
# reports the result.
# Run it on the staging host, which holds the age private key (QC_BACKUP_AGE_IDENTITY); the
# production host cannot decrypt its own backups.
#
#   QC_ENV_FILE=/srv/qc/staging.env infra/backup/restore-test.sh            # newest local backup
#   QC_ENV_FILE=/srv/qc/staging.env infra/backup/restore-test.sh --remote   # newest in the second location
#
# --remote fetches every file of the newest daily backup set (dump, poster files archive, manifest
# and their .sha256) from QC_BACKUP_RESTORE_SOURCE (an rclone path such as offsite:qc-backups/prod;
# defaults to QC_BACKUP_RCLONE_REMOTE) into a new mode-700 directory under TMPDIR, else
# QC_BACKUP_DIR, deleted afterwards. A failed download fails the test.
# --allow-missing-checksum and --allow-missing-manifest are passed on to restore.sh (only for
# backups made before checksums or manifests).
# Success and failure both raise a message through QC_ALERT_WEBHOOK_URL, so silence means the
# test did not run. The result is also written to <QC_BACKUP_DIR>/last-restore-check.
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

remote=0
pass_on=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) remote=1 ;;
    --allow-missing-checksum | --allow-missing-manifest) pass_on+=("$1") ;;
    *) die "unknown option $1 (see the top of $0)" ;;
  esac
  shift
done

require_env_file
backup_dir="$(env_get QC_BACKUP_DIR /srv/qc/backups)"
mkdir -p "$backup_dir"

started=$SECONDS
file=""
workdir=""
reported=0

# report RESULT: records the result and sends it.
report() {
  reported=1
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >"$backup_dir/last-restore-check"
  alert "weekly restore test $1"
}

finish() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$workdir" ]]; then rm -rf "$workdir"; fi
  if [[ $status -ne 0 && $reported -eq 0 ]]; then
    report "FAILED: ${file:+$(basename "$file") }could not be fetched or checked (exit $status) after $((SECONDS - started))s"
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ $remote -eq 1 ]]; then
  need rclone
  source_path="$(env_get QC_BACKUP_RESTORE_SOURCE "$(env_get QC_BACKUP_RCLONE_REMOTE)")"
  [[ -n "$source_path" ]] || die "set QC_BACKUP_RESTORE_SOURCE or QC_BACKUP_RCLONE_REMOTE"
  newest="$(rclone lsf --files-only --include '*.dump.age' "$source_path/daily" | sort | tail -n 1)"
  [[ -n "$newest" ]] || die "no backups found in $source_path/daily"
  file="$newest"
  set_files="$(rclone lsf --files-only --include "${newest%.dump.age}.*" "$source_path/daily")"
  workdir="$(private_workdir restore-test)"
  # Every file of the set. restore.sh refuses the set if a file it needs is missing.
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    rclone copyto "$source_path/daily/$name" "$workdir/$name"
  done <<<"$set_files"
  file="$workdir/$newest"
else
  file="$(find "$backup_dir/daily" -maxdepth 1 -type f -name '*.dump.age' 2>/dev/null | sort | tail -n 1)"
  [[ -n "$file" ]] || die "no backups found in $backup_dir/daily"
fi

if "$(dirname "${BASH_SOURCE[0]}")/restore.sh" --check "$file" "${pass_on[@]}"; then
  report "passed: $(basename "$file") restored and verified in $((SECONDS - started))s"
else
  report "FAILED: $(basename "$file") after $((SECONDS - started))s"
  exit 1
fi
