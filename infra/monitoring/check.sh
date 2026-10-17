#!/usr/bin/env bash
# On-server health check, run every 5 minutes from cron. Alerts on a change of state only (a new
# problem, or "recovered"), so a long outage does not send an alert every 5 minutes.
#
#   QC_ENV_FILE=/srv/qc/prod.env infra/monitoring/check.sh
#
# Checks:
#   public     https://<QC_DOMAIN>/api/health answers 200 through Caddy (TLS, proxy, api)
#   containers every long-running service is running and healthy (Docker health checks run the
#              api's /health and the worker's /healthz inside the stack)
#   disk       / and QC_BACKUP_DIR below QC_DISK_ALERT_PERCENT (default 85)
#   backup     QC_BACKUP_DIR/last-success is less than 26 hours old
#   restore    (only with QC_EXPECT_RESTORE_CHECK=1, i.e. on the host that runs restore tests)
#              the last restore test passed and is less than 8 days old
#   tls        the certificate for QC_DOMAIN is valid for at least 14 more days
#
# This cannot see the whole server going down. Pair it with an external uptime monitor on the
# same health URL (see infra/README.md).
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backup/lib.sh"

require_env_file
need docker curl

project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
domain="$(env_get QC_DOMAIN)"
health_url="$(env_get QC_HEALTH_URL "https://${domain}/api/health")"
backup_dir="$(env_get QC_BACKUP_DIR /srv/qc/backups)"
disk_limit="$(env_get QC_DISK_ALERT_PERCENT 85)"
state_dir="$(env_get QC_STATE_DIR /srv/qc/state)"
insecure="$(env_get QC_CHECK_INSECURE)"
mkdir -p "$state_dir"

problems=()

curl_opts=(-fsS -m 10 -o /dev/null)
[[ "$insecure" == "1" ]] && curl_opts+=(-k)
if ! curl "${curl_opts[@]}" "$health_url" 2>/dev/null; then
  problems+=("public health URL does not answer")
fi

for service in proxy api worker postgres; do
  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    problems+=("$service is not running")
    continue
  fi
  status="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
  [[ "$status" == "running healthy" ]] || problems+=("$service is $status")
done

for path in / "$backup_dir"; do
  [[ -d "$path" ]] || continue
  used="$(df -P "$path" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
  [[ "$used" -lt "$disk_limit" ]] || problems+=("disk at ${used}% on $path")
done

age_hours() {
  local file="$1" since
  since="$(date -u -d "$(cut -d' ' -f1 "$file")" +%s 2>/dev/null || echo 0)"
  echo $((($(date -u +%s) - since) / 3600))
}

if [[ -r "$backup_dir/last-success" ]]; then
  hours="$(age_hours "$backup_dir/last-success")"
  [[ "$hours" -lt 26 ]] || problems+=("last good backup is ${hours}h old")
else
  problems+=("no successful backup recorded")
fi

if [[ "$(env_get QC_EXPECT_RESTORE_CHECK)" == "1" ]]; then
  if [[ -r "$backup_dir/last-restore-check" ]]; then
    hours="$(age_hours "$backup_dir/last-restore-check")"
    grep -q ' passed: ' "$backup_dir/last-restore-check" || problems+=("last restore test failed")
    [[ "$hours" -lt 192 ]] || problems+=("last restore test is ${hours}h old")
  else
    problems+=("no restore test recorded")
  fi
fi

if [[ -n "$domain" && "$insecure" != "1" ]] && command -v openssl >/dev/null 2>&1; then
  if ! openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null |
    openssl x509 -noout -checkend $((14 * 86400)) >/dev/null 2>&1; then
    problems+=("TLS certificate expires within 14 days or cannot be read")
  fi
fi

state_file="$state_dir/$project.monitor-state"
previous="$(cat "$state_file" 2>/dev/null || echo ok)"
if [[ ${#problems[@]} -eq 0 ]]; then
  current="ok"
else
  current="$(printf '%s; ' "${problems[@]}")"
  current="${current%; }"
fi

if [[ "$current" != "$previous" ]]; then
  if [[ "$current" == "ok" ]]; then
    alert "recovered: all checks pass"
  else
    alert "problem: $current"
  fi
  printf '%s\n' "$current" >"$state_file"
fi

log "check: $current"
[[ "$current" == "ok" ]]
