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
| `POSTGRES_PASSWORD`                            | C       | yes      | Database password (hex); becomes `DATABASE_URL` for A and W      |

`DATABASE_URL`, `PORT`, `TRUST_PROXY`, `AUTH_TRUST_PROXY`, `WORKER_HTTP_PORT`, `RENDERER_URL` and `POSTER_STORAGE_DIR` are set by the compose file, not the env file. So are the renderer's own settings (`RENDERER_PORT`, `RENDER_CONCURRENCY`, `RENDER_QUEUE_MAX`, `RENDER_TIMEOUT_MS`, `BROWSER_HEAP_MB`, `BROWSER_RECYCLE_AFTER`, `RENDER_CACHE_BYTES`; values in the compose file).

## API and worker

| Name                      | Read by | Required | Meaning                                                                   |
| ------------------------- | ------- | -------- | ------------------------------------------------------------------------- |
| `APP_ENV`                 | A, W    | yes      | `production` or `staging`                                                 |
| `PUBLIC_WEB_BASE`         | A, W    | yes      | Public https origin for links in messages                                 |
| `AUTH_SECRET`             | A       | yes      | Token signing secret, 32+ characters                                      |
| `CORS_ORIGINS`            | A       | no       | Extra browser origins, comma-separated                                    |
| `AUTH_FIXED_CODE`         | A       | no       | Staging only: fixed six-digit sign-in code; refused in production         |
| `WORKER_POLL_MS`          | W       | no       | Outbox poll interval (default 5000)                                       |
| `WORKER_SEND_CONCURRENCY` | W       | no       | Parallel sends (default 4)                                                |
| `OCCURRENCE_HORIZON_DAYS` | W       | no       | Days ahead the daily top-up keeps session occurrences (1-366, default 90) |

## Poster renderer

| Name                 | Read by | Required  | Meaning                                                                                          |
| -------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------ |
| `RENDERER_TOKEN`     | A, W, R | yes       | Shared bearer token for the renderer, 24+ characters (`openssl rand -hex 32`)                    |
| `RENDERER_URL`       | A, W    | (compose) | `http://poster-renderer:8090`, on the internal `render` network                                  |
| `POSTER_STORAGE_DIR` | A, W    | (compose) | `/var/lib/qc/posters`, the `poster-files` volume (read-only in the api); included in the backups |
| `PUBLIC_WEB_BASE`    | R       | yes       | The same value as for the api and the worker; QR codes on posters link to it                     |

## Messaging (change request `messaging-env-vars`)

| Name                                                                | Read by | Required                   | Meaning                                              |
| ------------------------------------------------------------------- | ------- | -------------------------- | ---------------------------------------------------- |
| `MESSAGING_MODE`                                                    | A, W    | yes in production (`live`) | `fake` or `live`                                     |
| `CODE_DELIVERY_MODE`                                                | A, W    | no                         | `test` or `live`; never `test` in production         |
| `CODE_SMS_FALLBACK`                                                 | A, W    | no                         | SMS when WhatsApp cannot deliver a code (default on) |
| `CODE_VALIDITY_MINUTES`                                             | A, W    | no                         | Sign-in code lifetime (default 10)                   |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`                 | A, W    | when live                  | WhatsApp Cloud API sender                            |
| `WHATSAPP_APP_SECRET`                                               | W       | in production              | Verifies webhook signatures                          |
| `WHATSAPP_VERIFY_TOKEN`                                             | W       | in production              | Webhook subscription handshake                       |
| `WHATSAPP_GRAPH_BASE_URL`, `WHATSAPP_API_VERSION`                   | A, W    | no                         | Override Meta's defaults                             |
| `SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`, `SMS_SENDER`                  | A, W    | no (gateway not chosen)    | SMS fallback                                         |
| `FCM_SERVICE_ACCOUNT_JSON`                                          | W       | for Android push           | Service-account JSON on one line                     |
| `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` | W       | for iOS push               | APNs token auth; key as PEM with `\n`                |
| `APNS_PRODUCTION`                                                   | W       | no                         | Default `true`                                       |
| `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`            | W       | for web push               | PWA push                                             |

WhatsApp webhook callback URL for Meta: `https://<QC_DOMAIN>/webhooks/whatsapp` (Caddy routes it to the worker on port 8081).

## Backups, monitoring and deploys

| Name                               | Read by | Required          | Meaning                                                                |
| ---------------------------------- | ------- | ----------------- | ---------------------------------------------------------------------- |
| `QC_BACKUP_DIR`                    | S       | no                | Local backup directory (`/srv/qc/backups`)                             |
| `QC_BACKUP_AGE_RECIPIENT`          | S       | yes               | age public key the backups are encrypted to                            |
| `QC_BACKUP_AGE_IDENTITY`           | S       | restore host only | Path to the age private key file                                       |
| `QC_BACKUP_RETENTION_DAYS`         | S       | no                | Daily and labelled backups kept (default 14)                           |
| `QC_BACKUP_WEEKLY_RETENTION_WEEKS` | S       | no                | Sunday copies kept (default 8)                                         |
| `QC_BACKUP_RCLONE_REMOTE`          | S       | yes in production | rclone path of the second location                                     |
| `QC_BACKUP_RESTORE_SOURCE`         | S       | no                | Where the restore test fetches from (defaults to the remote above)     |
| `QC_ALERT_WEBHOOK_URL`             | S       | yes in production | Receives `{"text": ...}` alerts                                        |
| `QC_DISK_ALERT_PERCENT`            | S       | no                | Disk alert threshold (default 85)                                      |
| `QC_EXPECT_RESTORE_CHECK`          | S       | no                | `1` on the host that runs restore tests                                |
| `QC_STATE_DIR`                     | S       | no                | Deploy tags and monitor state (`/srv/qc/state`)                        |
| `QC_HEALTH_URL`                    | S       | no                | Defaults to `https://<QC_DOMAIN>/api/health`                           |
| `QC_DEPLOY_TAG`                    | S       | no                | Deploy this tag instead of the git SHA                                 |
| `QC_DEPLOY_PULL`                   | S       | no                | `1`: pull images from the registry instead of building                 |
| `QC_DEPLOY_SKIP_BACKUP`            | S       | no                | `1`: no pre-deploy backup (staging only)                               |
| `QC_CHECK_INSECURE`                | S       | no                | `1`: accept Caddy's local CA. Local rehearsals only, never on a server |
