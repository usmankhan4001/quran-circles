import { and, eq } from 'drizzle-orm';
import { FEATURE_FLAGS, type AppConfig, type ContentPage, type FeatureFlagKey } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { readMinimumAppVersion, readSettings } from '../settings/store';

/** A global flag, overridden by the city's own row when the city is given. Missing means off. */
async function resolveFlags(db: Db, cityId: string | undefined): Promise<AppConfig['featureFlags']> {
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
      if (row.cityId === cityId && known.has(row.key)) flags[row.key as FeatureFlagKey] = row.enabled;
    }
  }
  return flags;
}

export async function getConfig(
  db: Db,
  now: Date,
  query: { cityId?: string | undefined },
): Promise<AppConfig> {
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

