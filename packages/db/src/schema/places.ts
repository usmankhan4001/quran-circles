import { boolean, doublePrecision, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { VENUE_STATUSES } from '@qc/contracts';
import { createdAt, e164Check, enumCheck, pk, rangeCheck, updatedAt } from './_helpers';

export const provinces = pgTable('provinces', {
  id: pk(),
  code: text('code').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameUr: text('name_ur').notNull(),
});

export const cities = pgTable(
  'cities',
  {
    id: pk(),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => provinces.id),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
    timezone: text('timezone').notNull().default('Asia/Karachi'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('cities_province_idx').on(t.provinceId)],
);

export const areas = pgTable(
  'areas',
  {
    id: pk(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
  },
  (t) => [
    unique('areas_city_slug_unique').on(t.cityId, t.slug),
    index('areas_city_idx').on(t.cityId),
    rangeCheck('areas', 'lat', -90, 90),
    rangeCheck('areas', 'lng', -180, 180),
  ],
);

export const venues = pgTable(
  'venues',
  {
    id: pk(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    areaId: uuid('area_id')
      .notNull()
      .references(() => areas.id),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
    addressEn: text('address_en').notNull(),
    addressUr: text('address_ur').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    /** The venue's public contact number. The only number attendees ever see. */
    contactPhone: text('contact_phone'),
    hasWomenSection: boolean('has_women_section').notNull().default(false),
    hasParking: boolean('has_parking').notNull().default(false),
    hasWuduArea: boolean('has_wudu_area').notNull().default(false),
    hasElderWheelchairAccess: boolean('has_elder_wheelchair_access').notNull().default(false),
    isChildFriendly: boolean('is_child_friendly').notNull().default(false),
    entranceNotesEn: text('entrance_notes_en'),
    entranceNotesUr: text('entrance_notes_ur'),
    status: text('status', { enum: VENUE_STATUSES }).notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('venues_city_area_idx').on(t.cityId, t.areaId),
    enumCheck('venues', 'status', VENUE_STATUSES),
    e164Check('venues', 'contact_phone'),
    rangeCheck('venues', 'lat', -90, 90),
    rangeCheck('venues', 'lng', -180, 180),
  ],
);

export type ProvinceRow = typeof provinces.$inferSelect;
export type NewProvinceRow = typeof provinces.$inferInsert;
export type CityRow = typeof cities.$inferSelect;
export type NewCityRow = typeof cities.$inferInsert;
export type AreaRow = typeof areas.$inferSelect;
export type NewAreaRow = typeof areas.$inferInsert;
export type VenueRow = typeof venues.$inferSelect;
export type NewVenueRow = typeof venues.$inferInsert;
