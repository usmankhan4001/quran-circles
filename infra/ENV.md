# Environment variables

Names only. Values live in the env file on each server (`/srv/qc/prod.env`, `/srv/qc/staging.env`, mode 600), never in this repository. The template with fake placeholders is `infra/.env.example`.

Who reads what: **C** Docker Compose (interpolation), **A** api container, **W** worker container, **R** poster-renderer container, **S** host scripts (`infra/backup`, `infra/monitoring`, `infra/scripts`). Leave optional variables out of the env file (or commented out); an empty value fails validation.

## Stack

| Name                                           | Read by | Required | Meaning                                                          |
| ---------------------------------------------- | ------- | -------- | ---------------------------------------------------------------- |
| `COMPOSE_PROJECT_NAME`                         | C, S    | yes      | `qc-prod` or `qc-staging`; names containers, volumes, backups    |
| `QC_DOMAIN`                                    | C, S    | yes      | Public site: PWA, `/api`, `/webhooks/whatsapp`                   |
| `QC_CONSOLE_DOMAIN`                            | C       | yes      | Admin console site (static build and `/api`)                     |
| `ACME_EMAIL`                                   | C       | yes      | Contact address for Let's Encrypt                                |
| `QC_WWW_DIR`                                   | C       | no       | Host directory with `app/` and `console/` builds (`/srv/qc/www`) |
| `QC_IMAGE_REGISTRY`                            | C, S    | no       | Image name prefix (`qc`)                                         |
| `QC_IMAGE_TAG`                                 | C       | no       | Image tag; `deploy.sh` sets it per deploy                        |
| `QC_{PROXY,API,WORKER,POSTGRES}_{CPUS,MEMORY}` | C       | no       | Resource limits                                                  |
| `QC_RENDERER_{CPUS,MEMORY}`                    | C       | no       | Poster renderer limits (`1.0`, `768m`; 256 processes, fixed)     |
| `POSTGRES_PASSWORD`                            | C       | yes      | Superuser `qc` (hex): `db-roles`, backups and restores only      |
| `POSTGRES_MIGRATOR_PASSWORD`                   | C       | yes      | Role `qc_migrator` (hex, 24+): `migrate`'s `DATABASE_URL`        |
| `POSTGRES_API_PASSWORD`                        | C       | yes      | Role `qc_api` (hex, 24+): the api's `DATABASE_URL`               |
| `POSTGRES_WORKER_PASSWORD`                     | C       | yes      | Role `qc_worker` (hex, 24+): the worker's and `pgboss-migrate`'s |

The four database passwords must differ; `db-roles` (`infra/postgres/roles.sql`) sets the three role passwords on every `up` (see `infra/README.md`, "Database roles").

`DATABASE_URL` (per service, with its own role), `PGBOSS_DATABASE_URL` (`pgboss-migrate`), `PORT`, `TRUST_PROXY`, `AUTH_TRUST_PROXY`, `WORKER_HTTP_PORT`, `RENDERER_URL` and `POSTER_STORAGE_DIR` are set by the compose file, not the env file. So are the renderer's own settings (`RENDERER_PORT`, `RENDER_CONCURRENCY`, `RENDER_QUEUE_MAX`, `RENDER_TIMEOUT_MS`, `BROWSER_HEAP_MB`, `BROWSER_RECYCLE_AFTER`, `RENDER_CACHE_BYTES`; values in the compose file).

## API and worker

| Name                      | Read by | Required | Meaning                                                                                                                       |
| ------------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                 | A, W    | yes      | `production` or `staging`                                                                                                     |
| `PUBLIC_WEB_BASE`         | A, W    | yes      | Public https origin for links in messages                                                                                     |
| `AUTH_SECRET`             | A       | yes      | Token signing secret, 32+ characters                                                                                          |
| `CORS_ORIGINS`            | A       | no       | Extra browser origins, comma-separated                                                                                        |
| `AUTH_FIXED_CODE`         | A       | no       | Staging only: fixed six-digit sign-in code; refused in production                                                             |
| `WORKER_POLL_MS`          | W       | no       | Longest time without a full outbox pass; a safety net (250-60000, default 30000)                                              |
| `WORKER_WAKE_MS`          | W       | no       | Wake probe interval; starts a pass as soon as work is pending (0 or 100-60000, default 1000; 0 = pass every `WORKER_POLL_MS`) |
| `WORKER_SEND_CONCURRENCY` | W       | no       | WhatsApp and SMS batches sent at once per node (1-32, default 4)                                                              |
| `OCCURRENCE_HORIZON_DAYS` | W       | no       | Days ahead the daily top-up keeps session occurrences (1-366, default 90)                                                     |

