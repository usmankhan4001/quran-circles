# Infrastructure

The production stack (WP10): Caddy, the api, the worker, Postgres and the poster renderer (WP16) in Docker Compose on one VPS, with encrypted nightly backups, a scripted restore, health checks and alerts. Nothing has been deployed yet: the VPS and the domain are still to come. Everything below is ready for a human to run once they are.

| Path                                | What it is                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docker-compose.prod.yml`           | Production and staging stack: `proxy`, `api`, `worker`, `migrate`, `postgres`, `poster-renderer` |
| `docker/Dockerfile`                 | api and worker images (targets `api`, `worker`), bundled with esbuild                            |
| `docker/poster-renderer.Dockerfile` | Poster renderer image (target `poster-renderer`): Debian slim, Chromium headless shell           |
| `docker/bundle.sh`                  | The esbuild step, also runnable outside Docker                                                   |
| `caddy/Caddyfile`                   | TLS, `/api` to the api, `/webhooks/whatsapp` to the worker, static PWA/console                   |
| `.env.example`                      | Template for the server's env file, fake values only                                             |
| `ENV.md`                            | Every variable name, who reads it, whether it is required                                        |
| `backup/`                           | `backup.sh`, `restore.sh`, `restore-test.sh`                                                     |
| `monitoring/`                       | `check.sh` (health, disk, backup age, TLS), `logrotate.conf`                                     |
| `scripts/deploy.sh`                 | Deploy with automatic rollback, and `--rollback`                                                 |
| `scripts/compose.sh`                | `docker compose` on the current deploy's images; use it for manual commands                      |
| `cron/qc.crontab`                   | Nightly backup, 5-minute checks, weekly restore test, image prune                                |
| `docker-compose.dev.yml`            | Local development database only                                                                  |

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
- [ ] **Second backup location**: an object store or another provider, with an rclone remote configured on the server (`QC_BACKUP_RCLONE_REMOTE`). Make it **append-only** so an intruder on the server cannot erase it (SEC-19; see "Backups", "Append-only second location"): production's credentials can write but not delete, the bucket's lifecycle rules (or object lock) apply the retention, and `QC_BACKUP_REMOTE_PRUNE=0`. The staging host that runs restore tests gets separate read-only credentials.
- [ ] **Backup key pair**: run `age-keygen -o backup-restore.agekey` on the owner's own machine. The public key (`age1...`) goes into `QC_BACKUP_AGE_RECIPIENT` on production. The private key stays offline with the owner and on the staging host only (`QC_BACKUP_AGE_IDENTITY`), never on production.
- [ ] **Alert destination**: a webhook URL that accepts `{"text": "..."}` (for example an ntfy topic or a Slack incoming webhook) and the named human who receives it (`QC_ALERT_WEBHOOK_URL`).
- [ ] **External uptime monitor** (any hosted checker) on `https://<QC_DOMAIN>/api/health`, alerting the same human. The on-server check cannot report the server itself going down.
- [ ] **Secrets**, generated on the server: `POSTGRES_PASSWORD`, `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_API_PASSWORD` and `POSTGRES_WORKER_PASSWORD` (each its own `openssl rand -hex 32`), `AUTH_SECRET` (`openssl rand -base64 48`), `WHATSAPP_VERIFY_TOKEN` (`openssl rand -hex 24`), `RENDERER_TOKEN` (`openssl rand -hex 32`).
- [ ] **Disk for poster files**: rendered posters are kept in the `poster-files` Docker volume on the VPS's own disk (decision for now; an object store can replace it later) and go into the encrypted backups. Allow for it when sizing the disk and the second backup location.
- [ ] **Provider credentials** from the owner's accounts: WhatsApp Cloud API phone number ID, system-user access token and app secret (after Meta Business verification); FCM service account; APNs key, key ID, team ID, bundle ID; VAPID key pair (`npx web-push generate-vapid-keys`); later an SMS gateway.
- [ ] **Recovery targets**: accept the recovery point and recovery time under "Restore", "Recovery targets", or ask for more.
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

Then create the first national admin. `pnpm --filter @qc/db bootstrap-admin --phone <E.164> --yes` creates a pending national-admin invite for that number and prints only the invite id; the person then signs in with a code and accepts it as usual (see `packages/db/README.md`). It needs `DATABASE_URL` pointing at the production database as `qc_api` (it only inserts rows), which publishes no port, so for now run it from a Node 22 container attached to the stack's internal network with the checkout mounted. Open item for the platform lane: bundle a `bootstrap-admin` runner into the `migrate` image so this becomes one `infra/scripts/compose.sh run` command.

