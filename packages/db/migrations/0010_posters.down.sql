-- 0010_posters (down): reverses the up migration, newest change first.
-- The poster rows stay; they lose their language, failure code, alt text and the link to the
-- poster they replace, which exist only for the rc.5 poster pipeline.

ALTER TABLE "posters" DROP CONSTRAINT "posters_replaces_poster_id_posters_id_fk";
ALTER TABLE "posters" DROP CONSTRAINT "posters_alt_text_object_chk";
ALTER TABLE "posters" DROP CONSTRAINT "posters_language_locale_chk";
ALTER TABLE "posters" DROP CONSTRAINT "posters_failure_code_status_chk";
ALTER TABLE "posters" DROP CONSTRAINT "posters_failure_code_chk";
ALTER TABLE "posters" DROP CONSTRAINT "posters_language_chk";

ALTER TABLE "posters" DROP COLUMN "replaces_poster_id";
ALTER TABLE "posters" DROP COLUMN "alt_text";
ALTER TABLE "posters" DROP COLUMN "failure_code";
ALTER TABLE "posters" DROP COLUMN "language";

ALTER TABLE "poster_templates" DROP COLUMN "provisional";