### Worker send lanes and claim limits

Push rows go to the queue `outbox-send-push`, WhatsApp and SMS rows to `outbox-send` (the worker creates both at start). Before claiming, the dispatcher counts every worker's rows in `sending` for a lane and claims only up to that lane's limit; the rest wait as `queued` with no lease and no attempt spent. Push provider calls in flight per node are `WORKER_PUSH_CONCURRENCY` x `WORKER_PUSH_PARALLEL` (40 by default); the worker's database pool stays at 10. Defaults and ranges are those of `apps/worker/src/config.ts`; a value out of range stops the worker at start with the variable's name.

| Name                           | Read by | Required | Meaning                                                                                                               |
| ------------------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `WORKER_PUSH_CONCURRENCY`      | W       | no       | Push batches sent at once per node (1-32, default 4)                                                                  |
| `WORKER_PUSH_BATCH_SIZE`       | W       | no       | Push jobs fetched per batch (1-500, default 50)                                                                       |
| `WORKER_PUSH_PARALLEL`         | W       | no       | Pushes sent at once within one batch (1-100, default 10)                                                              |
| `WORKER_PUSH_POLL_MS`          | W       | no       | How often idle push senders look for jobs (500-60000, default 500; pg-boss minimum 500)                               |
| `WORKER_PUSH_MAX_IN_FLIGHT`    | W       | no       | Push rows claimed and not finished, across all workers (1-100000, default 2000); keep it below one lease's work       |
| `WORKER_MESSAGE_MAX_IN_FLIGHT` | W       | no       | WhatsApp and SMS rows claimed and not finished, across all workers (1-10000, default 100)                             |
| `WORKER_LEASE_MS`              | W       | no       | How long a claim or a sender's hold on a row lasts before it is handed out again (60000-3600000, default 300000)      |
| `WORKER_BUSY_POLL_MS`          | W       | no       | How soon the dispatcher looks again while a lane is full or update pushes are being written (100-60000, default 1000) |

Keep `WORKER_PUSH_MAX_IN_FLIGHT` below what the push senders finish within one `WORKER_LEASE_MS`: 2,000 is about 20 s of work at 100 pushes a second. A lease that runs out anyway is logged as `outbox.worker_lost` (see "Monitoring" in `infra/README.md`).

### WhatsApp spend limits (worker, SEC-02)

Defaults for the limits in `apps/worker/src/outbox/limits.ts`. The console's settings override the first two when stored (`whatsapp_daily_cap_per_person`, `whatsapp_city_monthly_budget`, per city or as a default).

| Name                            | Read by | Required | Meaning                                                                                     |
| ------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------- |
| `WHATSAPP_DAILY_CAP`            | W       | no       | Template messages one person may get per Pakistan day (0-5, default 1; 0 = no WhatsApp)     |
| `WHATSAPP_CITY_MONTHLY_BUDGET`  | W       | no       | Paid template messages one city may send per Pakistan calendar month (default 3000)         |
| `WHATSAPP_BUDGET_ALERT_PERCENT` | W       | no       | Share of a city's budget at which `whatsapp.city_budget_near` is logged (1-100, default 80) |

### API limits (fixed in code, not configurable)

These are constants, not environment variables; changing one is a code change in the owning lane. Listed so operators know what to expect.

| Limit                        | Value                                     | Where                                       |
| ---------------------------- | ----------------------------------------- | ------------------------------------------- |
| Sign-in code lifetime        | 5 minutes                                 | `apps/api/src/auth/config.ts` (`otp`)       |
| Code attempts                | 5 per code                                | same                                        |
| Code requests                | 5 per number and 30 per address an hour   | same (`rateLimits`)                         |
| Code checks                  | 10 per number and 40 per address per 15 m | same                                        |
| Token refreshes              | 600 per address per 10 minutes            | same                                        |
| Codes sent per number        | 10 in any 24 hours                        | same (`codeCaps`, SEC-04)                   |
| Codes sent for all numbers   | 1,000 an hour, 10,000 in any 24 hours     | same; `auth.code_global_cap_reached` logged |
| Coordinator invitations      | 100 rows per import, 200 per person a day | `apps/api/src/app.ts` (`inviteLimits`)      |
| Poster create and regenerate | 10 per staff member a minute              | `apps/api/src/app.ts` (`posterRateLimit`)   |

## Poster renderer

