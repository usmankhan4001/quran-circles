# syntax=docker/dockerfile:1.7
#
# Images for the api and the worker. Build from the repository root (the workspace root):
#
#   docker build -f infra/docker/Dockerfile --target api    -t qc/api:<tag>    .
#   docker build -f infra/docker/Dockerfile --target worker -t qc/worker:<tag> .
#
# Workspace packages export TypeScript source, so the build stage bundles each entry point with
# esbuild into one file. The runtime images hold only those bundles (the api image also carries
# the migration runners, dist/migrate.mjs and dist/rollback.mjs, and the SQL files), run as the
# unprivileged `node` user and have no package manager state.
#
# The base image is pinned by version and digest. To update: pull the new tag, read its digest
# with `docker image inspect --format '{{index .RepoDigests 0}}' node:<tag>`, then change the
# NODE_IMAGE line.

ARG NODE_IMAGE=node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34

# ---------------------------------------------------------------------------------------------
# Pinned by version and digest through NODE_IMAGE above.
# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS build

# Exact tool versions. pnpm matches `packageManager` in package.json.
ARG PNPM_VERSION=10.28.0
ARG ESBUILD_VERSION=0.25.12

# Optional: a CA bundle for builds behind a TLS-intercepting proxy, passed with
# `--secret id=build_ca,src=<file>`. Ordinary builds do not need it.
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}" "esbuild@${ESBUILD_VERSION}"

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /repo
COPY . .

# Only the runtime dependencies of the three entry points and their workspace packages. Install
# scripts are skipped: nothing bundled needs a native build, and esbuild comes from the global
# install above.
RUN --mount=type=secret,id=build_ca,required=false \
    --mount=type=cache,id=qc-pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && pnpm install --frozen-lockfile --prod --ignore-scripts \
      --filter "@qc/api..." --filter "@qc/worker..." --filter "@qc/db..."

RUN ESBUILD=esbuild infra/docker/bundle.sh /out

# ---------------------------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
# Mount point of the shared poster-files volume (POSTER_STORAGE_DIR in compose). It exists in the
# image, owned by `node`, so Docker gives a new empty volume that owner and the process can write.
RUN mkdir -p /var/lib/qc/posters && chown node:node /var/lib/qc/posters
# Nothing in /app is writable by the process.
USER node

# ---------------------------------------------------------------------------------------------
FROM runtime AS api

LABEL org.opencontainers.image.title="qc-api" \
      org.opencontainers.image.description="Quran Circles API (Hono)"
COPY --from=build --chown=root:root /out/dist/api.mjs /out/dist/api.mjs.map /app/dist/
COPY --from=build --chown=root:root /out/dist/migrate.mjs /out/dist/migrate.mjs.map /app/dist/
COPY --from=build --chown=root:root /out/dist/rollback.mjs /out/dist/rollback.mjs.map /app/dist/
COPY --from=build --chown=root:root /out/migrations /app/migrations

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/api.mjs"]

# ---------------------------------------------------------------------------------------------
FROM runtime AS worker

LABEL org.opencontainers.image.title="qc-worker" \
      org.opencontainers.image.description="Quran Circles worker (outbox, reminders, WhatsApp webhook)"
COPY --from=build --chown=root:root /out/dist/worker.mjs /out/dist/worker.mjs.map /app/dist/

EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WORKER_HTTP_PORT||8081)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/worker.mjs"]
