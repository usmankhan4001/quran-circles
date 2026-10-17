# Infrastructure

The production stack (WP10): Caddy, the api, the worker and Postgres in Docker Compose on one VPS, with encrypted nightly backups, a scripted restore, health checks and alerts. Nothing has been deployed yet: the VPS and the domain are still to come. Everything below is ready for a human to run once they are.

| Path                      | What it is                                                                     |
| ------------------------- | ------------------------------------------------------------------------------ |
| `docker-compose.prod.yml` | Production and staging stack: `proxy`, `api`, `worker`, `migrate`, `postgres`  |
| `docker/Dockerfile`       | api and worker images (targets `api`, `worker`), bundled with esbuild          |
| `docker/bundle.sh`        | The esbuild step, also runnable outside Docker                                 |
| `caddy/Caddyfile`         | TLS, `/api` to the api, `/webhooks/whatsapp` to the worker, static PWA/console |
| `.env.example`            | Template for the server's env file, fake values only                           |
| `ENV.md`                  | Every variable name, who reads it, whether it is required                      |
| `backup/`                 | `backup.sh`, `restore.sh`, `restore-test.sh`                                   |
| `monitoring/`             | `check.sh` (health, disk, backup age, TLS), `logrotate.conf`                   |
| `scripts/deploy.sh`       | Deploy with automatic rollback, and `--rollback`                               |
| `scripts/compose.sh`      | `docker compose` on the current deploy's images; use it for manual commands    |
| `cron/qc.crontab`         | Nightly backup, 5-minute checks, weekly restore test, image prune              |
| `docker-compose.dev.yml`  | Local development database only                                                |

## Local development

```sh
docker compose -f infra/docker-compose.dev.yml up -d
cp .env.example .env
```

Postgres then listens on `localhost:5432` with the development-only credentials in `.env.example`.

## What the owner must provide

Agents never receive production credentials. Nothing below goes into the repository.

- [ ] **VPS**: provider, region, CPU, memory, disk recorded in `docs/engineering/decisions/` (no secrets). Suggested minimum: 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04 LTS.
- [ ] **Server access** for the human who deploys: a non-root sudo user with SSH key login.
- [ ] **Domain**: the public name (`QC_DOMAIN`) and the console name (`QC_CONSOLE_DOMAIN`), both with DNS A/AAAA records pointing at the VPS. Plus a staging pair (for example `staging.` and `console.staging.`).
- [ ] **ACME contact address** (`ACME_EMAIL`) for Let's Encrypt.
- [ ] **Second backup location**: an object store or another provider, with an rclone remote configured on the server (`QC_BACKUP_RCLONE_REMOTE`).
- [ ] **Backup key pair**: run `age-keygen -o backup-restore.agekey` on the owner's own machine. The public key (`age1...`) goes into `QC_BACKUP_AGE_RECIPIENT` on production. The private key stays offline with the owner and on the staging host only (`QC_BACKUP_AGE_IDENTITY`), never on production.
- [ ] **Alert destination**: a webhook URL that accepts `{"text": "..."}` (for example an ntfy topic or a Slack incoming webhook) and the named human who receives it (`QC_ALERT_WEBHOOK_URL`).
- [ ] **External uptime monitor** (any hosted checker) on `https://<QC_DOMAIN>/api/health`, alerting the same human. The on-server check cannot report the server itself going down.
- [ ] **Secrets**, generated on the server: `POSTGRES_PASSWORD` (`openssl rand -hex 32`), `AUTH_SECRET` (`openssl rand -base64 48`), `WHATSAPP_VERIFY_TOKEN` (`openssl rand -hex 24`).
- [ ] **Provider credentials** from the owner's accounts: WhatsApp Cloud API phone number ID, system-user access token and app secret (after Meta Business verification); FCM service account; APNs key, key ID, team ID, bundle ID; VAPID key pair (`npx web-push generate-vapid-keys`); later an SMS gateway.
- [ ] **Staging placement**: a second small VPS (recommended; identical shape), or the same VPS with a shared proxy (needs a small change to this setup, because both stacks would want ports 80 and 443).

### VPS baseline (human tasks)

- [ ] Operating system updated and a non-root sudo user created
- [ ] SSH key login only; password login and root login disabled
- [ ] Firewall allows only 22, 80 and 443 (TCP), and 443/UDP for HTTP/3
- [ ] Automatic security updates enabled
- [ ] Docker Engine and the Compose plugin installed (Compose 2.24 or newer)
- [ ] `age`, `rclone`, `curl`, `openssl` and `git` installed (`sudo apt install age rclone curl openssl git`)
- [ ] Time zone set to UTC
- [ ] Domain name and app ID decided and written to `docs/engineering/decisions/`
- [ ] Meta Business verification started and the legal owner named
- [ ] Apple Developer, Google Play and Expo accounts confirmed, with the app ID reserved

## First deploy on a clean server

All commands run on the server as the deploy user, with `sudo` where shown. Paths assume the checkout lives in `/srv/qc/app` (the scripts work from any path; only `cron/qc.crontab` hard-codes it).

