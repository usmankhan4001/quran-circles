# Status: platform

Updated: 2026-10-17
Lane: platform (WP10, Wave 2). No commits, no pull requests, no GitHub Actions (owner rule for this phase).

## Done (WP10, everything that needs no VPS)

- `infra/docker-compose.prod.yml`: `proxy` (Caddy), `api`, `worker`, one-shot `migrate`, `postgres`. Health checks on every long-running service, `restart: unless-stopped`, CPU and memory limits (overridable), read-only root filesystems, `cap_drop: ALL`, `no-new-privileges`, Docker log rotation. Postgres is only on an internal network and publishes no port. Messaging variables are passed by name per service (change request `messaging-env-vars`), including `OCCURRENCE_HORIZON_DAYS` for the worker.
- `infra/docker/Dockerfile` (targets `api`, `worker`) and `infra/docker/bundle.sh`: esbuild bundles of the api, the worker and the migrate and rollback runners; Node 22.22.0 Alpine pinned by digest; runs as `node`; no `node_modules` in the runtime image. hadolint clean.
- `infra/caddy/Caddyfile`: automatic TLS for `QC_DOMAIN` and `QC_CONSOLE_DOMAIN`, `/api/*` to the api with the prefix stripped, `/webhooks/whatsapp` to the worker, static PWA and console with SPA fallback, security headers, no access log (the webhook verify token travels in the query string). `Caddyfile.example` removed.
- `infra/.env.example` (fake placeholders) and `infra/ENV.md` (every name, reader, required or not). Root `.env.example` gained the API names, `OCCURRENCE_HORIZON_DAYS` and a pointer.
- Backups: `infra/backup/backup.sh` (pg_dump in the container streamed into `age`, retention, weekly copies, rclone to a second location, alert on failure), `restore.sh` (`--check` into a scratch database, `--replace` with a safety backup and confirmation), `restore-test.sh` (weekly, reports passed or failed).
- Deploys: `infra/scripts/deploy.sh` (tag by SHA, pre-deploy backup, migrate, health, automatic rollback, `--rollback`), `infra/scripts/compose.sh` (manual commands on the current deploy's images).
- Monitoring: `infra/monitoring/check.sh` (public health, container health, disk, backup age, restore test, TLS expiry; alerts on change of state), `logrotate.conf`, `infra/cron/qc.crontab`.
- `infra/README.md`: owner checklist, first deploy, deploy, roll back, backups, restore, monitoring, key rotation, staging, local rehearsal. It serves as the runbook for now (brief item 8, `RUNBOOK.md`).

## Verified locally (Docker daemon in the agent sandbox, `localhost` with Caddy's local CA)

- Both images build; the whole stack comes up from empty volumes with every health check green (`deploy.sh`, about 18 s).
- Through Caddy: `/api/health` and `/api/v1/config` 200; webhook handshake echoes the challenge with the right token, 403 with a wrong one, 401 for an unsigned POST; SPA fallback for PWA and console; console `/api` works; HTTP redirects to HTTPS; worker `/healthz` is not exposed.
- Postgres has no host port and is only on the internal network; containers run as uid 1000 with a read-only filesystem.
- Backup and restore cycle with synthetic rows: encrypted backup, `--check` restore (row counts match), `--replace` after deleting rows (rows back, stack healthy again, 16 s), weekly `restore-test.sh`. Failure paths: wrong age key, corrupted file (checksum), missing recipient (refuses to write unencrypted and alerts). Alert webhook delivery tested against a local receiver.
- Deploy v1 then v2, a deliberately broken deploy (automatic rollback to v2 plus alert), then `--rollback` to v1. Migration rollback command (`dist/rollback.mjs --steps 1`) and re-apply.
- `check.sh`: ok, then a stopped worker raises one alert, no repeat, then "recovered".
- shellcheck 0.11 clean on all scripts; hadolint 2.12 clean; `caddy validate` and `caddy fmt` clean; `docker compose ... --env-file infra/.env.example config -q` passes.

## Repository split (2026-10-17)

- V2 now lives in its own repository, `usmankhan4001/quran-circles`, with `v2/` as the root. History was kept with `git subtree split --prefix=v2` from `nearby-dora-quran` branch `claude/peaceful-archimedes-ain95k` at `451b98f` (65 commits).
- Path prefixes fixed for the new root in docs, lane `CLAUDE.md` files, briefs, infra comments, the cron file (`/srv/qc/app/infra/...`) and the deploy steps in `infra/README.md` (`cd /srv/qc/app`).
- `.github/` moved over and adapted: `workflows/ci.yml` (was `v2-ci.yml`, no path filter or working directory), `pull_request_template.md` (was `PULL_REQUEST_TEMPLATE/v2.md`), `CODEOWNERS` without the `/v2` prefix.
- `nearby-dora-quran` is unchanged; its `v2/` folder is no longer where work happens.

## Blocked (needs the owner)

- VPS, SSH access, domain and DNS, ACME e-mail, second backup location (rclone remote), the backup age key pair, alert webhook and the named on-call human, external uptime monitor, provider credentials. Full list in `infra/README.md`, "What the owner must provide".
- Gate 2 "restore works on staging" and the timed restore drill: blocked on the staging server. Only rehearsed locally.
- TLS with a real certificate, Meta webhook registration, alert test to a real human: need the domain and server.

## Not done (by rule or pending other lanes)

- CI deploy workflow (brief item 5): no GitHub Actions in this phase; a human runs `deploy.sh`.
- GlitchTip error tracking: needs an error-reporting hook in the api and worker first.
- Staging on the same VPS needs a shared proxy (both stacks want 80/443); a second small VPS needs no change.

## Questions for the orchestrator

- The brief lists `docker compose -f infra/docker-compose.prod.yml config` without an env file. The compose file requires its variables (`${VAR:?}`) so a server can never start half-configured, so the check is run as `... --env-file infra/.env.example config -q`. Accept, or should the file carry defaults instead?
- Staging: a second small VPS, or the same VPS with a shared proxy?
