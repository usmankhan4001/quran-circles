#!/usr/bin/env bash
# Shared helpers for the backup, restore and monitoring scripts. Sourced, not run.
#
# Every script takes the server's env file as QC_ENV_FILE (default /srv/qc/prod.env). Values are
# read by name with `env_get`; the file is never sourced, so a value is never executed.

QC_INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QC_ENV_FILE="${QC_ENV_FILE:-/srv/qc/prod.env}"
QC_COMPOSE_FILE="${QC_COMPOSE_FILE:-$QC_INFRA_DIR/docker-compose.prod.yml}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

die() {
  log "error: $*"
  exit 1
}

# env_get NAME [DEFAULT]: the value of NAME from the environment, else from QC_ENV_FILE, else
# DEFAULT. Surrounding single or double quotes are removed.
env_get() {
  local name="$1" default="${2-}" line value
  # `return 0`, not `return`: inside an EXIT trap a bare return reports the status from before the
  # trap, which would abort a `set -e` caller.
  if [[ -n "${!name-}" ]]; then
    printf '%s' "${!name}"
    return 0
  fi
  if [[ -r "$QC_ENV_FILE" ]]; then
    line="$(grep -E "^${name}=" "$QC_ENV_FILE" | tail -n 1 || true)"
    if [[ -n "$line" ]]; then
      value="${line#*=}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      printf '%s' "$value"
      return 0
    fi
  fi
  printf '%s' "$default"
}

require_env_file() {
  [[ -r "$QC_ENV_FILE" ]] || die "env file $QC_ENV_FILE not readable (set QC_ENV_FILE)"
}

# current_tag: the image tag of the running deploy, as recorded by infra/scripts/deploy.sh.
current_tag() {
  local state_dir project
  state_dir="$(env_get QC_STATE_DIR /srv/qc/state)"
  project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
  cat "$state_dir/$project.current-tag" 2>/dev/null || true
}

# compose ARGS...: docker compose for this stack and env file, on the images of the current
# deploy (unless QC_IMAGE_TAG is already set), so a restart never builds from the checkout.
compose() {
  local tag="${QC_IMAGE_TAG:-$(current_tag)}"
  if [[ -n "$tag" ]]; then
    QC_IMAGE_TAG="$tag" docker compose -f "$QC_COMPOSE_FILE" --env-file "$QC_ENV_FILE" "$@"
  else
    docker compose -f "$QC_COMPOSE_FILE" --env-file "$QC_ENV_FILE" "$@"
  fi
}

# psql_in_db DB SQL: runs SQL inside the postgres container, prints unaligned rows. Stdin is
# closed so it can run inside a `while read` loop without eating the loop's input.
psql_in_db() {
  compose exec -T -e PGOPTIONS='-c client_min_messages=warning' postgres \
    psql -X -v ON_ERROR_STOP=1 -U qc -d "$1" -At -c "$2" </dev/null
}

# poster_volume: the name of this stack's poster-files volume (empty when it does not exist yet).
poster_volume() {
  local project
  project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
  docker volume ls -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter "label=com.docker.compose.volume=poster-files" | head -n 1
}

# pg_image: the image of the running postgres container (already on the host and pinned).
pg_image() {
  local cid
  cid="$(compose ps -q postgres)"
  [[ -n "$cid" ]] || die "postgres is not running"
  docker inspect --format '{{.Config.Image}}' "$cid"
}

# in_pg_image MOUNT USER ARGS...: runs ARGS (the first is the entrypoint) in a throwaway container
# from the postgres image, with MOUNT (docker -v syntax), as USER, with no network, a read-only
# root and no capabilities.
in_pg_image() {
  local mount="$1" user="$2" image
  shift 2
  image="$(pg_image)"
  docker run --rm -i --pull never --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user "$user" \
    -v "$mount" --entrypoint "$1" "$image" "${@:2}"
}

# in_poster_volume MODE ARGS...: runs ARGS in a throwaway container with the poster-files volume
# at /data (MODE ro or rw), as the files' owner (uid 1000, the `node` user that writes them), so it
# reads 0600 files without root. See in_pg_image.
in_poster_volume() {
  local mode="$1" volume
  shift
  volume="$(poster_volume)"
  [[ -n "$volume" ]] || die "the poster-files volume does not exist"
  in_pg_image "$volume:/data:$mode" 1000:1000 "$@"
}

# private_workdir NAME: creates a new directory only this user can open (mode 700) and prints its
# path. It goes under TMPDIR when that is set, else under QC_BACKUP_DIR; never /tmp by default,
# which is often small and shared. backup.sh removes ones older than a day that a killed run left
# behind under QC_BACKUP_DIR.
private_workdir() {
  local base dir
  base="${TMPDIR:-$(env_get QC_BACKUP_DIR /srv/qc/backups)}"
  mkdir -p "$base" || die "cannot create $base"
  dir="$(umask 077 && mktemp -d "$base/qc-$1.XXXXXX")" || die "cannot create a work directory in $base"
  chmod 700 "$dir"
  printf '%s' "$dir"
}

# QC_COUNT_SQL: the exact row count of every public table, one "table <name> <count>" line each.
# backup.sh writes these into the manifest next to each backup; restore.sh compares a restored
# database with them. Table names and counts only, never data.
# shellcheck disable=SC2034 # used by the scripts that source this file
QC_COUNT_SQL="SELECT format('table %s %s', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# alert MESSAGE: logs it and, when QC_ALERT_WEBHOOK_URL is set, posts {"text": MESSAGE}.
# The message must never contain personal data or secrets.
alert() {
  local message="$1" url project
  url="$(env_get QC_ALERT_WEBHOOK_URL)"
  project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
  log "ALERT: $message"
  if [[ -n "$url" ]]; then
    local payload
    payload="$(printf '{"text":"[%s@%s] %s"}' "$project" "$(hostname)" "${message//\"/\'}")"
    curl -fsS -m 15 -H 'content-type: application/json' -d "$payload" "$url" >/dev/null ||
      log "warning: could not deliver the alert to QC_ALERT_WEBHOOK_URL"
  fi
}

need() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
  done
}
