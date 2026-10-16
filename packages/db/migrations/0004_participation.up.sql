-- 0004_participation
-- Participation: registrations, follows, consents, attendance, circle progress and requests, bookmarks, reading positions.

CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"area_id" uuid NOT NULL,
	"section" text NOT NULL,
	"party_size" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"anonymised_at" timestamp with time zone,
	CONSTRAINT "registrations_section_chk" CHECK ("section" IN ('women', 'men', 'family')),
	CONSTRAINT "registrations_status_chk" CHECK ("status" IN ('confirmed', 'waitlisted', 'cancelled')),
	CONSTRAINT "registrations_party_size_range_chk" CHECK ("party_size" BETWEEN 1 AND 20)
);

CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" uuid,
	"circle_id" uuid,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_one_target_chk" CHECK (("venue_id" IS NULL) <> ("circle_id" IS NULL))
);

CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"venue_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"source" text NOT NULL,
	CONSTRAINT "consents_channel_chk" CHECK ("channel" IN ('whatsapp', 'sms', 'push', 'email')),
	CONSTRAINT "consents_purpose_chk" CHECK ("purpose" IN ('registration_updates', 'session_reminders', 'venue_alerts', 'announcements')),
	CONSTRAINT "consents_revoked_after_granted_chk" CHECK ("revoked_at" >= "granted_at")
);

CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"registration_id" uuid,
	"name" text,
	"count" integer DEFAULT 1 NOT NULL,
	"marked_by" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_count_chk" CHECK ("count" >= 1)
);

CREATE TABLE "circle_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"set_by" uuid,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_progress_kind_chk" CHECK ("kind" IN ('para', 'surah', 'ayah_range', 'lesson'))
);

CREATE TABLE "circle_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"days" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"section" text,
	"language" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "circle_requests_days_range_chk" CHECK ("days" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
	CONSTRAINT "circle_requests_section_chk" CHECK ("section" IN ('women', 'men', 'family')),
	CONSTRAINT "circle_requests_language_chk" CHECK ("language" IN ('en', 'ur')),
	CONSTRAINT "circle_requests_status_chk" CHECK ("status" IN ('active', 'cancelled', 'fulfilled', 'expired'))
);

CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"surah" smallint,
	"ayah" smallint,
	"para" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_kind_chk" CHECK ("kind" IN ('ayah', 'surah', 'para')),
	CONSTRAINT "bookmarks_surah_range_chk" CHECK ("surah" BETWEEN 1 AND 114),
	CONSTRAINT "bookmarks_ayah_range_chk" CHECK ("ayah" BETWEEN 1 AND 286),
	CONSTRAINT "bookmarks_para_range_chk" CHECK ("para" BETWEEN 1 AND 30),
	CONSTRAINT "bookmarks_target_shape_chk" CHECK (("kind" = 'ayah' AND "surah" IS NOT NULL AND "ayah" IS NOT NULL AND "para" IS NULL) OR ("kind" = 'surah' AND "surah" IS NOT NULL AND "ayah" IS NULL AND "para" IS NULL) OR ("kind" = 'para' AND "para" IS NOT NULL AND "surah" IS NULL AND "ayah" IS NULL))
);

CREATE TABLE "reading_positions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"surah" smallint NOT NULL,
	"ayah" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_positions_surah_range_chk" CHECK ("surah" BETWEEN 1 AND 114),
	CONSTRAINT "reading_positions_ayah_range_chk" CHECK ("ayah" BETWEEN 1 AND 286)
);

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "follows" ADD CONSTRAINT "follows_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "follows" ADD CONSTRAINT "follows_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "consents" ADD CONSTRAINT "consents_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "circle_progress" ADD CONSTRAINT "circle_progress_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "circle_progress" ADD CONSTRAINT "circle_progress_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "circle_progress" ADD CONSTRAINT "circle_progress_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "circle_requests" ADD CONSTRAINT "circle_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "circle_requests" ADD CONSTRAINT "circle_requests_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "reading_positions" ADD CONSTRAINT "reading_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "registrations_user_session_active_uq" ON "registrations" USING btree ("user_id","session_id") WHERE "status" <> 'cancelled' AND "user_id" IS NOT NULL;

CREATE INDEX "registrations_session_idx" ON "registrations" USING btree ("session_id");

CREATE INDEX "registrations_session_status_idx" ON "registrations" USING btree ("session_id","status");

CREATE INDEX "registrations_user_idx" ON "registrations" USING btree ("user_id");

CREATE UNIQUE INDEX "follows_user_venue_uq" ON "follows" USING btree ("user_id","venue_id") WHERE "venue_id" IS NOT NULL;

CREATE UNIQUE INDEX "follows_user_circle_uq" ON "follows" USING btree ("user_id","circle_id") WHERE "circle_id" IS NOT NULL;

CREATE INDEX "follows_venue_idx" ON "follows" USING btree ("venue_id");

CREATE INDEX "follows_circle_idx" ON "follows" USING btree ("circle_id");

CREATE UNIQUE INDEX "consents_active_uq" ON "consents" USING btree ("user_id","channel","purpose",coalesce("venue_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "revoked_at" IS NULL;

CREATE INDEX "attendance_occurrence_idx" ON "attendance" USING btree ("occurrence_id");

CREATE INDEX "circle_progress_circle_set_at_idx" ON "circle_progress" USING btree ("circle_id","set_at");

CREATE UNIQUE INDEX "circle_requests_user_area_active_uq" ON "circle_requests" USING btree ("user_id","area_id") WHERE "status" = 'active';

CREATE INDEX "circle_requests_area_status_idx" ON "circle_requests" USING btree ("area_id","status");

CREATE UNIQUE INDEX "bookmarks_target_uq" ON "bookmarks" USING btree ("user_id","kind",coalesce("surah", 0),coalesce("ayah", 0),coalesce("para", 0));
