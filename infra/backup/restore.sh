#!/usr/bin/env bash
# Restores an encrypted backup made by backup.sh.
#
#   restore.sh --check   <file.dump.age>          restore into a scratch database, verify, drop it
#   restore.sh --replace <file.dump.age> [--yes]  REPLACE the live database with the backup
#
# Options:
#   --identity <file>   age private key file (default: QC_BACKUP_AGE_IDENTITY)
#   --yes               do not ask for confirmation (--replace only)
#
# --check touches nothing the application uses: it creates `qc_restore_check`, restores into it,
# checks the schema and prints row counts (counts only, never data), then drops it.
#
# --replace stops the api and the worker, takes a labelled safety backup of the current database
# and poster files (when QC_BACKUP_AGE_RECIPIENT is set), drops and recreates `qc`, restores,
# then starts the stack again (which runs any newer migrations) and waits until it is healthy.
#
# Poster files: when <name>.posters.tar.age sits next to <name>.dump.age, --check decrypts it and
# counts the files, and --replace empties the poster-files volume and unpacks it there. Without
# it, the poster files are left as they are (a log line says so).
#
# The env file comes from QC_ENV_FILE (default /srv/qc/prod.env). Prints the time taken.
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

usage() {
  sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 2
}

mode=""
file=""
identity=""
assume_yes=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check | --replace)
      mode="${1#--}"
      file="${2-}"
      shift 2 || usage
      ;;
    --identity)
      identity="${2-}"
      shift 2 || usage
      ;;
    --yes) assume_yes=1 && shift ;;
    -h | --help) usage ;;
    *) usage ;;
  esac
done
[[ -n "$mode" && -n "$file" ]] || usage
[[ -r "$file" ]] || die "cannot read $file"

require_env_file
need docker age sha256sum

identity="${identity:-$(env_get QC_BACKUP_AGE_IDENTITY)}"
[[ -n "$identity" && -r "$identity" ]] || die "age identity not readable (use --identity or QC_BACKUP_AGE_IDENTITY)"

# check_sum FILE: verifies FILE against FILE.sha256 when that exists.
check_sum() {
  if [[ -r "$1.sha256" ]]; then
    (cd "$(dirname "$1")" && sha256sum --check --status "$(basename "$1").sha256") ||
      die "checksum mismatch for $1"
    log "restore: checksum ok for $(basename "$1")"
  else
    log "restore: warning: no .sha256 next to $(basename "$1"), checksum not verified"
  fi
}

check_sum "$file"
posters_file=""
if [[ "$file" == *.dump.age && -r "${file%.dump.age}.posters.tar.age" ]]; then
  posters_file="${file%.dump.age}.posters.tar.age"
  check_sum "$posters_file"
else
  log "restore: no poster files archive next to the backup; poster files are not touched"
fi

started=$SECONDS

# restore_into DB: decrypts the backup and restores it into DB, stopping at the first error.
restore_into() {
  age --decrypt --identity "$identity" "$file" |
    compose exec -T postgres pg_restore -U qc -d "$1" --no-owner --role=qc --exit-on-error
}

# check_posters: the poster archive must decrypt and be a readable tar; prints the file count.
check_posters() {
  local listing count
  listing="$(age --decrypt --identity "$identity" "$posters_file" | tar -tf -)" ||
    die "verify: poster files archive is not readable"
  # Entries that are not directories (tar lists directories with a trailing /).
  count="$(printf '%s\n' "$listing" | grep -c '[^/]$' || true)"
  log "restore: poster files archive holds $count file(s)"
}

# restore_posters: empties the poster-files volume and unpacks the archive into it.
restore_posters() {
  if [[ -z "$(poster_volume)" ]]; then
    log "restore: warning: no poster-files volume yet; run 'compose.sh up -d' once, then restore again"
    return 0
  fi
  log "restore: replacing the poster files"
  age --decrypt --identity "$identity" "$posters_file" |
    in_poster_volume rw sh -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /data -xf -'
  check_posters
}

# verify DB: the schema must have applied migrations and the core tables; prints counts.
verify() {
  local db="$1" migrations tables
  migrations="$(psql_in_db "$db" "SELECT count(*) FROM schema_migrations")"
  tables="$(psql_in_db "$db" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  [[ "$migrations" =~ ^[0-9]+$ && "$migrations" -ge 1 ]] || die "verify: no applied migrations in $db"
  log "restore: $db has $migrations applied migration(s), $tables public table(s)"
  log "restore: latest migration $(psql_in_db "$db" "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1")"
  # Row counts of every public table (estimates are not good enough for a drill).
  local table count
  while read -r table; do
    [[ -z "$table" ]] && continue
    count="$(psql_in_db "$db" "SELECT count(*) FROM public.\"$table\"")"
    printf '  %-40s %s\n' "$table" "$count" >&2
  done < <(psql_in_db "$db" "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1")
}

case "$mode" in
  check)
    db="qc_restore_check"
    cleanup() { psql_in_db postgres "DROP DATABASE IF EXISTS $db WITH (FORCE)" >/dev/null || true; }
    trap cleanup EXIT
    psql_in_db postgres "DROP DATABASE IF EXISTS $db WITH (FORCE)" >/dev/null
    psql_in_db postgres "CREATE DATABASE $db OWNER qc" >/dev/null
    log "restore: restoring $(basename "$file") into scratch database $db"
    restore_into "$db"
    verify "$db"
    if [[ -n "$posters_file" ]]; then check_posters; fi
    log "restore: CHECK PASSED in $((SECONDS - started))s"
    ;;

  replace)
    project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
    if [[ $assume_yes -ne 1 ]]; then
      printf 'This REPLACES the live database of %s with %s.\nType the project name to continue: ' \
        "$project" "$(basename "$file")" >&2
      read -r answer
      [[ "$answer" == "$project" ]] || die "not confirmed"
    fi

    log "restore: stopping api and worker"
    compose stop api worker

    if [[ -n "$(env_get QC_BACKUP_AGE_RECIPIENT)" ]]; then
      log "restore: safety backup of the current database and poster files first"
      "$(dirname "${BASH_SOURCE[0]}")/backup.sh" pre-restore
    else
      log "restore: warning: QC_BACKUP_AGE_RECIPIENT not set, no safety backup taken"
    fi

    log "restore: recreating database qc"
    psql_in_db postgres "DROP DATABASE IF EXISTS qc WITH (FORCE)" >/dev/null
    psql_in_db postgres "CREATE DATABASE qc OWNER qc" >/dev/null
    restore_into qc
    verify qc
    if [[ -n "$posters_file" ]]; then restore_posters; fi

    log "restore: starting the stack (runs newer migrations, waits for health)"
    compose up -d --wait
    log "restore: REPLACE DONE in $((SECONDS - started))s"
    ;;
esac
