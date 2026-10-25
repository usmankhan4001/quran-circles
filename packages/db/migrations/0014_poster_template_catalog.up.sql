-- 0014_poster_template_catalog
-- A fresh install had an empty `poster_templates` table: only the development seed (which refuses to
-- run in production) wrote the rows, so `GET /v1/admin/poster-templates` listed nothing and the
-- console's poster maker had no template to pick. This migration writes the renderer's templates
-- (`DEMO_POSTER_TEMPLATES` in packages/contracts/src/posters.ts), one row per template key, with the
-- fixture ids the seed uses so the seed and this migration agree.
--
-- Idempotent: a row that already exists for a key is left alone. A changed or added template needs a
-- new migration; `packages/db/src/poster-templates.test.ts` fails until there is one.

INSERT INTO "poster_templates" ("id", "key", "name_en", "name_ur", "version", "formats", "provisional")
VALUES
  ('00000000-0000-4000-8000-110000000001', 'cloud', 'Cloud', 'ہلکا', 1, ARRAY['story', 'print_a4', 'print_a3', 'link_preview']::text[], true),
  ('00000000-0000-4000-8000-110000000002', 'night', 'Night', 'رات', 1, ARRAY['story', 'print_a4', 'print_a3', 'link_preview']::text[], true),
  ('00000000-0000-4000-8000-110000000003', 'quranic_circles', 'Quranic Circles', 'قرآنی حلقے', 1, ARRAY['story', 'print_a4', 'print_a3', 'link_preview']::text[], false)
ON CONFLICT ("key") DO NOTHING;
