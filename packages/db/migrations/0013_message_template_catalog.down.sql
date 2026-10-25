-- 0013_message_template_catalog (down)
-- Removes the catalog rows the up migration wrote. Rows of these keys that someone approved by
-- hand (`approved_by` set) are kept.

DELETE FROM "message_templates"
WHERE "key" IN ('auth_code', 'registration_confirmation', 'session_reminder', 'session_changed', 'session_cancelled', 'waitlist_promoted', 'coordinator_invite', 'circle_opened')
  AND "approved_by" IS NULL;
