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
