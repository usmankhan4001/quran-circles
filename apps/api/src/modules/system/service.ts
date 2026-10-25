import { and, eq } from 'drizzle-orm';
import {
  FEATURE_FLAGS,
  type AppConfig,
  type ContentPage,
  type FeatureFlagKey,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { readMinimumAppVersion, readSettings } from '../settings/store';

/** A global flag, overridden by the city's own row when the city is given. Missing means off. */
async function resolveFlags(
  db: Db,
  cityId: string | undefined,
): Promise<AppConfig['featureFlags']> {
  const rows = await db.select().from(schema.featureFlags);
  const flags = Object.fromEntries(FEATURE_FLAGS.map((k) => [k, false])) as Record<
    FeatureFlagKey,
    boolean
  >;
  const known = new Set<string>(FEATURE_FLAGS);
  for (const row of rows) {
    if (row.cityId === null && known.has(row.key)) flags[row.key as FeatureFlagKey] = row.enabled;
  }
  if (cityId) {
    for (const row of rows) {
      if (row.cityId === cityId && known.has(row.key))
        flags[row.key as FeatureFlagKey] = row.enabled;
    }
  }
  return flags;
}

/**
 * Whether a feature switch is on for the API: on globally or for at least one city, that is,
 * whenever `GET /v1/config` would show it on for some city or for none. The API cannot tell which
 * city an app is showing, so a city that switches a globally-on feature off is left to the apps;
 * a feature switched off everywhere (no row means off, like every flag) is refused here too.
 */
export async function featureOnAnywhere(db: Db, key: FeatureFlagKey): Promise<boolean> {
  const [row] = await db
    .select({ key: schema.featureFlags.key })
    .from(schema.featureFlags)
    .where(and(eq(schema.featureFlags.key, key), eq(schema.featureFlags.enabled, true)))
    .limit(1);
  return row !== undefined;
}

/**
 * Refuses a request to a switched-off feature with `forbidden`, a code every one of these
 * endpoints already lists, before any other work. Reads the same `feature_flags` rows as
 * `GET /v1/config`.
 */
export async function requireFeature(db: Db, key: FeatureFlagKey): Promise<void> {
  if (!(await featureOnAnywhere(db, key))) fail('forbidden');
}

export async function getConfig(
  db: Db,
  now: Date,
  query: { cityId?: string | undefined },
): Promise<AppConfig> {
  // Side by side is fine here: `config.get` reads through the pool, never inside a transaction.
  const [settings, featureFlags, minimumAppVersion] = await Promise.all([
    readSettings(db),
    resolveFlags(db, query.cityId),
    readMinimumAppVersion(db),
  ]);
  return {
    seasonMode: settings.seasonMode,
    hijriOffsetDays: settings.hijriOffsetDays,
    featureFlags,
    supportedLocales: ['en', 'ur'],
    minimumAppVersion,
    serverTime: now.toISOString(),
  };
}

export async function getContentPage(db: Db, slug: string): Promise<ContentPage> {
  const [row] = await db
    .select()
    .from(schema.contentPages)
    .where(and(eq(schema.contentPages.slug, slug), eq(schema.contentPages.status, 'published')));
  if (!row) return fail('not_found');
  return {
    slug: row.slug,
    title: { en: row.titleEn, ur: row.titleUr },
    body: { en: row.bodyEn, ur: row.bodyUr },
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
  };
}
