-- 0003_programs
-- Programs: programs, seasons, circles, sessions, occurrences.

CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	CONSTRAINT "programs_key_unique" UNIQUE("key"),
	CONSTRAINT "programs_key_chk" CHECK ("key" IN ('dora', 'circles'))
);

CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"hijri_year" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "seasons_dates_chk" CHECK ("ends_on" >= "starts_on")
);

CREATE TABLE "circles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"teacher_name" text,
	"description_en" text,
	"description_ur" text,
	"language" text NOT NULL,
	"section" text DEFAULT 'family' NOT NULL,
	"online_link" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circles_language_chk" CHECK ("language" IN ('en', 'ur')),
	CONSTRAINT "circles_section_chk" CHECK ("section" IN ('women', 'men', 'family')),
	CONSTRAINT "circles_status_chk" CHECK ("status" IN ('draft', 'pending_approval', 'published', 'rejected', 'archived'))
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"season_id" uuid,
	"venue_id" uuid NOT NULL,
	"circle_id" uuid,
	"kind" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ur" text NOT NULL,
	"description_en" text,
	"description_ur" text,
	"section" text NOT NULL,
	"language" text NOT NULL,
	"local_start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"days_of_week" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"capacity_enabled" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_kind_chk" CHECK ("kind" IN ('recurring', 'one_off')),
	CONSTRAINT "sessions_section_chk" CHECK ("section" IN ('women', 'men', 'family')),
	CONSTRAINT "sessions_language_chk" CHECK ("language" IN ('en', 'ur')),
	CONSTRAINT "sessions_status_chk" CHECK ("status" IN ('draft', 'published', 'cancelled', 'archived')),
	CONSTRAINT "sessions_days_of_week_range_chk" CHECK ("days_of_week" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
	CONSTRAINT "sessions_kind_days_chk" CHECK (("kind" = 'one_off' AND cardinality("days_of_week") = 0) OR ("kind" = 'recurring' AND cardinality("days_of_week") > 0)),
	CONSTRAINT "sessions_duration_minutes_range_chk" CHECK ("duration_minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "sessions_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
	CONSTRAINT "sessions_capacity_chk" CHECK (("capacity" IS NULL OR "capacity" > 0) AND (NOT "capacity_enabled" OR "capacity" IS NOT NULL))
);

CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"portion" jsonb,
	"portion_label" text,
	"recap_note" text,
	"recap_locale" text,
	"headcount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrences_session_starts_unique" UNIQUE("session_id","starts_at"),
	CONSTRAINT "occurrences_status_chk" CHECK ("status" IN ('scheduled', 'cancelled', 'done')),
	CONSTRAINT "occurrences_recap_locale_chk" CHECK ("recap_locale" IN ('en', 'ur')),
	CONSTRAINT "occurrences_times_chk" CHECK ("ends_at" > "starts_at"),
	CONSTRAINT "occurrences_headcount_chk" CHECK ("headcount" >= 0)
);

ALTER TABLE "seasons" ADD CONSTRAINT "seasons_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "circles" ADD CONSTRAINT "circles_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "circles" ADD CONSTRAINT "circles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "circles" ADD CONSTRAINT "circles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "seasons_program_idx" ON "seasons" USING btree ("program_id");

CREATE INDEX "circles_venue_status_idx" ON "circles" USING btree ("venue_id","status");

CREATE INDEX "sessions_venue_idx" ON "sessions" USING btree ("venue_id");

CREATE INDEX "sessions_starts_on_idx" ON "sessions" USING btree ("starts_on");

CREATE INDEX "occurrences_starts_at_idx" ON "occurrences" USING btree ("starts_at");

CREATE INDEX "occurrences_session_idx" ON "occurrences" USING btree ("session_id");
