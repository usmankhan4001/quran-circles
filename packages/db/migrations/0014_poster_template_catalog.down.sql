-- 0014_poster_template_catalog (down)
-- Removes the rows the up migration wrote. A template that a poster already uses is kept.

DELETE FROM "poster_templates"
WHERE "key" IN ('cloud', 'night', 'quranic_circles')
  AND NOT EXISTS (SELECT 1 FROM "posters" WHERE "posters"."template_id" = "poster_templates"."id");
