#!/usr/bin/env bash
# Restores an encrypted backup made by backup.sh.
#
#   restore.sh --check   <file.dump.age>          restore into a scratch database, verify, drop it
#   restore.sh --replace <file.dump.age> [--yes]  REPLACE the live database and poster files
#   restore.sh --cleanup [--yes]                  drop qc_before_restore, kept by --replace
#
# Options:
#   --identity <file>          age private key file (default: QC_BACKUP_AGE_IDENTITY)
#   --yes                      do not ask for confirmation (--replace, --cleanup)
#   --allow-missing-checksum   accept files without their .sha256 (only for backups made or copied
#                              without them); damage is then caught by age alone
#   --allow-missing-manifest   accept a backup without its .manifest (only for backups made before
#                              manifests); row and poster counts are then compared with nothing
#
# A backup set is <name>.dump.age, <name>.manifest and, when the manifest lists poster files,
# <name>.posters.tar.age, each with a .sha256, all in the same directory.
#
# Before anything else, both modes prove the whole set is readable, so a damaged backup is refused
# before live data is touched: the checksums, the manifest, a full decrypt of the dump into a
# private work directory (age checks every chunk), `pg_restore --list` on the decrypted file, and a
# full decrypt and `tar -t` of the poster archive, whose file count must match the manifest.
#
# --check restores into the scratch database `qc_restore_check`, checks the schema, compares every
# table's row count with the manifest (counts only, never data) and drops it. It touches nothing
# the application uses.
#
# --replace restores into a new database `qc_restore_new` and compares it with the manifest while
# the stack keeps running. Only then it stops the api and the worker, takes a `pre-restore` safety
# backup (when QC_BACKUP_AGE_RECIPIENT is set), unpacks the poster files into a new directory in
# the volume and swaps: the poster files first, then the database names in one transaction (`qc`
# becomes `qc_before_restore`, `qc_restore_new` becomes `qc`). Then it starts the stack, which runs
# newer migrations, and waits until it is healthy. A failure before the swap leaves the live data
# as it was and starts the stack again. `qc_before_restore` stays until --cleanup or the next
# --replace drops it. The stack must be deployed first, also on a brand-new server.
#
# Every run ends with one line, RESTORE OK or RESTORE FAILED, and the time taken. --replace also
# sends that result through QC_ALERT_WEBHOOK_URL and, if it fails after the swap, prints the
# command that brings back the safety backup.
#
# Work files go to a new mode-700 directory under TMPDIR, else QC_BACKUP_DIR, and are deleted at
# the end. The env file comes from QC_ENV_FILE (default /srv/qc/prod.env).
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"
  exit 2
}

mode=""
file=""
identity=""
assume_yes=0
allow_missing_checksum=0
allow_missing_manifest=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check | --replace)
      [[ $# -ge 2 ]] || usage
      mode="${1#--}"
      file="$2"
      shift 2
      ;;
    --cleanup) mode="cleanup" && shift ;;
    --identity)
      [[ $# -ge 2 ]] || usage
      identity="$2"
      shift 2
      ;;
    --yes) assume_yes=1 && shift ;;
    --allow-missing-checksum) allow_missing_checksum=1 && shift ;;
    --allow-missing-manifest) allow_missing_manifest=1 && shift ;;
    *) usage ;;
  esac
done
[[ -n "$mode" ]] || usage
[[ "$mode" == "cleanup" || -n "$file" ]] || usage

started=$SECONDS
stage="starting"
summary=""           # the RESTORE OK line
stack_stopped=0      # this run stopped the api and the worker
swapped=0            # live data (poster files or database) has been replaced
db_swapped=0         # `qc` is the restored database, the earlier one is qc_before_restore
db_new=""            # a database this run created and drops unless it became `qc`
posters_staged=0     # this run created /data/.restore-new in the poster-files volume
workdir=""
safety_file=""
backup_dir="$(env_get QC_BACKUP_DIR /srv/qc/backups)"
project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"

