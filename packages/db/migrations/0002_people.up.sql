-- 0002_people
-- People: users, profiles, role assignments, devices, sign-in codes, sessions, invites.

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_verified_at" timestamp with time zone NOT NULL,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'ur' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "users_phone_e164_chk" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "users_locale_chk" CHECK ("locale" IN ('en', 'ur')),
	CONSTRAINT "users_status_chk" CHECK ("status" IN ('active', 'suspended')),
	CONSTRAINT "users_display_name_chk" CHECK (char_length(btrim("display_name")) > 0)
);

CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"area_id" uuid,
	"age_band" text,
	"profession" text,
	"education" text,
	"prior_reading" text,
	"preferred_language" text,
	CONSTRAINT "profiles_age_band_chk" CHECK ("age_band" IN ('under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')),
	CONSTRAINT "profiles_prior_reading_chk" CHECK ("prior_reading" IN ('none', 'basic', 'regular', 'advanced')),
	CONSTRAINT "profiles_preferred_language_chk" CHECK ("preferred_language" IN ('en', 'ur'))
);

CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"scope_type" text NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "role_assignments_role_chk" CHECK ("role" IN ('national_admin', 'city_coordinator', 'venue_coordinator')),
	CONSTRAINT "role_assignments_scope_type_chk" CHECK ("scope_type" IN ('national', 'city', 'venue')),
	CONSTRAINT "role_assignments_scope_shape_chk" CHECK ((scope_type = 'national' AND city_id IS NULL AND venue_id IS NULL) OR (scope_type = 'city' AND city_id IS NOT NULL AND venue_id IS NULL) OR (scope_type = 'venue' AND venue_id IS NOT NULL)),
	CONSTRAINT "role_assignments_role_scope_chk" CHECK ((role = 'national_admin' AND scope_type = 'national') OR (role = 'city_coordinator' AND scope_type = 'city') OR (role = 'venue_coordinator' AND scope_type = 'venue'))
);

CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"provider" text NOT NULL,
	"token" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "devices_provider_token_unique" UNIQUE("provider","token"),
	CONSTRAINT "devices_platform_chk" CHECK ("platform" IN ('ios', 'android', 'web')),
	CONSTRAINT "devices_provider_chk" CHECK ("provider" IN ('fcm', 'apns', 'webpush')),
	CONSTRAINT "devices_locale_chk" CHECK ("locale" IN ('en', 'ur'))
);

CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"channel" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	CONSTRAINT "otp_challenges_phone_e164_chk" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "otp_challenges_channel_chk" CHECK ("channel" IN ('whatsapp', 'sms')),
	CONSTRAINT "otp_challenges_attempts_chk" CHECK ("attempts" >= 0)
);

CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);

CREATE TABLE "coordinator_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"display_name" text,
	"role" text NOT NULL,
	"scope_type" text NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"invited_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "coordinator_invites_phone_e164_chk" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "coordinator_invites_role_chk" CHECK ("role" IN ('national_admin', 'city_coordinator', 'venue_coordinator')),
	CONSTRAINT "coordinator_invites_scope_type_chk" CHECK ("scope_type" IN ('national', 'city', 'venue')),
	CONSTRAINT "coordinator_invites_status_chk" CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')),
	CONSTRAINT "coordinator_invites_scope_shape_chk" CHECK ((scope_type = 'national' AND city_id IS NULL AND venue_id IS NULL) OR (scope_type = 'city' AND city_id IS NOT NULL AND venue_id IS NULL) OR (scope_type = 'venue' AND venue_id IS NOT NULL)),
	CONSTRAINT "coordinator_invites_role_scope_chk" CHECK ((role = 'national_admin' AND scope_type = 'national') OR (role = 'city_coordinator' AND scope_type = 'city') OR (role = 'venue_coordinator' AND scope_type = 'venue'))
);

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "role_assignments_active_uq" ON "role_assignments" USING btree ("user_id","role",coalesce("venue_id", "city_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "revoked_at" IS NULL;

CREATE INDEX "role_assignments_city_idx" ON "role_assignments" USING btree ("city_id");

CREATE INDEX "role_assignments_venue_idx" ON "role_assignments" USING btree ("venue_id");

CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");

CREATE INDEX "otp_challenges_phone_created_idx" ON "otp_challenges" USING btree ("phone_e164","created_at");

CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");

CREATE UNIQUE INDEX "coordinator_invites_pending_uq" ON "coordinator_invites" USING btree ("phone_e164","role",coalesce("venue_id", "city_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "status" = 'pending';

CREATE INDEX "coordinator_invites_phone_idx" ON "coordinator_invites" USING btree ("phone_e164");
