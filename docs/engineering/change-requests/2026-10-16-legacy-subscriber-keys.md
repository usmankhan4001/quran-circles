# Change request: keys and city on legacy WhatsApp subscribers

Requested by: data-migration
Contract: schema (`legacy_whatsapp_subscribers`)
What I need: a unique key on `(season_tag, phone_raw)`, an E.164 check on `phone_raw`, and nullable `city_id` and `venue_name` columns.
Why: the table has no unique key on the phone, so nothing in the database stops the same subscriber being inserted twice, and `ON CONFLICT DO NOTHING` has nothing to conflict on. Re-consent campaigns by city also need to know the city the subscriber signed up for, which V1 only holds as venue text.
Proposed change: add `UNIQUE (season_tag, phone_raw)`, `CHECK (phone_raw ~ '^\+[1-9][0-9]{7,14}$')`, and `city_id uuid NULL REFERENCES cities(id)`. The reverse migration drops them.
Affected lanes: contracts (db), messaging (re-consent sends), api-core (anything reading the table).
Workaround meanwhile: the migration deduplicates by phone at plan time and counts subscribers already present, all under an advisory lock inside one transaction, so a re-run inserts nothing. Two concurrent runs are serialised by the lock. Other writers to the table are not protected.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.
