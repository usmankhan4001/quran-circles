# syntax=docker/dockerfile:1.7
#
# Staging tools image: the @qc/db command-line tools (seed) and the @qc/load scope and load runners
# from source, for the one-shot `seed` and `gate5` services in infra/docker-compose.staging.yml.
# Never used in production; the seed refuses APP_ENV=production and the runners refuse remote hosts
# unless QC_ALLOW_REMOTE=staging.
#
# Base image: the same pinned digest as infra/docker/Dockerfile.

ARG NODE_IMAGE=node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34

# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS tools-staging

ARG PNPM_VERSION=10.28.0
RUN npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    CI=1
WORKDIR /repo
COPY . .

# @qc/db, @qc/load and the workspace packages they read, with dev dependencies (tsx runs the
# TypeScript CLIs). The load runner writes its reports under node_modules/.cache, owned by `node`.
RUN --mount=type=cache,id=qc-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter "@qc/db..." --filter "@qc/load..." \
 && mkdir -p tests/load/node_modules/.cache \
 && chown -R node:node tests/load/node_modules/.cache

USER node
ENV HOME=/tmp
WORKDIR /repo/packages/db
CMD ["node_modules/.bin/tsx", "src/cli/seed.ts"]