Then insert the production poster templates (below, "Poster templates").

Then, in Meta's WhatsApp dashboard, set the callback URL to `https://<QC_DOMAIN>/webhooks/whatsapp` and the verify token to the value of `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.

What `up` does: `postgres` starts and becomes healthy, `migrate` applies pending SQL migrations and exits, then `api` and `worker` start and must pass their health checks, then `proxy` (Caddy) starts and obtains certificates. `poster-renderer` starts alongside and must pass its health check too. Postgres publishes no port and sits on an internal network; only Caddy listens on the host.

The poster renderer sits on its own internal network (`render`) with only the worker, its one caller: no published port, no route to the internet, no route to Postgres, never routed by Caddy. The api only queues poster jobs through pg-boss, so it has neither the network nor the token (SEC-17). It needs `RENDERER_TOKEN` (the same value the worker sends). Rendered files go to the `poster-files` volume, which the worker writes and the api mounts read-only.

### Poster templates

Production gets no seed data, so the `poster_templates` rows are inserted once by hand after the first deploy (migration 0010 or later applied). For now these are the renderer's two **demo** templates, `cloud` and `night` (`DEMO_POSTER_TEMPLATES` in `@qc/contracts`), marked `provisional`. The final designs arrive later as new keys: each one is a new row like these (same statement, new key and names), inserted after the renderer release that knows the key. Retire a template with `UPDATE poster_templates SET is_active = false WHERE key = '<key>'`; never delete a row that posters refer to.

```sh
cd /srv/qc/app
QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh exec -T postgres psql -U qc -d qc -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO poster_templates (key, name_en, name_ur, version, formats, provisional)
VALUES
  ('cloud', 'Cloud', 'ہلکا', 1, ARRAY['story', 'print_a4', 'print_a3', 'link_preview'], true),
  ('night', 'Night', 'رات', 1, ARRAY['story', 'print_a4', 'print_a3', 'link_preview'], true)
ON CONFLICT (key) DO NOTHING;
SELECT key, version, provisional, is_active FROM poster_templates ORDER BY key;
SQL
```

Running it again changes nothing. When the human design approval of a template is given, clear the flag: `UPDATE poster_templates SET provisional = false WHERE key = '<key>'`. Staging gets the same rows.

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

## Database roles

No service connects as the Postgres superuser (SEC-12). `infra/postgres/roles.sql` defines the roles, and the one-shot `db-roles` service runs it as `qc` on every `up`, before the migrations:

