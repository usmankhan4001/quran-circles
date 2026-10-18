-- 0011_update_push_fanout (down): reverses the up migration, newest change first.
-- A fan-out still pending when this runs is dropped: its update stays, its pushes are never written.
-- Run the worker until no update has `push_pending_since` set before rolling back.

DROP INDEX "updates_push_pending_idx";
ALTER TABLE "updates" DROP COLUMN "push_pending_since";