```sh
# 1. Directories and the checkout
sudo mkdir -p /srv/qc/{app,www/app,www/console,backups,state} /var/log/qc
sudo chown -R "$USER" /srv/qc
git clone <repository URL> /srv/qc/app
cd /srv/qc/app

# 2. The env file (stays on the server, mode 600)
install -m 600 infra/.env.example /srv/qc/prod.env
"${EDITOR:-nano}" /srv/qc/prod.env     # replace every placeholder; see infra/ENV.md
docker compose -f infra/docker-compose.prod.yml --env-file /srv/qc/prod.env config >/dev/null && echo "config ok"

# 3. Static builds of the PWA and the console (on a machine with pnpm, then copy over)
#    PWA:     EXPO_PUBLIC_API_URL=https://<QC_DOMAIN>/api pnpm --filter @qc/user-app export:web
#    Console: VITE_API_BASE_URL=/api pnpm --filter @qc/console build
#    Copy apps/user-app/dist/* to /srv/qc/www/app/ and apps/console/dist/* to /srv/qc/www/console/

# 4. Build, migrate and start; waits until every health check passes
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh

# 5. Check from outside
curl -fsS https://<QC_DOMAIN>/api/health          # {"ok":true,"service":"api"}

# 6. Cron jobs and log rotation
sudo install -m 644 infra/cron/qc.crontab /etc/cron.d/qc
sudo install -m 644 infra/monitoring/logrotate.conf /etc/logrotate.d/qc

# 7. First backup now, then confirm the copy reached the second location
QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh
rclone ls "$(grep ^QC_BACKUP_RCLONE_REMOTE= /srv/qc/prod.env | cut -d= -f2)/daily"
```

Then create the first national admin. `pnpm --filter @qc/db bootstrap-admin --phone <E.164> --yes` creates a pending national-admin invite for that number and prints only the invite id; the person then signs in with a code and accepts it as usual (see `packages/db/README.md`). It needs `DATABASE_URL` pointing at the production database, which publishes no port, so for now run it from a Node 22 container attached to the stack's internal network with the checkout mounted. Open item for the platform lane: bundle a `bootstrap-admin` runner into the `migrate` image so this becomes one `infra/scripts/compose.sh run` command.

Then, in Meta's WhatsApp dashboard, set the callback URL to `https://<QC_DOMAIN>/webhooks/whatsapp` and the verify token to the value of `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.

What `up` does: `postgres` starts and becomes healthy, `migrate` applies pending SQL migrations and exits, then `api` and `worker` start and must pass their health checks, then `proxy` (Caddy) starts and obtains certificates. Postgres publishes no port and sits on an internal network; only Caddy listens on the host.

## Deploy

```sh
cd /srv/qc/app
git fetch && git checkout <commit or branch>      # a clean checkout
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh
```

`deploy.sh` tags the images with the commit SHA, builds them (or reuses or pulls them), takes an encrypted `pre-deploy` backup, runs `up --wait` (migrations first), and checks `https://<QC_DOMAIN>/api/health`. If anything fails it starts the previous images again and sends an alert. The current and previous tags are in `/srv/qc/state/`. For any manual `docker compose` command use `infra/scripts/compose.sh`, which runs on the current deploy's images (plain `docker compose` would fall back to building from the checkout).

Static builds deploy by replacing the files in `/srv/qc/www/app` or `/srv/qc/www/console`; no restart is needed.

Until a CI deploy job is allowed (owner rule: no GitHub Actions in this phase), a human runs `deploy.sh` on the server.

## Roll back

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/deploy.sh --rollback
```

This starts the previous images. It does **not** undo database migrations. Migrations are written to be backward compatible, so the previous code normally runs on the newer schema. If a migration itself must be undone (rare, decide first):

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh run --rm migrate node dist/rollback.mjs --steps 1
```

If the data is damaged, restore the `pre-deploy` backup instead (below).

## Backups

`backup.sh` runs nightly at 02:30 UTC from cron, and before every deploy.

- `pg_dump` (custom format) runs inside the postgres container and streams straight into `age`, encrypted to `QC_BACKUP_AGE_RECIPIENT`. No unencrypted dump touches the disk, and the production server cannot decrypt its own backups.
- Files: `/srv/qc/backups/daily/<project>-<UTC time>.dump.age` with a `.sha256`; Sunday copies in `weekly/`; labelled runs (`pre-deploy`, `pre-restore`) in `manual/`.
- Retention: daily and labelled 14 days, weekly 8 weeks (`QC_BACKUP_RETENTION_DAYS`, `QC_BACKUP_WEEKLY_RETENTION_WEEKS`). The same retention is applied to the second location.
- Second location: each new file is copied with rclone to `QC_BACKUP_RCLONE_REMOTE`.
- A failure exits non-zero and sends an alert. `monitoring/check.sh` also alerts when the last good backup is more than 26 hours old.

Manual backup: `QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh manual-note` (label: a-z, 0-9, `-`).