| Name                 | Read by | Required  | Meaning                                                                                          |
| -------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------ |
| `RENDERER_TOKEN`     | W, R    | yes       | Shared bearer token for the renderer, 24+ characters (`openssl rand -hex 32`); not given to A    |
| `RENDERER_URL`       | W       | (compose) | `http://poster-renderer:8090`, on the internal `render` network (the api is not on it)           |
| `POSTER_STORAGE_DIR` | A, W    | (compose) | `/var/lib/qc/posters`, the `poster-files` volume (read-only in the api); included in the backups |
| `PUBLIC_WEB_BASE`    | R       | yes       | The same value as for the api and the worker; QR codes on posters link to it                     |

## Messaging (change request `messaging-env-vars`)

| Name                                                                | Read by | Required                   | Meaning                                                                                            |
| ------------------------------------------------------------------- | ------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `MESSAGING_MODE`                                                    | A, W    | yes in production (`live`) | `fake` or `live`                                                                                   |
| `CODE_DELIVERY_MODE`                                                | A, W    | no                         | `test` or `live`; never `test` in production                                                       |
| `CODE_SMS_FALLBACK`                                                 | A, W    | no                         | SMS when WhatsApp cannot deliver a code (default on)                                               |
| `CODE_VALIDITY_MINUTES`                                             | A, W    | no                         | Lifetime the code message states (default 5); leave unset: it must equal the API's fixed 5 minutes |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`                 | A, W    | when live                  | WhatsApp Cloud API sender                                                                          |
| `WHATSAPP_APP_SECRET`                                               | W       | in production              | Verifies webhook signatures                                                                        |
| `WHATSAPP_VERIFY_TOKEN`                                             | W       | in production              | Webhook subscription handshake                                                                     |
| `WHATSAPP_GRAPH_BASE_URL`, `WHATSAPP_API_VERSION`                   | A, W    | no                         | Override Meta's defaults                                                                           |
| `SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`, `SMS_SENDER`                  | A, W    | no (gateway not chosen)    | SMS fallback                                                                                       |
| `FCM_SERVICE_ACCOUNT_JSON`                                          | W       | for Android push           | Service-account JSON on one line                                                                   |
| `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` | W       | for iOS push               | APNs token auth; key as PEM with `\n`                                                              |
| `APNS_PRODUCTION`                                                   | W       | no                         | Default `true`                                                                                     |
| `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`            | W       | for web push               | PWA push                                                                                           |

WhatsApp webhook callback URL for Meta: `https://<QC_DOMAIN>/webhooks/whatsapp` (Caddy routes it to the worker on port 8081).

## Backups, monitoring and deploys

| Name                               | Read by | Required          | Meaning                                                                                                                 |
| ---------------------------------- | ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `QC_BACKUP_DIR`                    | S       | no                | Local backup directory (`/srv/qc/backups`)                                                                              |
| `QC_BACKUP_AGE_RECIPIENT`          | S       | yes               | age public key the backups are encrypted to                                                                             |
| `QC_BACKUP_AGE_IDENTITY`           | S       | restore host only | Path to the age private key file                                                                                        |
| `QC_BACKUP_RETENTION_DAYS`         | S       | no                | Daily and labelled backups kept (default 14)                                                                            |
| `QC_BACKUP_WEEKLY_RETENTION_WEEKS` | S       | no                | Sunday copies kept (default 8)                                                                                          |
| `QC_BACKUP_RCLONE_REMOTE`          | S       | yes in production | rclone path of the second location                                                                                      |
| `QC_BACKUP_REMOTE_PRUNE`           | S       | no                | `0`: never delete in the second location (append-only or object lock; its lifecycle rules apply retention). Default `1` |
| `QC_BACKUP_RESTORE_SOURCE`         | S       | no                | Where the restore test fetches from (defaults to the remote above)                                                      |
| `QC_ALERT_WEBHOOK_URL`             | S       | yes in production | Receives `{"text": ...}` alerts                                                                                         |
| `QC_DISK_ALERT_PERCENT`            | S       | no                | Disk alert threshold (default 85)                                                                                       |
| `QC_EXPECT_RESTORE_CHECK`          | S       | no                | `1` on the host that runs restore tests                                                                                 |
| `QC_STATE_DIR`                     | S       | no                | Deploy tags and monitor state (`/srv/qc/state`)                                                                         |
| `QC_HEALTH_URL`                    | S       | no                | Defaults to `https://<QC_DOMAIN>/api/health`                                                                            |
| `QC_DEPLOY_TAG`                    | S       | no                | Deploy this tag instead of the git SHA                                                                                  |
| `QC_DEPLOY_PULL`                   | S       | no                | `1`: pull images from the registry instead of building                                                                  |
| `QC_DEPLOY_SKIP_BACKUP`            | S       | no                | `1`: no pre-deploy backup (staging only)                                                                                |
| `QC_CHECK_INSECURE`                | S       | no                | `1`: accept Caddy's local CA. Local rehearsals only, never on a server                                                  |