| Role          | Used by                                  | Rights                                                                                                     |
| ------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `qc`          | `db-roles`, backups, restores, hand psql | Superuser (the image's bootstrap user)                                                                     |
| `qc_migrator` | `migrate`, `dist/rollback.mjs`           | Owns the application schema (`public`) and the migration ledger                                            |
| `qc_worker`   | worker, `pgboss-migrate`                 | Read and write on application tables; owns pg-boss's schema (pg-boss adds queue tables at run time)        |
| `qc_api`      | api                                      | Read and write on application tables; sends pg-boss jobs. No DDL, no temporary tables, no migration ledger |

None of them is a superuser, and none can create roles or databases. The script is idempotent and converges whatever it finds: a new database, an existing one whose objects all belong to `qc` (it hands them to `qc_migrator` and `qc_worker`), and a restored one (backups carry no owners or grants). Tables that later migrations create get the runtime grants automatically (default privileges). `qc_worker` holds `CREATE` on the database only until pg-boss is installed (pg-boss's installer runs `CREATE SCHEMA`); the next `up` takes it away.

Order on `up`: `postgres` healthy, `db-roles`, then `migrate` (as `qc_migrator`) and `pgboss-migrate` (pg-boss's own CLI, as `qc_worker`: installs the schema on a new database or upgrades it after a pg-boss update), then the api and the worker. Passwords: `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_API_PASSWORD`, `POSTGRES_WORKER_PASSWORD` (24+ characters, hex so they are safe in a URL); `db-roles` sets them on every run.

Hand-run SQL as `qc`: `infra/scripts/compose.sh exec postgres psql -U qc -d qc`. A table created that way belongs to `qc` until the next `up` hands it to `qc_migrator`; schema changes belong in migrations anyway.

## Backups

`backup.sh` runs nightly at 02:30 UTC from cron, and before every deploy.

- `pg_dump` (custom format) runs inside the postgres container and streams straight into `age`, encrypted to `QC_BACKUP_AGE_RECIPIENT`. No unencrypted dump touches the disk, and the production server cannot decrypt its own backups.
- Poster files: the `poster-files` volume is archived with `tar` in a throwaway container (no network, read-only, the files' owner) and encrypted the same way, as a second file next to the dump.
- Manifest: `<same name>.manifest` (plain text, counts only, never data): the exact row count of every public table, taken in the same snapshot `pg_dump` uses (so it is exact even while the app writes), and the number of files in the poster archive. `restore.sh` refuses a backup that does not match it.
- Files: `/srv/qc/backups/daily/<project>-<UTC time>.dump.age`, `<same name>.posters.tar.age` and `<same name>.manifest`, each with a `.sha256`; Sunday copies in `weekly/`; labelled runs (`pre-deploy`, `pre-restore`) in `manual/`.
- Retention: daily and labelled 14 days, weekly 8 weeks (`QC_BACKUP_RETENTION_DAYS`, `QC_BACKUP_WEEKLY_RETENTION_WEEKS`). The same retention is applied to the second location, by `backup.sh` or, for an append-only remote, by the bucket's lifecycle rules.
- Second location: each new file is copied with rclone to `QC_BACKUP_RCLONE_REMOTE`.
- Backups run as the superuser `qc` inside the postgres container and carry no owners or grants (`--no-owner --no-privileges`). After a restore, the next `up` (which `restore.sh` runs) gives the objects back to `qc_migrator` and `qc_worker` and restores the grants (`db-roles`, see "Database roles").
- A failure exits non-zero and sends an alert. `monitoring/check.sh` also alerts when the last good backup is more than 26 hours old.

Manual backup: `QC_ENV_FILE=/srv/qc/prod.env infra/backup/backup.sh manual-note` (label: a-z, 0-9, `-`).

### Append-only second location (SEC-19)

The production server holds the rclone credentials for the second location. With ordinary credentials, someone who takes over the server can delete every remote copy as well as the local ones. So the remote must refuse deletes from this server:

- **Credentials that cannot delete.** For example a Backblaze B2 application key limited to the bucket with `listBuckets`, `listFiles` and `writeFiles` but **not** `deleteFiles`, or an S3 access key whose policy allows `s3:PutObject` and `s3:ListBucket` but not `s3:DeleteObject` or `s3:PutLifecycleConfiguration`. Versioning on, so an overwrite only adds a version.
- **Or object lock** (S3 Object Lock in compliance mode, B2 Object Lock) with a default retention of at least the weekly retention, 8 weeks (56 days), so even the owner's own key cannot remove a copy early.
- **Retention by the bucket**, not by the server: lifecycle rules that delete files (and old versions) under `daily/` and `manual/` after 14 days and under `weekly/` after 56 days, matching `QC_BACKUP_RETENTION_DAYS` and `QC_BACKUP_WEEKLY_RETENTION_WEEKS`. Set them in the provider's console with the owner's account, never with the server's key.
- **`QC_BACKUP_REMOTE_PRUNE=0`** in the production env file, so `backup.sh` does not try to delete (it would fail and log a warning every night).
- **Restore tests** on staging use separate read-only credentials (`listFiles`, `readFiles`; or `s3:GetObject`, `s3:ListBucket`).
- Check once after setting up: from the production server, `rclone delete --dry-run` shows what it would do, then a real `rclone deletefile "$QC_BACKUP_RCLONE_REMOTE/daily/<one old file>"` must fail with a permission error.

### Deleted accounts and backups

Deleting an account removes or anonymises the person's data in the live database at once. Copies of it remain in the encrypted backups made before the deletion until those backups age out: at most 14 days for daily and labelled backups and 8 weeks for weekly copies, locally and in the second location (under object lock, no sooner than the lock allows). Backups are encrypted to a key the production server does not have, and they are only decrypted for a restore or the weekly restore test on staging. A restore from a backup older than a deletion brings that account back: the person must be deleted again before the stack is opened to users. Nothing records deletions today in a form that survives the restore (account deletion is not audited with an id), so this needs a deletion log kept outside the database; open item for api-core and the owner. The privacy notice must say that deleted data leaves backups within 8 weeks (owner and release lane; the text is not in this repository).

## Restore

You need the age private key file. On production it is not present: copy it in for the restore and delete it afterwards (`shred -u`).

A backup set is `<name>.dump.age`, `<name>.manifest` and `<name>.posters.tar.age` (when the manifest lists poster files), each with its `.sha256`, all in one directory. Copy every file of the set when restoring from the second location. `restore.sh` refuses a set with a missing `.sha256` or manifest; `--allow-missing-checksum` and `--allow-missing-manifest` exist only for backups made before checksums or manifests.

Before it touches anything, `restore.sh` proves the whole set is readable: checksums, the manifest, a full decrypt of the dump into a private work directory (mode 700, under `TMPDIR` if set, else `QC_BACKUP_DIR`; deleted at the end), `pg_restore --list` on the decrypted file, and a full decrypt and `tar -t` of the poster archive, whose file count must match the manifest. A damaged, truncated or wrong-key file is refused at this point.

**Check a backup without touching anything** (restores into a scratch database `qc_restore_check`, checks the schema, compares every table's row count with the manifest, drops it):

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/backup/restore.sh \
  --check /srv/qc/backups/daily/<file>.dump.age --identity /path/to/backup-restore.agekey
```

**Replace the live database and poster files**:

```sh
QC_ENV_FILE=/srv/qc/prod.env infra/backup/restore.sh \
  --replace /srv/qc/backups/daily/<file>.dump.age --identity /path/to/backup-restore.agekey
# asks you to type the project name (qc-prod) to confirm; --yes skips the question
```

What `--replace` does, in order:

1. Restores into a new database `qc_restore_new` and compares it with the manifest, while the stack keeps running. The live database is not touched.
2. Stops the api and the worker and takes a `pre-restore` backup of the current database and poster files (when `QC_BACKUP_AGE_RECIPIENT` is set).
3. Unpacks the poster files into `.restore-new` inside the `poster-files` volume and checks the count.
4. Swaps: the poster files by renames inside the volume (undone if a rename fails), then the databases in one transaction: `qc` becomes `qc_before_restore`, `qc_restore_new` becomes `qc`.
5. Starts the stack (newer migrations run) and waits for health.

A failure in steps 1 to 4 leaves the live data as it was and starts the stack again. Every run ends with one line, `RESTORE OK` or `RESTORE FAILED` (with the step and whether live data was touched), and the time taken. `--replace` also sends that result as an alert. If it fails after the swap, it prints the exact command that restores the `pre-restore` backup it just took.

`qc_before_restore` (the database from before the restore) is kept so you can compare. Drop it once you are satisfied: `restore.sh --cleanup` (the next `--replace` also drops it). It needs as much disk as the database itself.

**Restoring onto a brand-new server**: deploy the stack first (the steps under "First deploy on a clean server", with the env file and the age key), so Postgres is running, the migrations have created an empty schema and the `poster-files` volume exists. Then copy the backup set from the second location and run `--replace`. `restore.sh` refuses to start without a running stack.

From the second location: `rclone copy "<remote>/daily/" /srv/qc/backups/daily/ --include "<name>.*"`, then restore as above. Record the time each step takes in the drill log (`docs/quality/restore-drill.md`).

**Weekly restore test** (staging host, Mondays 04:00 UTC from cron): `restore-test.sh --remote` fetches every file of the newest production backup set from the second location into a private temporary directory, runs `restore.sh --check` against the staging Postgres, writes `last-restore-check` and sends a "passed" or "FAILED" message. A failed download or a missing `.sha256` or manifest is a failure. Silence on a Monday means it did not run. Set `QC_EXPECT_RESTORE_CHECK=1` on that host so `check.sh` alerts on a missing or failed test.

### Recovery targets (open: for the owner to accept)

These are the recovery point and recovery time as the setup stands. Nobody has agreed to them yet. The owner should accept them, or ask for more (for example WAL archiving for point-in-time recovery), and the staging drill then passes or fails against them.

- **Recovery point (RPO): up to about 24 hours of data.** Backups are nightly logical dumps (02:30 UTC) plus one before each deploy. There is no WAL archiving and no point-in-time recovery, so anything written since the last backup is lost if the database or the server is lost.
- **Recovery time (RTO), restore on a running server: minutes.** The provisional local drill (`docs/quality/restore-drill.md`, 279 MB database, 258 MB of posters) took 16.5 s for `--replace`, 7 s for `--check` and 9.1 s for `restore-test.sh --remote`; downloading a set at 100 Mbit/s adds about 25 s. In practice the time is the human's: being reached, getting the key onto the server, choosing the backup and confirming. Not yet measured on staging.
- **Recovery time, server lost:** provisioning a new VPS and DNS, the first deploy, then the restore. Not measured yet; the staging drill should time it.

## Monitoring

- **Health endpoints**: the api serves `GET /health` (public as `https://<QC_DOMAIN>/api/health`); the worker and the poster renderer serve `GET /healthz` inside the stack only. Docker health checks call both every 15 s; `restart: unless-stopped` restarts a crashed process.
- **check.sh** (every 5 minutes): public health URL, every container running and healthy, disk below 85 %, last backup under 26 h, TLS certificate valid for 14 more days, no new lost outbox leases (below), and on the restore host the weekly test. It alerts on a change of state only ("problem: ..." and "recovered").
- **Lost outbox leases** (alert on any): the worker claims outbox rows with a lease (`WORKER_LEASE_MS`, 5 minutes by default). A lease that runs out before the row is finished means a worker died mid-send or the senders fell behind the claims; the row is handed out again (or goes `dead` after its last attempt). The worker then logs one error line, `{"level":"error","event":"outbox.worker_lost","fields":{"requeued":<n>,"dead":<n>}}`, and adds the rows to `metrics.workerLost` (and `metrics.workerLostDead`) on its `/healthz`, counters since it started. `check.sh` reads `metrics.workerLost` inside the worker container and reports a problem when it has grown since the last run; a log-based alert on `event` = `outbox.worker_lost` works as well once logs are shipped somewhere. Look first at `metrics.claimed`, `sent` and the outbox counts in `details`: steady growth under a push burst means `WORKER_PUSH_MAX_IN_FLIGHT` is above what the senders finish within one lease (see `infra/ENV.md`). `metrics.updatePushesPending` above 0 for more than a minute means the worker is not writing the pushes of `notify: true` updates.
- **Logs**: the api and worker write structured JSON with personal data redacted. Docker rotates container logs (5 files of 10 MB each). Cron job logs in `/var/log/qc` are rotated weekly by `logrotate.conf`. Caddy writes no access log, because request URIs can carry the webhook verify token. Read logs with `QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh logs -f api worker`.
- **Query statistics**: Postgres loads `pg_stat_statements` (the `command` of the `postgres` service: `track=top`, utility commands left out) and `db-roles` creates its view in the `postgres` database, so the application database and the backups do not change. Only `qc` can read it; the texts carry `$1` placeholders, not values. The slowest statements by total time, after a load test or a slow evening:

  ```sh
  QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh exec -T postgres psql -U qc -d postgres -c "
    SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms,
           rows, left(regexp_replace(query, '\s+', ' ', 'g'), 120) AS query
      FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'qc')
     ORDER BY total_exec_time DESC LIMIT 20"
  ```

  `SELECT pg_stat_statements_reset()` (as `qc`, same database) starts the counts again, for example just before a load test. The counts also start again when Postgres restarts.

- **Not yet in place**: self-hosted error tracking (GlitchTip). It needs an error-reporting hook in the api and worker (their lanes) and its own Postgres and Redis; it will be added as a separate compose file once that hook exists.

## Rotate keys

Edit the value in `/srv/qc/prod.env`, then `QC_ENV_FILE=/srv/qc/prod.env infra/scripts/compose.sh up -d` (only the containers whose environment changed are recreated).

- `AUTH_SECRET`: everyone is signed out and signs in again.
- `RENDERER_TOKEN`: one value for the worker and the renderer; `up -d` recreates both. Poster jobs that fail during the switch are retried by the worker.
- `POSTGRES_PASSWORD` (the superuser `qc`): change it in the database first: `infra/scripts/compose.sh exec postgres psql -U qc -d qc -c "ALTER ROLE qc PASSWORD '<new>'"`, then in the env file, then `up -d`.
- `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_API_PASSWORD`, `POSTGRES_WORKER_PASSWORD`: change the value in the env file, then `up -d`. The `db-roles` step sets the new password before the services that use it are recreated.
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
