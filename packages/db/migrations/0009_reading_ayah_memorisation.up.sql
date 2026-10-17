-- 0009_reading_ayah_memorisation
-- Next features, contract 1.0.0-rc.4 (change request 2026-10-17-next-features, accepted):
-- days read and the national total, ayah of the day picks, the memorisation tracker, the daily
-- goal and revise-after setting on the profile, and the ayah_daily notification preference.
-- Dates are Pakistan-time calendar dates. No Quran text is stored anywhere: numbers only.

-- 1. Reading log: one row per person, date and source. Deleted with the account.
CREATE TABLE "reading_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"source" text NOT NULL,
	"pages" smallint DEFAULT 0 NOT NULL,
	"ayahs" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_days_source_chk" CHECK ("source" IN ('reader', 'goal', 'manual', 'attendance', 'portion')),
	CONSTRAINT "reading_days_pages_range_chk" CHECK ("pages" BETWEEN 0 AND 604),
	CONSTRAINT "reading_days_ayahs_range_chk" CHECK ("ayahs" BETWEEN 0 AND 6236)
);
ALTER TABLE "reading_days" ADD CONSTRAINT "reading_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "reading_days_user_day_source_uq" ON "reading_days" USING btree ("user_id","day","source");

-- 3. Community total: per date, without user ids. Only ever incremented; account deletion keeps it.
CREATE TABLE "community_days" (
	"day" date PRIMARY KEY NOT NULL,
	"readers" integer DEFAULT 0 NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_days_readers_chk" CHECK ("readers" >= 0),
	CONSTRAINT "community_days_pages_chk" CHECK ("pages" >= 0)
);

-- 4. Ayah of the day picks: national, venue or circle; one per date and scope.
CREATE TABLE "daily_ayahs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"scope_type" text NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"circle_id" uuid,
	"surah" smallint NOT NULL,
	"ayah" smallint NOT NULL,
	"set_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_ayahs_scope_type_chk" CHECK ("scope_type" IN ('national', 'venue', 'circle')),
	CONSTRAINT "daily_ayahs_surah_range_chk" CHECK ("surah" BETWEEN 1 AND 114),
	CONSTRAINT "daily_ayahs_ayah_range_chk" CHECK ("ayah" BETWEEN 1 AND 286),
	CONSTRAINT "daily_ayahs_ayah_in_surah_chk" CHECK ("ayah" <= (ARRAY[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]::smallint[])["surah"]),
	CONSTRAINT "daily_ayahs_scope_shape_chk" CHECK (("scope_type" = 'national' AND "city_id" IS NULL AND "venue_id" IS NULL AND "circle_id" IS NULL) OR ("scope_type" = 'venue' AND "city_id" IS NOT NULL AND "venue_id" IS NOT NULL AND "circle_id" IS NULL) OR ("scope_type" = 'circle' AND "city_id" IS NOT NULL AND "venue_id" IS NOT NULL AND "circle_id" IS NOT NULL))
);
ALTER TABLE "daily_ayahs" ADD CONSTRAINT "daily_ayahs_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "daily_ayahs" ADD CONSTRAINT "daily_ayahs_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "daily_ayahs" ADD CONSTRAINT "daily_ayahs_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "daily_ayahs" ADD CONSTRAINT "daily_ayahs_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "daily_ayahs_day_scope_uq" ON "daily_ayahs" USING btree ("day","scope_type",coalesce("circle_id", "venue_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "daily_ayahs_venue_idx" ON "daily_ayahs" USING btree ("venue_id");
CREATE INDEX "daily_ayahs_circle_idx" ON "daily_ayahs" USING btree ("circle_id");
CREATE INDEX "daily_ayahs_city_idx" ON "daily_ayahs" USING btree ("city_id");

-- 6. Memorisation tracker: one row per person and marked surah. Deleted with the account.
CREATE TABLE "memorisation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"surah" smallint NOT NULL,
	"status" text NOT NULL,
	"last_revised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memorisation_status_chk" CHECK ("status" IN ('learning', 'memorised', 'revising')),
	CONSTRAINT "memorisation_surah_range_chk" CHECK ("surah" BETWEEN 1 AND 114)
);
ALTER TABLE "memorisation" ADD CONSTRAINT "memorisation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "memorisation_user_surah_uq" ON "memorisation" USING btree ("user_id","surah");

-- 2 and 6. Daily goal and the revise-after setting on the profile.
ALTER TABLE "profiles" ADD COLUMN "daily_goal_unit" text;
ALTER TABLE "profiles" ADD COLUMN "daily_goal_amount" smallint;
ALTER TABLE "profiles" ADD COLUMN "memorisation_revise_after_days" smallint;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_daily_goal_unit_chk" CHECK ("daily_goal_unit" IN ('pages', 'rukus', 'minutes'));
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_daily_goal_amount_range_chk" CHECK ("daily_goal_amount" BETWEEN 1 AND 604);
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_daily_goal_shape_chk" CHECK (("daily_goal_unit" IS NULL) = ("daily_goal_amount" IS NULL));
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_memorisation_revise_after_days_range_chk" CHECK ("memorisation_revise_after_days" BETWEEN 1 AND 365);

-- 5. The ayah_daily notification preference (push, on unless a revoked row says off).
ALTER TABLE "consents" DROP CONSTRAINT "consents_purpose_chk";
ALTER TABLE "consents" ADD CONSTRAINT "consents_purpose_chk" CHECK ("purpose" IN ('registration_updates', 'session_reminders', 'venue_alerts', 'announcements', 'ayah_daily'));
