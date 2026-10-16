import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk, updatedAt } from './_helpers';
import { users } from './people';
import { cities } from './places';

/**
 * Admin-editable settings: hijri_offset_days, season_mode, message budgets, the WhatsApp
 * daily cap, the circle-request threshold and so on. Values are validated in `@qc/contracts`.
 */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** A flag is global (city_id NULL) or switched on city by city. */
export const featureFlags = pgTable(
  'feature_flags',
  {
    id: pk(),
    key: text('key').notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('feature_flags_global_uq')
      .on(t.key)
      .where(sql`${t.cityId} IS NULL`),
    uniqueIndex('feature_flags_city_uq')
      .on(t.key, t.cityId)
      .where(sql`${t.cityId} IS NOT NULL`),
  ],
);

export type SettingRow = typeof settings.$inferSelect;
export type NewSettingRow = typeof settings.$inferInsert;
export type FeatureFlagRow = typeof featureFlags.$inferSelect;
export type NewFeatureFlagRow = typeof featureFlags.$inferInsert;
