-- 0007_settings_audit_legacy
-- Settings and feature flags, audit log, legacy Ramadan 2026 data.

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"city_id" uuid,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"scope_type" text NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_scope_type_chk" CHECK ("scope_type" IN ('national', 'city', 'venue')),
	CONSTRAINT "audit_log_scope_shape_chk" CHECK ((scope_type = 'national' AND city_id IS NULL AND venue_id IS NULL) OR (scope_type = 'city' AND city_id IS NOT NULL AND venue_id IS NULL) OR (scope_type = 'venue' AND venue_id IS NOT NULL))
);

CREATE TABLE "legacy_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_tag" text DEFAULT 'ramadan-2026' NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"phone_raw" text NOT NULL,
	"city_name" text NOT NULL,
	"venue_name" text NOT NULL,
	"party_size" integer,
	"registered_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	CONSTRAINT "legacy_registrations_season_source_unique" UNIQUE("season_tag","source_id"),
	CONSTRAINT "legacy_registrations_party_size_chk" CHECK ("party_size" >= 0)
);

CREATE TABLE "legacy_whatsapp_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_tag" text DEFAULT 'ramadan-2026' NOT NULL,
	"phone_raw" text NOT NULL,
	"name" text,
	"needs_reconsent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "feature_flags_global_uq" ON "feature_flags" USING btree ("key") WHERE "city_id" IS NULL;

CREATE UNIQUE INDEX "feature_flags_city_uq" ON "feature_flags" USING btree ("key","city_id") WHERE "city_id" IS NOT NULL;

CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at" desc);

CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");

CREATE INDEX "audit_log_city_created_idx" ON "audit_log" USING btree ("city_id","created_at" desc);
