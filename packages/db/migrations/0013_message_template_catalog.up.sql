-- 0013_message_template_catalog
-- A fresh install had an empty `message_templates` table: only the development seed (which refuses
-- to run in production) wrote the catalog, so `GET /v1/admin/message-templates` listed nothing and
-- an update could never name a template. This migration writes the contract catalog
-- (`TEMPLATES` in packages/contracts/src/messages.ts), one row per template key and language.
--
-- English wording is the catalog's approved wording, so it is stored as `approved` (approved by
-- nobody: the catalog itself, at migration time). Urdu stays `draft` until a native speaker has
-- reviewed it (`urduStatus` in the catalog); approving it is a later, human step. Meta's own
-- approval of each `wa_template_name` is separate and not recorded here.
--
-- Idempotent: a row that already exists for a key and language is left alone, except that an
-- English row still in `draft` with the catalog's exact wording and nobody's approval (what the
-- development seed wrote before this migration) is marked approved. A changed catalog needs a new
-- migration; `packages/db/src/message-templates.test.ts` fails until there is one.

INSERT INTO "message_templates" ("key", "channel", "locale", "body", "variables", "wa_template_name", "cost_category", "status", "approved_at")
SELECT v.key, v.channel, v.locale, v.body, v.variables, v.wa_template_name, v.cost_category, v.status,
       CASE WHEN v.status = 'approved' THEN now() END
FROM (VALUES
  ('auth_code', 'whatsapp', 'en', '{code} is your Quran Circles code. It works for {minutes} minutes. Do not share it.', '["code","minutes"]'::jsonb, 'qc_auth_code', 'authentication', 'approved'),
  ('auth_code', 'whatsapp', 'ur', 'آپ کا Quran Circles کوڈ {code} ہے۔ یہ {minutes} منٹ تک کارآمد ہے۔ اسے کسی کو نہ بتائیں۔', '["code","minutes"]'::jsonb, 'qc_auth_code', 'authentication', 'draft'),
  ('registration_confirmation', 'whatsapp', 'en', 'Assalamu alaikum {name}. You are registered for {sessionTitle} at {venueName}, {when}. Details: {link}', '["name","sessionTitle","venueName","when","link"]'::jsonb, 'qc_registration_confirmation', 'utility', 'approved'),
  ('registration_confirmation', 'whatsapp', 'ur', 'السلام علیکم {name}۔ آپ {venueName} میں {sessionTitle} کے لیے اندراج ہو گیا ہے، {when}۔ تفصیل: {link}', '["name","venueName","sessionTitle","when","link"]'::jsonb, 'qc_registration_confirmation', 'utility', 'draft'),
  ('session_reminder', 'push', 'en', 'Reminder: {sessionTitle} at {venueName}, {when}. {link}', '["sessionTitle","venueName","when","link"]'::jsonb, 'qc_session_reminder', 'utility', 'approved'),
  ('session_reminder', 'push', 'ur', 'یاد دہانی: {venueName} میں {sessionTitle}، {when}۔ {link}', '["venueName","sessionTitle","when","link"]'::jsonb, 'qc_session_reminder', 'utility', 'draft'),
  ('session_changed', 'push', 'en', 'Change: {sessionTitle} at {venueName} is now {newWhen}. {link}', '["sessionTitle","venueName","newWhen","link"]'::jsonb, 'qc_session_changed', 'utility', 'approved'),
  ('session_changed', 'push', 'ur', 'تبدیلی: {venueName} میں {sessionTitle} اب {newWhen} ہو گا۔ {link}', '["venueName","sessionTitle","newWhen","link"]'::jsonb, 'qc_session_changed', 'utility', 'draft'),
  ('session_cancelled', 'push', 'en', 'Cancelled: {sessionTitle}, {when}. {link}', '["sessionTitle","when","link"]'::jsonb, 'qc_session_cancelled', 'utility', 'approved'),
  ('session_cancelled', 'push', 'ur', 'منسوخ: {sessionTitle}، {when}۔ {link}', '["sessionTitle","when","link"]'::jsonb, 'qc_session_cancelled', 'utility', 'draft'),
  ('waitlist_promoted', 'push', 'en', 'A seat opened up. You are now registered for {sessionTitle}, {when}. {link}', '["sessionTitle","when","link"]'::jsonb, 'qc_waitlist_promoted', 'utility', 'approved'),
  ('waitlist_promoted', 'push', 'ur', 'ایک نشست خالی ہو گئی۔ اب آپ {sessionTitle} کے لیے رجسٹر ہیں، {when}۔ {link}', '["sessionTitle","when","link"]'::jsonb, 'qc_waitlist_promoted', 'utility', 'draft'),
  ('coordinator_invite', 'whatsapp', 'en', '{inviterName} invited you to help run {scopeName} on Quran Circles. Sign in with this number: {link}', '["inviterName","scopeName","link"]'::jsonb, 'qc_coordinator_invite', 'utility', 'approved'),
  ('coordinator_invite', 'whatsapp', 'ur', '{inviterName} نے آپ کو Quran Circles پر {scopeName} چلانے کی دعوت دی ہے۔ اسی نمبر سے سائن اِن کریں: {link}', '["inviterName","scopeName","link"]'::jsonb, 'qc_coordinator_invite', 'utility', 'draft'),
  ('circle_opened', 'push', 'en', 'A new circle opened in {areaName}: {circleName}. {link}', '["areaName","circleName","link"]'::jsonb, 'qc_circle_opened', 'marketing', 'approved'),
  ('circle_opened', 'push', 'ur', '{areaName} میں نیا حلقہ شروع ہوا: {circleName}۔ {link}', '["areaName","circleName","link"]'::jsonb, 'qc_circle_opened', 'marketing', 'draft')
) AS v ("key", "channel", "locale", "body", "variables", "wa_template_name", "cost_category", "status")
ON CONFLICT ("key", "locale") DO UPDATE
  SET "status" = 'approved', "approved_at" = now(), "updated_at" = now()
  WHERE "message_templates"."status" = 'draft'
    AND EXCLUDED."status" = 'approved'
    AND "message_templates"."approved_by" IS NULL
    AND "message_templates"."body" = EXCLUDED."body";
