-- 0008_auth_grace_outbox_legacy_keys
-- Approved change requests of 2026-10-17: refresh-token grace window, accounts without a name,
-- the sign-in language, venue and provider id on the outbox, the assignment an invite replaces,
-- keys and city on legacy subscribers.

-- auth-session-grace: remember the previous refresh token hash for one rotation step.
ALTER TABLE "auth_sessions" ADD COLUMN "previous_refresh_token_hash" text;
ALTER TABLE "auth_sessions" ADD COLUMN "rotated_at" timestamp with time zone;

-- users-display-name: the name is asked for at registration, so it may be NULL until then.
ALTER TABLE "users" ALTER COLUMN "display_name" DROP NOT NULL;
ALTER TABLE "users" DROP CONSTRAINT "users_display_name_chk";
ALTER TABLE "users" ADD CONSTRAINT "users_display_name_chk" CHECK ("display_name" IS NULL OR char_length(btrim("display_name")) > 0);

-- otp-locale: the language the person used when they asked for the code.
ALTER TABLE "otp_challenges" ADD COLUMN "locale" text DEFAULT 'ur' NOT NULL;
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_locale_chk" CHECK ("locale" IN ('en', 'ur'));

-- outbox-venue-and-provider-id
ALTER TABLE "message_outbox" ADD COLUMN "venue_id" uuid;
ALTER TABLE "message_outbox" ADD COLUMN "provider_message_id" text;
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "message_outbox_provider_message_id_idx" ON "message_outbox" USING btree ("provider_message_id") WHERE "provider_message_id" IS NOT NULL;

-- console-user-lookup-handover: an invite may carry the assignment it replaces, so a handover to
-- a person with no account yet is one step. Accepting the invite ends the old assignment.
ALTER TABLE "coordinator_invites" ADD COLUMN "replaces_assignment_id" uuid;
ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_replaces_assignment_fk" FOREIGN KEY ("replaces_assignment_id") REFERENCES "public"."role_assignments"("id") ON DELETE set null ON UPDATE no action;

-- legacy-subscriber-keys: stop duplicate subscribers and keep the city they signed up for.
-- Fail with a readable message if rows already in the table would break the new rules.
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM "legacy_whatsapp_subscribers" GROUP BY "season_tag", "phone_raw" HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'legacy_whatsapp_subscribers has duplicate (season_tag, phone_raw) rows; remove the duplicates before applying 0008';
	END IF;
	IF EXISTS (
		SELECT 1 FROM "legacy_whatsapp_subscribers" WHERE "phone_raw" !~ '^\+[1-9][0-9]{7,14}$'
	) THEN
		RAISE EXCEPTION 'legacy_whatsapp_subscribers has phone_raw values that are not E.164; normalise or remove them before applying 0008';
	END IF;
END $$;
ALTER TABLE "legacy_whatsapp_subscribers" ADD COLUMN "city_id" uuid;
ALTER TABLE "legacy_whatsapp_subscribers" ADD CONSTRAINT "legacy_whatsapp_subscribers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_whatsapp_subscribers" ADD CONSTRAINT "legacy_whatsapp_subscribers_season_phone_unique" UNIQUE("season_tag","phone_raw");
ALTER TABLE "legacy_whatsapp_subscribers" ADD CONSTRAINT "legacy_whatsapp_subscribers_phone_raw_chk" CHECK ("phone_raw" ~ '^\+[1-9][0-9]{7,14}$');
