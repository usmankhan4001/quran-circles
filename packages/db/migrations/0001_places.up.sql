-- 0001_places
-- Places: provinces, cities, areas, venues (with facilities).

CREATE TABLE "provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	CONSTRAINT "provinces_code_unique" UNIQUE("code")
);

CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);

CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	CONSTRAINT "areas_city_slug_unique" UNIQUE("city_id","slug"),
	CONSTRAINT "areas_lat_range_chk" CHECK ("lat" BETWEEN -90 AND 90),
	CONSTRAINT "areas_lng_range_chk" CHECK ("lng" BETWEEN -180 AND 180)
);

CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"address_en" text NOT NULL,
	"address_ur" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"contact_phone" text,
	"has_women_section" boolean DEFAULT false NOT NULL,
	"has_parking" boolean DEFAULT false NOT NULL,
	"has_wudu_area" boolean DEFAULT false NOT NULL,
	"has_elder_wheelchair_access" boolean DEFAULT false NOT NULL,
	"is_child_friendly" boolean DEFAULT false NOT NULL,
	"entrance_notes_en" text,
	"entrance_notes_ur" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "venues_status_chk" CHECK ("status" IN ('active', 'archived')),
	CONSTRAINT "venues_contact_phone_chk" CHECK ("contact_phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "venues_lat_range_chk" CHECK ("lat" BETWEEN -90 AND 90),
	CONSTRAINT "venues_lng_range_chk" CHECK ("lng" BETWEEN -180 AND 180)
);

ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "venues" ADD CONSTRAINT "venues_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "venues" ADD CONSTRAINT "venues_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "cities_province_idx" ON "cities" USING btree ("province_id");

CREATE INDEX "areas_city_idx" ON "areas" USING btree ("city_id");

CREATE INDEX "venues_city_area_idx" ON "venues" USING btree ("city_id","area_id");
