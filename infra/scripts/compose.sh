#!/usr/bin/env bash
# `docker compose` for one stack, on the images of the current deploy. Use it for every manual
# command so nothing is ever built from the checkout by accident:
#
#   QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh ps
#   QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh logs -f api worker
#   QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh up -d
set -euo pipefail

# shellcheck source=infra/backup/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backup/lib.sh"

require_env_file
compose "$@"
