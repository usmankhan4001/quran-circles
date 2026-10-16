# Change request: push delivery acknowledgement from the apps

Requested by: messaging
Contract: API (`/me/...`), `@qc/contracts` (new request body)
What I need: an endpoint the apps call when a push arrives or is opened, so the outbox can move a push row from `sent` to `delivered`.
Why: FCM and APNs give no delivery receipt, so push rows end at `sent`. The console's "delivered" figures and the Wave 4 audience-reach numbers would otherwise only count WhatsApp.
Proposed change: `POST /me/notifications/ack` with `{ outboxId: uuid, event: 'received' | 'opened' }`, authenticated as the recipient. The push payload's `data` would carry `outboxId` (the worker would add it when sending). The handler calls the worker's `applyDeliveryReport` rule: only the recipient's own row, only forward, never undoing `delivered`. `PushPayload.data` needs an optional `outboxId`.
Affected lanes: contracts, api-core, user-app, admin-app.
Workaround meanwhile: push rows stay `sent`. Nothing else depends on `delivered` for push.
