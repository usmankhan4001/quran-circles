-- 0006_content
-- Posters and content pages.

CREATE TABLE "poster_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"formats" text[] NOT NULL,
	"fields_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "poster_templates_key_unique" UNIQUE("key"),
	CONSTRAINT "poster_templates_formats_chk" CHECK ("formats" <@ ARRAY['story', 'print_a4', 'print_a3', 'link_preview']::text[]),
	CONSTRAINT "poster_templates_formats_nonempty_chk" CHECK (cardinality("formats") > 0),
	CONSTRAINT "poster_templates_version_chk" CHECK ("version" >= 1)
);

CREATE TABLE "posters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"created_by" uuid,
	"format" text NOT NULL,
	"locale" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_snapshot" jsonb NOT NULL,
	"storage_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posters_format_chk" CHECK ("format" IN ('story', 'print_a4', 'print_a3', 'link_preview')),
	CONSTRAINT "posters_locale_chk" CHECK ("locale" IN ('en', 'ur')),
	CONSTRAINT "posters_status_chk" CHECK ("status" IN ('queued', 'ready', 'failed'))
);

CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ur" text,
	"body_en" text NOT NULL,
	"body_ur" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "content_pages_status_chk" CHECK ("status" IN ('draft', 'published'))
);

ALTER TABLE "posters" ADD CONSTRAINT "posters_template_id_poster_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."poster_templates"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "posters" ADD CONSTRAINT "posters_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "posters" ADD CONSTRAINT "posters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "posters_session_idx" ON "posters" USING btree ("session_id");
