-- 0008_auth_grace_outbox_legacy_keys (down): reverses the up migration, newest change first.

ALTER TABLE "legacy_whatsapp_subscribers" DROP CONSTRAINT "legacy_whatsapp_subscribers_phone_raw_chk";
ALTER TABLE "legacy_whatsapp_subscribers" DROP CONSTRAINT "legacy_whatsapp_subscribers_season_phone_unique";
ALTER TABLE "legacy_whatsapp_subscribers" DROP CONSTRAINT "legacy_whatsapp_subscribers_city_id_cities_id_fk";
ALTER TABLE "legacy_whatsapp_subscribers" DROP COLUMN "city_id";

ALTER TABLE "coordinator_invites" DROP CONSTRAINT "coordinator_invites_replaces_assignment_fk";
ALTER TABLE "coordinator_invites" DROP COLUMN "replaces_assignment_id";

DROP INDEX "message_outbox_provider_message_id_idx";
ALTER TABLE "message_outbox" DROP CONSTRAINT "message_outbox_venue_id_venues_id_fk";
ALTER TABLE "message_outbox" DROP COLUMN "provider_message_id";
ALTER TABLE "message_outbox" DROP COLUMN "venue_id";

ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_locale_chk";
ALTER TABLE "otp_challenges" DROP COLUMN "locale";

-- The old column was NOT NULL, so there is nothing to invent a name from: refuse while any
-- account has no name. Give those accounts a name (or delete them) and run the rollback again.
DO $$ BEGIN
	IF EXISTS (SELECT 1 FROM "users" WHERE "display_name" IS NULL) THEN
		RAISE EXCEPTION 'cannot roll back 0008: % account(s) have no display_name; set or remove them first', (SELECT count(*) FROM "users" WHERE "display_name" IS NULL);
	END IF;
END $$;
ALTER TABLE "users" DROP CONSTRAINT "users_display_name_chk";
ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_display_name_chk" CHECK (char_length(btrim("display_name")) > 0);

ALTER TABLE "auth_sessions" DROP COLUMN "rotated_at";
ALTER TABLE "auth_sessions" DROP COLUMN "previous_refresh_token_hash";
