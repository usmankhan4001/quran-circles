-- 0009_reading_ayah_memorisation (down): reverses the up migration, newest change first.
-- The reading log, the national totals, the picks, the memorisation rows, the goals and the
-- ayah_daily preferences exist only for the rc.4 features, so rolling back removes them.

DELETE FROM "consents" WHERE "purpose" = 'ayah_daily';
ALTER TABLE "consents" DROP CONSTRAINT "consents_purpose_chk";
ALTER TABLE "consents" ADD CONSTRAINT "consents_purpose_chk" CHECK ("purpose" IN ('registration_updates', 'session_reminders', 'venue_alerts', 'announcements'));

ALTER TABLE "profiles" DROP CONSTRAINT "profiles_memorisation_revise_after_days_range_chk";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_daily_goal_shape_chk";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_daily_goal_amount_range_chk";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_daily_goal_unit_chk";
ALTER TABLE "profiles" DROP COLUMN "memorisation_revise_after_days";
ALTER TABLE "profiles" DROP COLUMN "daily_goal_amount";
ALTER TABLE "profiles" DROP COLUMN "daily_goal_unit";

DROP TABLE "memorisation";
DROP TABLE "daily_ayahs";
DROP TABLE "community_days";
DROP TABLE "reading_days";