finish() {
  local status=$? state
  trap - EXIT
  set +e
  if [[ -n "$db_new" ]]; then
    psql_in_db postgres "DROP DATABASE IF EXISTS $db_new WITH (FORCE)" >/dev/null 2>&1
  fi
  if [[ $posters_staged -eq 1 && $swapped -eq 0 ]]; then
    in_poster_volume rw rm -rf /data/.restore-new
  fi
  if [[ -n "$workdir" ]]; then rm -rf "$workdir"; fi
  if [[ $stack_stopped -eq 1 && $swapped -eq 0 ]]; then
    log "restore: starting the stack again on the live data, which was not changed"
    compose up -d --wait ||
      log "restore: warning: the stack did not come up; check it with infra/scripts/compose.sh ps"
  fi

  if [[ $status -eq 0 ]]; then
    log "RESTORE OK: $summary in $((SECONDS - started))s"
    if [[ "$mode" == "replace" ]]; then alert "restore OK: $summary"; fi
    exit 0
  fi

  if [[ $swapped -eq 0 ]]; then state="live data untouched"; else state="live data already replaced"; fi
  if [[ $swapped -eq 1 ]]; then
    if [[ $db_swapped -eq 1 ]]; then
      log "restore: the database from before this restore is kept as qc_before_restore"
    else
      log "restore: the poster files may be half swapped: earlier ones in /data/.restore-old, restored ones in /data/.restore-new of the poster-files volume"
    fi
    if [[ -n "$safety_file" ]]; then
      log "restore: to go back to the data from before this restore (database and poster files), run:"
      log "  QC_ENV_FILE=$QC_ENV_FILE $0 --replace $safety_file --identity $identity"
    else
      log "restore: no safety backup was taken (QC_BACKUP_AGE_RECIPIENT not set)"
    fi
  fi
  log "RESTORE FAILED: $mode of $(basename "${file:-qc_before_restore}") at step \"$stage\" after $((SECONDS - started))s; $state"
  if [[ "$mode" == "replace" ]]; then
    alert "restore FAILED at step \"$stage\" ($state). See the restore output on the server."
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_env_file
need docker

db_exists() {
  [[ "$(psql_in_db postgres "SELECT count(*) FROM pg_database WHERE datname = '$1'")" == "1" ]]
}

# confirm WHAT: asks for the project name unless --yes.
confirm() {
  if [[ $assume_yes -ne 1 ]]; then
    printf '%s\nType the project name to continue: ' "$1" >&2
    local answer=""
    read -r answer || true
    [[ "$answer" == "$project" ]] || die "not confirmed"
  fi
}

if [[ "$mode" == "cleanup" ]]; then
  stage="dropping qc_before_restore"
  if ! db_exists qc_before_restore; then
    summary="nothing to clean up (no qc_before_restore)"
    exit 0
  fi
  confirm "This DROPS qc_before_restore, the database from before the last restore of $project."
  psql_in_db postgres "DROP DATABASE qc_before_restore WITH (FORCE)" >/dev/null
  summary="dropped qc_before_restore"
  exit 0
fi

need age sha256sum tar
identity="${identity:-$(env_get QC_BACKUP_AGE_IDENTITY)}"
[[ -n "$identity" && -r "$identity" ]] || die "age identity not readable (use --identity or QC_BACKUP_AGE_IDENTITY)"

# check_sum FILE: FILE must match the hash in FILE.sha256 (compared directly, so a .sha256 that
# names a different file cannot vouch for this one). Missing: refused unless allowed.
check_sum() {
  local f="$1" expected actual
  if [[ ! -e "$f.sha256" ]]; then
    [[ $allow_missing_checksum -eq 1 ]] ||
      die "no $(basename "$f").sha256 next to the backup; copy it too (--allow-missing-checksum only for a backup made without one)"
    log "restore: warning: no $(basename "$f").sha256, checksum not verified (--allow-missing-checksum)"
    return 0
  fi
  expected="$(awk 'NR == 1 { print $1 }' "$f.sha256")"
  actual="$(sha256sum "$f" | awk '{ print $1 }')"
  [[ "$expected" =~ ^[0-9a-f]{64}$ && "$expected" == "$actual" ]] || die "checksum mismatch for $(basename "$f")"
  log "restore: checksum ok for $(basename "$f")"
}

# read_manifest: sets manifest, expected_tables (sorted "table <name> <count>" lines) and
# expected_posters (empty when the backup has no poster files).
manifest=""
expected_tables=""
expected_posters=""
read_manifest() {
  local line n=0 format_seen=0
  manifest="${file%.dump.age}.manifest"
  if [[ ! -e "$manifest" ]]; then
    [[ $allow_missing_manifest -eq 1 ]] ||
      die "no $(basename "$manifest") next to the backup; copy it too (--allow-missing-manifest only for a backup made before manifests)"
    log "restore: warning: no manifest, row and poster counts not compared (--allow-missing-manifest)"
    manifest=""
    return 0
  fi
  check_sum "$manifest"
  local manifest_name
  manifest_name="$(basename "$manifest")"
  while IFS= read -r line || [[ -n "$line" ]]; do
    n=$((n + 1))
    case "$line" in
      "" | "#"*) ;;
      "format qc-backup-manifest 1") format_seen=1 ;;
      "backup "*) ;;
      *)
        if [[ "$line" =~ ^table\ [^[:space:]]+\ [0-9]+$ ]]; then
          expected_tables+="$line"$'\n'
        elif [[ "$line" =~ ^posters\ ([0-9]+)$ ]]; then
          expected_posters="${BASH_REMATCH[1]}"
        else
          die "line $n of $manifest_name is not a manifest line"
        fi
        ;;
    esac
  done <"$manifest"
  [[ $format_seen -eq 1 && -n "$expected_tables" ]] || die "$manifest_name is not a backup manifest"
  expected_tables="$(printf '%s' "$expected_tables" | LC_ALL=C sort)"
  log "restore: manifest lists $(printf '%s\n' "$expected_tables" | wc -l) table(s)${expected_posters:+ and $expected_posters poster file(s)}"
}

