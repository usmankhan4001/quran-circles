# syntax=docker/dockerfile:1.7
#
# Image for the poster renderer (WP16), target `poster-renderer`. Build from the repository root
# (the workspace root):
#
#   docker build -f infra/docker/poster-renderer.Dockerfile --target poster-renderer \
#     -t qc/poster-renderer:<tag> .
#
# Compose builds it as the `poster-renderer` service (infra/docker-compose.prod.yml). Moved here
# from apps/poster-renderer/Dockerfile (renderer lane) so the platform lane owns the pinned base.
#
# Follows infra/docker/Dockerfile: the build stage bundles the entry point with esbuild, the runtime
# image holds the bundle and runs as the unprivileged `node` user with no package manager state.
# Differences, because of the browser:
#
# - Debian slim, not Alpine: Playwright's Chromium build needs glibc.
# - playwright-core is not bundled (it reads its own files at run time); the copy installed from
#   the lockfile is placed in /app/node_modules.
# - Chromium's headless shell (the build Playwright 1.56.1 pins) and its system libraries are
#   installed at build time. Nothing is downloaded when the container runs.
#
# The base image is pinned by version and digest (the multi-platform index digest). To update:
# pull the new tag, read its digest with
# `docker image inspect --format '{{index .RepoDigests 0}}' node:<tag>`, then change NODE_IMAGE.

ARG NODE_IMAGE=node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94

# ---------------------------------------------------------------------------------------------
# Pinned by version and digest through NODE_IMAGE above.
# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS build

ARG PNPM_VERSION=10.28.0
ARG ESBUILD_VERSION=0.25.12

RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}" "esbuild@${ESBUILD_VERSION}"

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /repo
COPY . .

RUN --mount=type=secret,id=build_ca,required=false \
    --mount=type=cache,id=qc-pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@qc/poster-renderer..."

# The same bundling flags as infra/docker/bundle.sh, with playwright-core left external.
RUN esbuild apps/poster-renderer/src/main.ts \
      --bundle --platform=node --format=esm --target=node22 --sourcemap \
      --external:playwright-core \
      --banner:js="import { createRequire as __qcCreateRequire } from 'node:module'; const require = __qcCreateRequire(import.meta.url);" \
      --log-level=warning \
      --outfile=/out/dist/poster-renderer.mjs \
 && mkdir -p /out/node_modules \
 && cp -RL apps/poster-renderer/node_modules/playwright-core /out/node_modules/playwright-core

# Only the headless shell, not the full browser.
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && node /out/node_modules/playwright-core/cli.js install --only-shell chromium

# ---------------------------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS poster-renderer

LABEL org.opencontainers.image.title="qc-poster-renderer" \
      org.opencontainers.image.description="Quran Circles poster renderer (headless Chromium, internal only)"

ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=256" \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOME=/tmp
WORKDIR /app

COPY --from=build --chown=root:root /out/node_modules /app/node_modules
# The system libraries Chromium needs (the list Playwright keeps for this version).
RUN node /app/node_modules/playwright-core/cli.js install-deps chromium-headless-shell \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=root:root /ms-playwright /ms-playwright
COPY --from=build --chown=root:root /out/dist /app/dist
# Fonts and their licences; dist/../assets/fonts is where the bundle looks.
COPY --chown=root:root apps/poster-renderer/assets /app/assets

# Nothing in /app is writable by the process; Chromium writes only to /tmp (a tmpfs in compose).
USER node
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.RENDERER_PORT||8090)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/poster-renderer.mjs"]