## Restore

You need the age private key file. On production it is not present: copy it in for the restore and delete it afterwards (`shred -u`).

**Check a backup without touching anything** (restores into a scratch database `qc_restore_check`, verifies the schema, prints row counts, drops it):

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/backup/restore.sh \
  --check /srv/qc/backups/daily/<file>.dump.age --identity /path/to/backup-restore.agekey
```

**Replace the live database** (stops the api and worker, takes a `pre-restore` backup of the current database, recreates `qc`, restores, starts the stack, runs newer migrations, waits for health):

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/backup/restore.sh \
  --replace /srv/qc/backups/daily/<file>.dump.age --identity /path/to/backup-restore.agekey
# asks you to type the project name (qc-prod) to confirm; --yes skips the question
```

From the second location: `rclone copy "<remote>/daily/<file>.dump.age" /srv/qc/backups/daily/` (and the `.sha256`), then restore as above. Both commands print the time taken: record it in the drill log.

**Weekly restore test** (staging host, Mondays 04:00 UTC from cron): `restore-test.sh --remote` fetches the newest production backup from the second location, runs `restore.sh --check` against the staging Postgres, writes `last-restore-check` and sends a "passed" or "FAILED" message. Silence on a Monday means it did not run. Set `QC_EXPECT_RESTORE_CHECK=1` on that host so `check.sh` alerts on a missing or failed test.

## Monitoring

- **Health endpoints**: the api serves `GET /health` (public as `https://<QC_DOMAIN>/api/health`); the worker serves `GET /healthz` inside the stack only. Docker health checks call both every 15 s; `restart: unless-stopped` restarts a crashed process.
- **check.sh** (every 5 minutes): public health URL, every container running and healthy, disk below 85 %, last backup under 26 h, TLS certificate valid for 14 more days, and on the restore host the weekly test. It alerts on a change of state only ("problem: ..." and "recovered").
- **Logs**: the api and worker write structured JSON with personal data redacted. Docker rotates container logs (5 files of 10 MB each). Cron job logs in `/var/log/qc` are rotated weekly by `logrotate.conf`. Caddy writes no access log, because request URIs can carry the webhook verify token. Read logs with `QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh logs -f api worker`.
- **Not yet in place**: self-hosted error tracking (GlitchTip). It needs an error-reporting hook in the api and worker (their lanes) and its own Postgres and Redis; it will be added as a separate compose file once that hook exists.

## Rotate keys

Edit the value in `/srv/qc/prod.env`, then `QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh up -d` (only the containers whose environment changed are recreated).

- `AUTH_SECRET`: everyone is signed out and signs in again.
- `POSTGRES_PASSWORD`: change it in the database first: `infra/scripts/compose.sh exec postgres psql -U qc -d qc -c "ALTER ROLE qc PASSWORD '<new>'"`, then in the env file, then `up -d`.
- WhatsApp, FCM, APNs, VAPID and SMS credentials: create the new credential in the provider's console, update the env file, `up -d`, then revoke the old one. A new VAPID key pair invalidates existing web push subscriptions.
- Backup key: create a new age key pair, update `QC_BACKUP_AGE_RECIPIENT`. Keep the old private key until every backup made with it has aged out.

## Staging

Same compose file, same scripts, own env file and project name:

```sh
install -m 600 infra/.env.example /srv/qc/staging.env   # COMPOSE_PROJECT_NAME=qc-staging, APP_ENV=staging,
                                                        # staging domains, staging credentials
QC_ENV_FILE=/srv/qc/staging.env infra/scripts/deploy.sh
```

Staging holds anonymised data only. Messaging can run with `MESSAGING_MODE=fake` and `AUTH_FIXED_CODE` set; production refuses both.

## Local rehearsal of the production stack

With Docker on a workstation, the whole stack runs against `localhost` (Caddy issues certificates from its own local CA):

```sh
cp infra/.env.example /tmp/qc-local.env   # then set: COMPOSE_PROJECT_NAME=qc-local, QC_DOMAIN=localhost,
                                          # QC_CONSOLE_DOMAIN=console.localhost, APP_ENV=staging,
                                          # MESSAGING_MODE=fake, AUTH_FIXED_CODE=123456,
                                          # QC_WWW_DIR, QC_BACKUP_DIR, QC_STATE_DIR to local paths,
                                          # QC_CHECK_INSECURE=1, real age key pair for the test
QC_ENV_FILE=/tmp/qc-local.env QC_DEPLOY_TAG=local infra/scripts/deploy.sh
curl -k https://localhost/api/health
```

Behind a TLS-intercepting proxy, pass its CA to the image build with `--secret id=build_ca,src=<ca file>`.

## Rules

- Secrets live only in the env files on the servers (and, once allowed, a CI secret store). Never in this repository.
- Agents never hold production credentials. A human runs deploys and restores.
- `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.example config -q` must pass for every change to the compose file. The env file is required: the compose file refuses to render without the required variables, so a server can never start half-configured.