# preflight: proves the whole set is readable. Changes nothing outside the work directory.
posters_file=""
posters_count=""
preflight() {
  stage="checking the backup files"
  [[ "$file" == *.dump.age ]] || die "expected a <name>.dump.age file"
  [[ -r "$file" ]] || die "cannot read $file"
  check_sum "$file"
  read_manifest
  local candidate="${file%.dump.age}.posters.tar.age"
  if [[ -n "$expected_posters" ]]; then
    [[ -r "$candidate" ]] ||
      die "the manifest lists $expected_posters poster file(s) but $(basename "$candidate") is missing; copy it too"
    posters_file="$candidate"
  elif [[ -n "$manifest" ]]; then
    log "restore: the backup has no poster files; poster files are not touched"
  elif [[ -r "$candidate" ]]; then
    posters_file="$candidate"
  else
    log "restore: no poster files archive next to the backup; poster files are not touched"
  fi
  if [[ -n "$posters_file" ]]; then check_sum "$posters_file"; fi

  stage="checking the stack"
  [[ -n "$(compose ps -q postgres)" ]] ||
    die "postgres is not running: deploy the stack first (infra/scripts/deploy.sh), also on a new server, then restore"
  if [[ "$mode" == "replace" && -n "$posters_file" ]]; then
    [[ -n "$(poster_volume)" ]] ||
      die "the poster-files volume does not exist: deploy the stack first (infra/scripts/deploy.sh), then restore"
    in_poster_volume ro sh -c '[ ! -e /data/.restore-old ] && [ ! -e /data/.restore-swapping ]' ||
      die "the poster-files volume holds .restore-old from an interrupted restore; it may be the only copy of the earlier poster files. Check and remove it by hand, then restore again"
  fi

  stage="decrypting the dump"
  workdir="$(private_workdir restore)"
  age --decrypt --identity "$identity" --output "$workdir/backup.dump" "$file" ||
    die "the dump does not decrypt completely (damaged, truncated or the wrong key)"
  stage="reading the dump"
  local entries
  entries="$(in_pg_image "$workdir:/restore:ro" "$(id -u):$(id -g)" pg_restore --list /restore/backup.dump |
    grep -c -v '^;')" || die "pg_restore cannot read the decrypted dump"
  log "restore: dump decrypted ($(stat -c %s "$workdir/backup.dump") bytes), $entries archive entries"

  if [[ -n "$posters_file" ]]; then
    stage="reading the poster files archive"
    posters_count="$(age --decrypt --identity "$identity" "$posters_file" | tar -tf - |
      awk '!/\/$/ { n++ } END { print n + 0 }')" ||
      die "the poster files archive does not decrypt completely or is not a readable tar"
    log "restore: poster files archive decrypted, $posters_count file(s)"
    if [[ -n "$expected_posters" && "$posters_count" != "$expected_posters" ]]; then
      die "the poster files archive holds $posters_count file(s), the manifest says $expected_posters"
    fi
  fi
}

