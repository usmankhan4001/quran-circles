# Deployment

How Quran Circles runs on servers. The full runbook, with every command, is [`infra/README.md`](../infra/README.md); every environment variable is in [`infra/ENV.md`](../infra/ENV.md). This page is the overview.

No secret ever goes into this repository. Passwords, tokens and keys are generated on the server or in the deployment tool and stay there.

## Environments

| Environment | Where                                                | State                                   |
| ----------- | ---------------------------------------------------- | --------------------------------------- |
| Development | Your machine ([Getting started](getting-started.md)) | Synthetic seed data, fake messaging     |
| Staging     | `staging.doraquran.pk`, deployed through Dokploy     | Running; synthetic data, fake messaging |
| Production  | One VPS with Docker Compose                          | Not deployed yet                        |

## The stack

The same Compose file, [`infra/docker-compose.prod.yml`](../infra/docker-compose.prod.yml), describes both servers:

| Service           | Role                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `proxy`           | Caddy: TLS, security headers, `/api` to the API, `/webhooks/whatsapp` to the worker, static PWA and console |
| `api`             | The API                                                                                                     |
| `worker`          | Background jobs and outgoing messages                                                                       |
| `poster-renderer` | Poster rendering, reachable only by the worker                                                              |
| `postgres`        | Postgres 16, on an internal network with no published port                                                  |
| `db-roles`        | One-shot: creates and converges the least-privilege database roles                                          |
| `migrate`         | One-shot: applies pending SQL migrations                                                                    |
| `pgboss-migrate`  | One-shot: installs or upgrades the pg-boss queue schema                                                     |

On `up`, Postgres becomes healthy, the one-shots run in order, then the API and worker start and must pass their health checks, then the proxy starts. Every long-running service has a health check, a read-only filesystem, no Linux capabilities and resource limits.

The images are built by [`infra/docker/Dockerfile`](../infra/docker/Dockerfile) (API and worker, bundled with esbuild) and [`infra/docker/poster-renderer.Dockerfile`](../infra/docker/poster-renderer.Dockerfile).

## Staging

Staging runs on a Dokploy server behind Traefik and a Cloudflare tunnel. It uses the production Compose file plus the override [`infra/docker-compose.staging.yml`](../infra/docker-compose.staging.yml), which:

- replaces the production `proxy` (ports 80 and 443, automatic TLS) with `web`, a plain-HTTP Caddy routed by Traefik labels, because Cloudflare and Traefik terminate TLS;
- bakes the PWA and console builds into the `web` image ([`infra/docker/proxy-staging.Dockerfile`](../infra/docker/proxy-staging.Dockerfile));
- adds an optional one-shot `seed` service behind the `seed` profile, for loading synthetic data once.

Dokploy deploys from a git clone of this repository. Environment values (database passwords, `AUTH_SECRET`, `RENDERER_TOKEN` and the rest) are entered in Dokploy, never committed. Staging runs with `APP_ENV=staging`, a fixed test sign-in code and `MESSAGING_MODE=fake`, so it sends no real WhatsApp, SMS or push messages. A new version goes out by pushing the change and starting a deploy of the staging app in Dokploy.

The current staging state, open issues and the record of each redeploy are in [`agents/status/platform.md`](agents/status/platform.md).

## Dokploy auto-deploy from `main`

Production on Dokploy pulls this repository's `main` branch from GitHub with auto-deploy on. **A push to `main` deploys to production**, whether or not CI has finished. Lane work stays on `lane/<lane>/<topic>` branches; merge to `main` only when it should go live, and protect `main` as listed in [`engineering/github-settings.md`](engineering/github-settings.md). Some of the text below predates this and still describes a manual deploy.

## Production

Production has not been deployed. The owner still has to provide the VPS, the domain names, backup storage and provider accounts; the checklist is in [`infra/README.md`](../infra/README.md#what-the-owner-must-provide). Once they exist, a human deploys with:

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh             # build, back up, migrate, start, health check
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh --rollback  # previous images
```

`deploy.sh` tags images with the commit, takes an encrypted backup before deploying, and rolls back by itself if a health check fails. Migrations are written to be backward compatible, so a rollback of the code does not need a rollback of the schema. There is no CI deploy job yet: in this phase deploys are run by a human.

## Backups and restore

- Nightly encrypted backups (`pg_dump` streamed into `age`) with daily and weekly retention, copied to a second, append-only location with rclone.
- A weekly automatic restore test, and `restore.sh --check` or `--replace` for a real restore.
- The private backup key never lives on production.

The procedure, recovery targets and the latest drill results are in [`infra/README.md`](../infra/README.md) and [`quality/restore-drill.md`](quality/restore-drill.md).

## Monitoring

[`infra/monitoring/check.sh`](../infra/monitoring/check.sh) runs every five minutes from cron and alerts a webhook on public health, container health, disk space, backup age, restore test result and TLS expiry. An external uptime monitor on `/api/health` covers the server itself going down.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs `pnpm install --frozen-lockfile`, typecheck, lint, tests and the format check on every push, with least-privilege permissions and actions pinned to commit SHAs. It does not deploy.
