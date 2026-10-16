import { eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { Settings, SettingsUpdate, type SeasonMode } from '@qc/contracts';
import { schema, type Db } from '../../db';

/** Setting keys in the `settings` table. Values are validated against the contract on the way in. */
export const SETTING_KEYS = {
  hijriOffsetDays: 'hijri_offset_days',
  seasonMode: 'season_mode',
  whatsappDailyCapPerPerson: 'whatsapp_daily_cap_per_person',
  circleRequestAlertThreshold: 'circle_request_alert_threshold',
  minimumAppVersion: 'minimum_app_version',
} as const;

export const SETTING_DEFAULTS: Settings = {
  hijriOffsetDays: 0,
  seasonMode: 'circles',
  whatsappDailyCapPerPerson: 1,
  circleRequestAlertThreshold: 10,
};

type SettingsField = keyof Settings;

const FIELD_BY_KEY: Record<string, SettingsField> = {
  [SETTING_KEYS.hijriOffsetDays]: 'hijriOffsetDays',
  [SETTING_KEYS.seasonMode]: 'seasonMode',
  [SETTING_KEYS.whatsappDailyCapPerPerson]: 'whatsappDailyCapPerPerson',
  [SETTING_KEYS.circleRequestAlertThreshold]: 'circleRequestAlertThreshold',
};

const fieldSchemas = Settings.shape;

/** Reads the platform settings. A missing or malformed value falls back to its default. */
export async function readSettings(db: Db): Promise<Settings> {
  const rows = await db
    .select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, Object.keys(FIELD_BY_KEY)));
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    const field = FIELD_BY_KEY[row.key];
    if (!field) continue;
    const parsed = (fieldSchemas[field] as z.ZodType).safeParse(row.value);
    if (parsed.success) out[field] = parsed.data;
  }
  return out as unknown as Settings;
}

export async function readMinimumAppVersion(db: Db): Promise<{ ios: string; android: string }> {
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, SETTING_KEYS.minimumAppVersion));
  const value = row?.value as { ios?: unknown; android?: unknown } | undefined;
  return {
    ios: typeof value?.ios === 'string' ? value.ios : '1.0.0',
    android: typeof value?.android === 'string' ? value.android : '1.0.0',
  };
}

export const seasonModeOf = (s: Settings): SeasonMode => s.seasonMode;

/** Applies a partial update and returns the changed field names. */
export async function writeSettings(
  db: Db,
  patch: z.infer<typeof SettingsUpdate>,
  updatedBy: string,
): Promise<{ settings: Settings; changed: string[] }> {
  const changed: string[] = [];
  await db.transaction(async (tx) => {
    for (const [key, field] of Object.entries(FIELD_BY_KEY)) {
      const value = patch[field];
      if (value === undefined) continue;
      changed.push(field);
      await tx
        .insert(schema.settings)
        .values({ key, value, updatedBy })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, updatedBy, updatedAt: new Date() },
        });
    }
  });
  return { settings: await readSettings(db), changed };
}