# restore_into DB: creates DB and restores the decrypted dump into it, stopping at the first error.
restore_into() {
  db_new="$1"
  psql_in_db postgres "DROP DATABASE IF EXISTS $1 WITH (FORCE)" >/dev/null
  psql_in_db postgres "CREATE DATABASE $1 OWNER qc" >/dev/null
  compose exec -T postgres pg_restore -U qc -d "$1" --no-owner --role=qc --exit-on-error \
    <"$workdir/backup.dump"
}

# verify DB: applied migrations, and every table's row count equal to the manifest.
verify() {
  local db="$1" migrations actual
  migrations="$(psql_in_db "$db" "SELECT count(*) FROM schema_migrations")" || die "verify: no schema_migrations in $db"
  [[ "$migrations" =~ ^[0-9]+$ && "$migrations" -ge 1 ]] || die "verify: no applied migrations in $db"
  log "restore: $db has $migrations applied migration(s), latest $(psql_in_db "$db" "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1")"
  actual="$(psql_in_db "$db" "$QC_COUNT_SQL" | LC_ALL=C sort)" || die "verify: could not count rows in $db"
  printf '%s\n' "$actual" | awk '{ printf "  %-40s %s\n", $2, $3 }' >&2
  if [[ -z "$manifest" ]]; then
    log "restore: $(printf '%s\n' "$actual" | wc -l) table(s), not compared (no manifest)"
    return 0
  fi
  if [[ "$actual" != "$expected_tables" ]]; then
    log "restore: tables and row counts that differ (< manifest, > restored):"
    diff <(printf '%s\n' "$expected_tables") <(printf '%s\n' "$actual") | grep '^[<>]' | sed 's/^/  /' >&2 || true
    die "verify: the row counts in $db do not match the manifest"
  fi
  log "restore: all $(printf '%s\n' "$actual" | wc -l) table row counts match the manifest"
}

# Poster swap scripts, run as POSIX sh in the volume. Every step is a rename inside the volume.
# swap: earlier entries into .restore-old, then (marked by .restore-swapping) the restored ones up
# from .restore-new. undo: puts the earlier entries back from whichever point swap stopped at.
# shellcheck disable=SC2016 # expanded by the container's sh, not here
swap_posters_sh='set -u
move_all() { # FROM TO: moves every entry of FROM, except the work entries, into TO
  for f in "$1"/* "$1"/.[!.]* "$1"/..?*; do
    { [ -e "$f" ] || [ -L "$f" ]; } || continue
    case "${f##*/}" in .restore-new | .restore-old | .restore-swapping) continue ;; esac
    mv "$f" "$2"/ || exit 1
  done
}
case "$1" in
  swap)
    mkdir /data/.restore-old || exit 1
    move_all /data /data/.restore-old
    touch /data/.restore-swapping || exit 1
    move_all /data/.restore-new /data
    rmdir /data/.restore-new && rm /data/.restore-swapping ;;
  undo)
    [ -d /data/.restore-old ] || exit 0
    if [ -e /data/.restore-swapping ]; then
      mkdir -p /data/.restore-new || exit 1
      move_all /data /data/.restore-new
    fi
    move_all /data/.restore-old /data
    rmdir /data/.restore-old && rm -f /data/.restore-swapping ;;
esac'

swap_database() {
  local try
  for try in 1 2 3; do
    psql_in_db postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('qc', '$db_new') AND pid <> pg_backend_pid()" >/dev/null || true
    if psql_in_db postgres "BEGIN; ALTER DATABASE qc RENAME TO qc_before_restore; ALTER DATABASE $db_new RENAME TO qc; COMMIT;" >/dev/null; then
      return 0
    fi
    log "restore: database rename failed (attempt $try)"
    sleep 1
  done
  return 1
}

