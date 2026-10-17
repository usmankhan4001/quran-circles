# Change request: venue and provider message id on the outbox

Requested by: messaging
Contract: schema (`message_outbox`)
What I need: two nullable columns on `message_outbox`: `venue_id uuid REFERENCES venues(id) ON DELETE SET NULL` and `provider_message_id text`, with an index on `provider_message_id` (partial, `WHERE provider_message_id IS NOT NULL`).
Why: venue-scoped consent (`venue_alerts`, and consents granted for one venue) can only be checked when the row says which venue it is about. WhatsApp delivery receipts identify a message by the id Meta returned, and today the only place to keep it is inside the JSON payload, which cannot be indexed cheaply.
Proposed change: add the two columns and the index. `draftPushRow` and `draftTemplateRow` would take an optional `venueId`, and the worker would write `provider_message_id` instead of merging it into `payload`.
Affected lanes: contracts (db), messaging, api-core (anyone who queues a row).
Workaround meanwhile: the worker resolves the venue from the occurrence in the payload and fails closed when it cannot, and it stores the provider id as `payload.providerMessageId` and matches receipts first by `biz_opaque_callback_data` (`outbox:<id>`), which does not need the column.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.
