import { boolean, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, e164Check, pk, rawCheck, tstz } from './_helpers';
import { cities } from './places';

/**
 * Ramadan 2026 registrations kept apart from new accounts. Raw values as they were in V1;
 * they are never turned into accounts.
 */
export const legacyRegistrations = pgTable(
  'legacy_registrations',
  {
    id: pk(),
    seasonTag: text('season_tag').notNull().default('ramadan-2026'),
    sourceId: text('source_id').notNull(),
    name: text('name').notNull(),
    phoneRaw: text('phone_raw').notNull(),
    cityName: text('city_name').notNull(),
    venueName: text('venue_name').notNull(),
    partySize: integer('party_size'),
    registeredAt: tstz('registered_at'),
    raw: jsonb('raw').notNull(),
  },
  (t) => [
    unique('legacy_registrations_season_source_unique').on(t.seasonTag, t.sourceId),
    rawCheck('legacy_registrations_party_size_chk', '"party_size" >= 0'),
  ],
);

/**
 * V1 WhatsApp subscribers. Marked as needing re-consent; no consent is carried over.
 * `phone_raw` holds the normalised E.164 number (the name is historical) and is unique per
 * season. `city_id` is the city they signed up for, when it could be matched.
 */
export const legacyWhatsappSubscribers = pgTable(
  'legacy_whatsapp_subscribers',
  {
    id: pk(),
    seasonTag: text('season_tag').notNull().default('ramadan-2026'),
    phoneRaw: text('phone_raw').notNull(),
    name: text('name'),
    needsReconsent: boolean('needs_reconsent').notNull().default(true),
    createdAt: createdAt(),
    cityId: uuid('city_id').references(() => cities.id),
  },
  (t) => [
    unique('legacy_whatsapp_subscribers_season_phone_unique').on(t.seasonTag, t.phoneRaw),
    e164Check('legacy_whatsapp_subscribers', 'phone_raw'),
  ],
);

export type LegacyRegistrationRow = typeof legacyRegistrations.$inferSelect;
export type NewLegacyRegistrationRow = typeof legacyRegistrations.$inferInsert;
export type LegacyWhatsappSubscriberRow = typeof legacyWhatsappSubscribers.$inferSelect;
export type NewLegacyWhatsappSubscriberRow = typeof legacyWhatsappSubscribers.$inferInsert;
