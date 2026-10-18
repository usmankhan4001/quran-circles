#!/bin/sh
# Bundles the api, the worker, the migration runners and the pg-boss CLI into single ESM files
# with esbuild.
# Workspace packages export TypeScript source, so plain `tsc` output would not run on its own.
#
# Usage (from the repository root, after `pnpm install`):  infra/docker/bundle.sh <out-dir>
# Result:
#   <out-dir>/dist/api.mjs       the API server       (apps/api/src/index.ts)
#   <out-dir>/dist/worker.mjs    the worker           (apps/worker/src/main.ts)
#   <out-dir>/dist/migrate.mjs   the migration runner (packages/db/src/cli/migrate.ts)
#   <out-dir>/dist/rollback.mjs  undoes migrations    (packages/db/src/cli/rollback.ts)
#   <out-dir>/dist/pgboss.mjs    pg-boss's own CLI    (installs and upgrades pg-boss's schema;
#                                the worker's pinned pg-boss version)
#   <out-dir>/migrations/        the SQL files; the runner reads ../migrations next to dist/
#
# POSIX sh, so it also runs in the Alpine build stage. ESBUILD names the esbuild binary (default: `esbuild` on PATH). The Dockerfile pins its version.
set -eu

out="${1:?usage: bundle.sh <out-dir>}"
esbuild="${ESBUILD:-esbuild}"
root="$(cd "$(dirname "$0")/../.." && pwd)"

mkdir -p "$out/dist"

# CommonJS dependencies (pg, web-push) call require() on Node built-ins. An ESM bundle has no
# require, so give it one.
banner="import { createRequire as __qcCreateRequire } from 'node:module'; const require = __qcCreateRequire(import.meta.url);"

bundle() {
  "$esbuild" "$root/$1" \
    --bundle \
    --platform=node \
    --format=esm \
    --target=node22 \
    --sourcemap \
    --external:pg-native \
    --banner:js="$banner" \
    --log-level=warning \
    --outfile="$out/dist/$2.mjs"
}

bundle apps/api/src/index.ts api
bundle apps/worker/src/main.ts worker
bundle packages/db/src/cli/migrate.ts migrate
bundle packages/db/src/cli/rollback.ts rollback
# Resolved through the worker's dependency, so the CLI is the same pg-boss version the worker runs.
bundle apps/worker/node_modules/pg-boss/dist/cli.js pgboss

rm -rf "$out/migrations"
cp -R "$root/packages/db/migrations" "$out/migrations"

echo "bundled api, worker, migrate, rollback and pgboss into $out"
