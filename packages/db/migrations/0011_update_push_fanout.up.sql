-- 0011_update_push_fanout
-- Load test (WP12, api-core finding): a national post with `notify: true` wrote one outbox row per
-- recipient inside the HTTP request (0.8 to 2.1 s for 5,839 people, about 8 to 15 s projected at
-- 50,000). The API now only marks the update in the same transaction as the post; the worker
-- writes the push rows afterwards, in chunks, with the same idempotency keys
-- (`fanOutPendingUpdatePushes` in `@qc/db`). Additive: one nullable column and a partial index.

-- When the update's pushes were asked for and are still to be written. NULL when there is nothing
-- to write (notify off, nobody in reach) or the worker has written them.
ALTER TABLE "updates" ADD COLUMN "push_pending_since" timestamp with time zone;

-- The worker's lookup of pending fan-outs, oldest first. Only pending rows are in it, so it stays tiny.
CREATE INDEX "updates_push_pending_idx" ON "updates" USING btree ("push_pending_since") WHERE "push_pending_since" IS NOT NULL;
