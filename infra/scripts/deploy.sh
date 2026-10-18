#!/usr/bin/env bash
# Deploys the checked-out commit, or rolls back to the previous deploy.
#
#   QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh             # deploy HEAD
#   QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh --rollback  # previous images
#
# Deploy:
#   1. Tag = QC_DEPLOY_TAG, else the short git SHA of HEAD.
#   2. Images <QC_IMAGE_REGISTRY>/api:<tag>, /worker:<tag> and /poster-renderer:<tag>: reused if
#      present, pulled when QC_DEPLOY_PULL=1, otherwise built here from the checkout.
#   3. Encrypted pre-deploy backup (infra/backup/backup.sh pre-deploy).
#   4. `compose up -d --wait`: db-roles brings the database roles and grants up to date, migrate
#      applies pending migrations and pgboss-migrate pg-boss's, then the api, the worker and the
#      poster renderer restart on the new images and must report healthy.
#   5. The public health URL (https://<QC_DOMAIN>/api/health) must answer.
#   On failure in 4 or 5 the previous images are started again and an alert is raised. Database
#   migrations are NOT reverted automatically; see "Roll back" in infra/README.md.
#
# The current and previous tags are kept in QC_STATE_DIR (default /srv/qc/state).
#
# --rollback needs all three images of the previous tag. The first deploy that adds the poster
# renderer has no renderer image for the tag before it: roll back from that one by checking out
# the previous commit and running deploy.sh.
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backup/lib.sh"

require_env_file
need docker curl

project="$(env_get COMPOSE_PROJECT_NAME qc-prod)"
state_dir="$(env_get QC_STATE_DIR /srv/qc/state)"
registry="$(env_get QC_IMAGE_REGISTRY qc)"
domain="$(env_get QC_DOMAIN)"
health_url="$(env_get QC_HEALTH_URL "https://${domain}/api/health")"
mkdir -p "$state_dir"
current_file="$state_dir/$project.current-tag"
previous_file="$state_dir/$project.previous-tag"
current_tag="$(cat "$current_file" 2>/dev/null || true)"
previous_tag="$(cat "$previous_file" 2>/dev/null || true)"

# images_of TAG: the image names deploy.sh builds or pulls for TAG.
images_of() {
  printf '%s\n' "$registry/api:$1" "$registry/worker:$1" "$registry/poster-renderer:$1"
}

# up_with TAG: starts the stack on TAG and waits for every health check.
up_with() {
  QC_IMAGE_TAG="$1" compose up -d --wait --wait-timeout 240
}

public_health() {
  local curl_opts=(-fsS -m 10 -o /dev/null)
  # Local rehearsals against Caddy's internal CA only. Never set on a real server.
  [[ "$(env_get QC_CHECK_INSECURE)" == "1" ]] && curl_opts+=(-k)
  for _ in 1 2 3 4 5 6; do
    if curl "${curl_opts[@]}" "$health_url"; then return 0; fi
    sleep 5
  done
  return 1
}

if [[ "${1-}" == "--rollback" ]]; then
  [[ -n "$previous_tag" ]] || die "no previous deploy recorded in $previous_file"
  # Without the images, `up` would build them from whatever is checked out now: refuse instead.
  mapfile -t previous_images < <(images_of "$previous_tag")
  docker image inspect "${previous_images[@]}" >/dev/null 2>&1 ||
    die "images for $previous_tag are gone; check out that commit and run deploy.sh instead"
  log "rollback: $project from ${current_tag:-unknown} to $previous_tag"
  up_with "$previous_tag"
  public_health || die "rollback is up but $health_url does not answer"
  printf '%s\n' "$previous_tag" >"$current_file"
  printf '%s\n' "$current_tag" >"$previous_file"
  alert "rolled back to $previous_tag"
  exit 0
fi
[[ $# -eq 0 ]] || die "usage: deploy.sh [--rollback]"

repo_root="$(cd "$QC_INFRA_DIR/.." && pwd)"
tag="$(env_get QC_DEPLOY_TAG)"
if [[ -z "$tag" ]]; then
  tag="$(git -C "$repo_root" rev-parse --short=12 HEAD)"
  if [[ -n "$(git -C "$repo_root" status --porcelain --untracked-files=no)" ]]; then
    die "the checkout has uncommitted changes; deploy a clean commit"
  fi
fi
[[ "$tag" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] || die "invalid tag $tag"
[[ "$tag" != "$current_tag" ]] || log "deploy: $tag is already current; redeploying"

log "deploy: $project tag $tag (current ${current_tag:-none})"

mapfile -t images < <(images_of "$tag")
if docker image inspect "${images[@]}" >/dev/null 2>&1; then
  log "deploy: images for $tag already present"
elif [[ "$(env_get QC_DEPLOY_PULL)" == "1" ]]; then
  QC_IMAGE_TAG="$tag" compose pull api worker migrate poster-renderer
else
  log "deploy: building images for $tag"
  QC_IMAGE_TAG="$tag" compose build api worker poster-renderer
fi

if [[ "$(env_get QC_DEPLOY_SKIP_BACKUP)" == "1" ]]; then
  log "deploy: pre-deploy backup skipped (QC_DEPLOY_SKIP_BACKUP=1)"
elif compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  "$QC_INFRA_DIR/backup/backup.sh" pre-deploy
else
  log "deploy: postgres not running yet (first deploy), no pre-deploy backup"
fi

started=$SECONDS
if up_with "$tag" && public_health; then
  [[ -n "$current_tag" && "$current_tag" != "$tag" ]] && printf '%s\n' "$current_tag" >"$previous_file"
  printf '%s\n' "$tag" >"$current_file"
  log "deploy: $tag healthy in $((SECONDS - started))s"
  exit 0
fi

log "deploy: $tag failed its health checks"
compose ps -a >&2 || true
if [[ -n "$current_tag" ]]; then
  log "deploy: starting the previous images ($current_tag) again"
  if up_with "$current_tag" && public_health; then
    alert "deploy of $tag FAILED; rolled back to $current_tag. Migrations from $tag stay applied."
  else
    alert "deploy of $tag FAILED and the rollback to $current_tag is NOT healthy. Act now."
  fi
else
  alert "first deploy of $tag FAILED; nothing to roll back to."
fi
exit 1
