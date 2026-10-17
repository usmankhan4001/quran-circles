-- 0010_posters
-- Change request 2026-10-17-poster-renderer (contract 1.0.0-rc.5): what the API and the worker
-- need to drive the poster renderer. Additive: new nullable columns on posters, a flag on
-- poster_templates. Rows made before this migration keep NULL in the new poster columns.

-- A template without its human design approval yet. The renderer's templates are demo templates
-- until the final designs arrive, so new rows default to provisional.
ALTER TABLE "poster_templates" ADD COLUMN "provisional" boolean DEFAULT true NOT NULL;

-- Which languages the poster shows (en, ur, en_ur, ur_en); locale stays the leading one.
-- Regenerating a poster needs it.
ALTER TABLE "posters" ADD COLUMN "language" text;
-- Why the render failed, so the console can say "shorten the title" rather than a bare "failed".
ALTER TABLE "posters" ADD COLUMN "failure_code" text;
-- The renderer's plain sentence per language ({ "en": ..., "ur": ... }), for the share sheet.
ALTER TABLE "posters" ADD COLUMN "alt_text" jsonb;
-- The poster a regeneration replaces; the worker deletes that row and its file once this one is
-- ready.
ALTER TABLE "posters" ADD COLUMN "replaces_poster_id" uuid;

ALTER TABLE "posters" ADD CONSTRAINT "posters_language_chk" CHECK ("language" IN ('en', 'ur', 'en_ur', 'ur_en'));
ALTER TABLE "posters" ADD CONSTRAINT "posters_failure_code_chk" CHECK ("failure_code" IN ('invalid_request', 'text_too_long', 'busy', 'render_timeout', 'render_failed'));
ALTER TABLE "posters" ADD CONSTRAINT "posters_failure_code_status_chk" CHECK ("failure_code" IS NULL OR "status" = 'failed');
ALTER TABLE "posters" ADD CONSTRAINT "posters_language_locale_chk" CHECK ("language" IS NULL OR left("language", 2) = "locale");
ALTER TABLE "posters" ADD CONSTRAINT "posters_alt_text_object_chk" CHECK ("alt_text" IS NULL OR jsonb_typeof("alt_text") = 'object');
ALTER TABLE "posters" ADD CONSTRAINT "posters_replaces_poster_id_posters_id_fk" FOREIGN KEY ("replaces_poster_id") REFERENCES "public"."posters"("id") ON DELETE set null ON UPDATE no action;
