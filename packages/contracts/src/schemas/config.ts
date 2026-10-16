import { z } from 'zod';
import { InstantUtc, Localized, LocalizedLong, Uuid } from '../common';
import { Locale, SeasonMode } from '../enums';

/** Feature flags the server can switch on city by city. Add a key through a change request. */
export const FEATURE_FLAGS = [
  'circle_requests',
  'session_companion',
  'invite_friends',
  'poster_sharing',
  'quran_offline_copy',
  'whatsapp_fallback_reminders',
] as const;
export const FeatureFlagKey = z.enum(FEATURE_FLAGS);
export type FeatureFlagKey = z.infer<typeof FeatureFlagKey>;

export const AppConfig = z.object({
  /** Which program leads the home screen. The server decides. */
  seasonMode: SeasonMode,
  hijriOffsetDays: z.number().int().min(-2).max(2),
  /** Resolved for the city in the query, or the platform default. */
  featureFlags: z.object(Object.fromEntries(FEATURE_FLAGS.map((k) => [k, z.boolean()])) as Record<FeatureFlagKey, z.ZodBoolean>),
  supportedLocales: z.array(Locale),
  /** The apps show an update prompt below this version. */
  minimumAppVersion: z.object({ ios: z.string(), android: z.string() }),
  serverTime: InstantUtc,
});
export type AppConfig = z.infer<typeof AppConfig>;
export const ConfigQuery = z.object({ cityId: Uuid.optional() });

export const ContentPage = z.object({
  slug: z.string(),
  title: Localized,
  body: LocalizedLong,
  publishedAt: InstantUtc,
});
export type ContentPage = z.infer<typeof ContentPage>;
