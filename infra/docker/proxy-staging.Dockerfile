# syntax=docker/dockerfile:1.7
#
# Proxy image for the Dokploy stacks: Caddy with the PWA, console and coordinator static builds baked in.
# Staging (infra/docker-compose.staging.yml) uses the defaults; production on Dokploy
# (infra/docker-compose.dokploy-prod.yml) passes CADDYFILE=infra/caddy/Caddyfile.dokploy-prod and
# the public web keys. The plain-VPS production setup keeps host-mounted builds.
#
#   docker build -f infra/docker/proxy-staging.Dockerfile --target proxy-staging \
#     --build-arg PUBLIC_API_URL=https://staging.example.invalid/api -t qc-staging/proxy:<tag> .
#
# Base images are the same pinned digests as infra/docker/Dockerfile and the prod compose file.

ARG NODE_IMAGE=node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34
ARG CADDY_IMAGE=caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d

# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS build

ARG PNPM_VERSION=10.28.0
# The PWA calls the api at this absolute URL (EXPO_PUBLIC_API_URL); the console uses /api on its
# own origin.
ARG PUBLIC_API_URL
# The coordinator web app (admin-app) calls the api at this absolute URL on its own host. Unset
# falls back to PUBLIC_API_URL (staging has no separate coordinator host).
ARG COORDINATOR_API_URL=""
# Public, restricted keys baked into the PWA (never secrets; see apps/user-app/src/platform/env.ts).
# Empty: the keyless map and no web push.
ARG GOOGLE_MAPS_WEB_KEY=""
ARG VAPID_PUBLIC_KEY=""
# Shown on the public privacy, help and delete-account pages. Unset uses the built-in default address.
ARG CONTACT_EMAIL=""

RUN npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    EXPO_NO_TELEMETRY=1 \
    CI=1
WORKDIR /repo
COPY . .

# Install scripts are skipped (no native builds are needed for the web exports, and this keeps
# Playwright from downloading browsers).
RUN --mount=type=cache,id=qc-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

RUN test -n "${PUBLIC_API_URL}" \
 && EXPO_PUBLIC_API_URL="${PUBLIC_API_URL}" \
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_WEB_KEY}" \
    EXPO_PUBLIC_VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY}" \
    EXPO_PUBLIC_CONTACT_EMAIL="${CONTACT_EMAIL}" \
    pnpm --filter @qc/user-app export:web \
 && VITE_API_BASE_URL=/api pnpm --filter @qc/console build

# ---------------------------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM ${CADDY_IMAGE} AS proxy-staging

ARG CADDYFILE=infra/caddy/Caddyfile.staging
COPY ${CADDYFILE} /etc/caddy/Caddyfile
COPY --from=build /repo/apps/user-app/dist /srv/www/app
COPY --from=build /repo/apps/console/dist /srv/www/console
COPY --from=build /repo/apps/admin-app/dist /srv/www/coordinator
