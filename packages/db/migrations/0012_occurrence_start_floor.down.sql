-- 0012_occurrence_start_floor (down): reverses the up migration.
-- Safe at any time: the API's bound stays exact without the index, the lookup of longer
-- occurrences just scans the `starts_at` index instead.

DROP INDEX "occurrences_multiday_starts_idx";