case "$mode" in
  check)
    preflight
    stage="restoring into the scratch database"
    log "restore: restoring $(basename "$file") into scratch database qc_restore_check"
    restore_into qc_restore_check
    stage="verifying"
    verify qc_restore_check
    summary="check of $(basename "$file") passed${posters_count:+ ($posters_count poster files)}"
    ;;

  replace)
    preflight
    stage="waiting for confirmation"
    confirm "This REPLACES the live database${posters_file:+ and poster files} of $project with $(basename "$file")."
    if [[ -z "$(env_get QC_BACKUP_AGE_RECIPIENT)" ]]; then
      log "restore: warning: QC_BACKUP_AGE_RECIPIENT not set, no safety backup will be taken"
    fi

    stage="restoring into a new database"
    log "restore: restoring $(basename "$file") into qc_restore_new (the live database is not touched)"
    restore_into qc_restore_new
    stage="verifying the new database"
    verify qc_restore_new

    stage="stopping api and worker"
    log "restore: stopping api and worker"
    stack_stopped=1
    compose stop api worker

    if [[ -n "$(env_get QC_BACKUP_AGE_RECIPIENT)" ]]; then
      stage="taking the pre-restore safety backup"
      log "restore: safety backup of the current database and poster files first"
      "$(dirname "${BASH_SOURCE[0]}")/backup.sh" pre-restore || die "the safety backup failed"
      safety_file="$(find "$backup_dir/manual" -maxdepth 1 -name '*-pre-restore.dump.age' | sort | tail -n 1)"
      log "restore: safety backup $safety_file"
    fi

    if [[ -n "$posters_file" ]]; then
      stage="unpacking the poster files into a new directory"
      in_poster_volume rw rm -rf /data/.restore-new
      posters_staged=1
      age --decrypt --identity "$identity" "$posters_file" |
        in_poster_volume rw sh -c 'mkdir /data/.restore-new && tar -C /data/.restore-new -xf -' ||
        die "could not unpack the poster files"
      unpacked="$(in_poster_volume ro sh -c 'cd /data/.restore-new && find . ! -type d | wc -l')"
      unpacked="${unpacked//[[:space:]]/}"
      [[ "$unpacked" == "$posters_count" ]] ||
        die "unpacked $unpacked poster file(s), the archive lists $posters_count"

      stage="swapping the poster files"
      swapped=1
      if ! in_poster_volume rw sh -c "$swap_posters_sh" sh swap; then
        log "restore: the poster swap failed; putting the earlier poster files back"
        if in_poster_volume rw sh -c "$swap_posters_sh" sh undo; then swapped=0; fi
        die "could not swap the poster files"
      fi
    fi

    stage="swapping the databases"
    if db_exists qc_before_restore; then
      log "restore: dropping qc_before_restore from an earlier restore (older than the data being replaced)"
      psql_in_db postgres "DROP DATABASE qc_before_restore WITH (FORCE)" >/dev/null
    fi
    if ! swap_database; then
      if [[ -n "$posters_file" ]]; then
        log "restore: putting the earlier poster files back"
        if in_poster_volume rw sh -c "$swap_posters_sh" sh undo; then swapped=0; fi
      fi
      die "could not swap the databases"
    fi
    swapped=1
    db_swapped=1
    db_new=""
    log "restore: qc now holds the backup; the earlier database is qc_before_restore"
    if [[ -n "$posters_file" ]]; then
      in_poster_volume rw rm -rf /data/.restore-old ||
        log "restore: warning: could not remove .restore-old from the poster-files volume; remove it by hand"
    fi

    stage="starting the stack"
    log "restore: starting the stack (runs newer migrations, waits for health)"
    compose up -d --wait || die "the stack did not become healthy after the restore"
    stack_stopped=0
    summary="$(basename "$file") replaced the live data of $project; the earlier database is kept as qc_before_restore (drop it with restore.sh --cleanup once checked)"
    ;;
esac
