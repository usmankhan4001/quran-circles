# Change request: environment variables for messaging and the worker

Requested by: messaging
Contract: root config (`.env.example`), deployment (`infra/`)
What I need: the variables below listed in `.env.example` (names only, no values) and passed to the `worker` and `api` services in the compose files.
Why: the worker and the API build their providers from the environment, and `APP_ENV=production` refuses to start with fakes, so a missing name is a failed deploy.
Proposed change:

- Both services: `APP_ENV`, `MESSAGING_MODE` (`fake` | `live`), `CODE_DELIVERY_MODE` (`test` | `live`), `CODE_SMS_FALLBACK`, `CODE_VALIDITY_MINUTES`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`, `SMS_SENDER`.
- Worker only: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_BASE_URL`, `WHATSAPP_API_VERSION`, `FCM_SERVICE_ACCOUNT_JSON`, `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `DATABASE_URL`, `WORKER_HTTP_PORT` (default 8081), `WORKER_POLL_MS`, `WORKER_SEND_CONCURRENCY`, `PUBLIC_WEB_BASE`.
- The reverse proxy should route `/webhooks/whatsapp` to the worker's `WORKER_HTTP_PORT` and keep `/healthz` internal.
- The web app needs `VAPID_PUBLIC_KEY` at build time for web push subscriptions.

Affected lanes: platform, api-core, auth-scopes (uses `CodeSender`).
Workaround meanwhile: defaults are safe for development (fake providers, in-memory codes). Nothing is committed with values.

Applied 2026-10-17: the variable names are in the root `.env.example` (names only, commented out, no values). No contract or migration change. Passing them to the `worker` and `api` services in the compose files (`infra/`) and the reverse-proxy route are not part of this change.
