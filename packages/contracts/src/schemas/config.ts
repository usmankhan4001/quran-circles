import { z } from 'zod';
import { InstantUtc, Localized, LocalizedLong, Uuid } from '../common';
import { Locale, SeasonMode } from '../enums';
import { lazy } from '../lazy';

/** Feature flags of rc.3 and earlier. Always present in `AppConfig.featureFlags`. */
const BASE_FEATURE_FLAGS = [
  'circle_requests',
  'session_companion',
  'invite_friends',
  'poster_sharing',
  'quran_offline_copy',
  'whatsapp_fallback_reminders',
] as const;

/**
 * Flags of the next features (rc.4, Gate 4: each feature ships behind a flag). Off unless a
 * `feature_flags` row turns them on, globally or for a city, like every flag.
 * - `reading_days`: days read and "I read today" (feature 1, personal).
 * - `community_today`: the national "read together today" total (feature 1, community).
 * - `ayah_of_the_day`: the Home card, the morning push and coordinator picks (feature 2).
 * - `memorisation`: the memorisation tracker (feature 3).
 * - `read_along`: "Read tonight's portion" on the session day (feature 4).
 */
export const NEXT_FEATURE_FLAGS = [
  'reading_days',
  'community_today',
  'ayah_of_the_day',
  'memorisation',
  'read_along',
] as const;

/** Feature flags the server can switch on city by city. Add a key through a change request. */
export const FEATURE_FLAGS = [...BASE_FEATURE_FLAGS, ...NEXT_FEATURE_FLAGS] as const;
export const FeatureFlagKey = lazy(() => z.enum(FEATURE_FLAGS));
export type FeatureFlagKey = z.infer<typeof FeatureFlagKey>;

/**
 * Whether a flag is on in a config. A flag missing from the object (an older server, or a test
 * config written before rc.4) is off.
 */
export const featureOn = (
  flags: Partial<Record<FeatureFlagKey, boolean>> | undefined,
  key: FeatureFlagKey,
): boolean => flags?.[key] === true;

export const AppConfig = lazy(() =>
  z.object({
    /** Which program leads the home screen. The server decides. */
    seasonMode: SeasonMode,
    hijriOffsetDays: z.number().int().min(-2).max(2),
    /** Resolved for the city in the query, or the platform default. */
    featureFlags: z.object({
      ...(Object.fromEntries(BASE_FEATURE_FLAGS.map((k) => [k, z.boolean()])) as Record<
        (typeof BASE_FEATURE_FLAGS)[number],
        z.ZodBoolean
      >),
      /**
       * rc.4 flags. The server always sends every key; they are optional in the type only, so a
       * config written for rc.3 still parses. Read them with `featureOn` (missing means off).
       */
      ...(Object.fromEntries(NEXT_FEATURE_FLAGS.map((k) => [k, z.boolean().optional()])) as Record<
        (typeof NEXT_FEATURE_FLAGS)[number],
        z.ZodOptional<z.ZodBoolean>
      >),
    }),
    supportedLocales: z.array(Locale),
    /** The apps show an update prompt below this version. */
    minimumAppVersion: z.object({ ios: z.string(), android: z.string() }),
    serverTime: InstantUtc,
  }),
);
export type AppConfig = z.infer<typeof AppConfig>;
export const ConfigQuery = lazy(() => z.object({ cityId: Uuid.optional() }));

export const ContentPage = lazy(() =>
  z.object({
    slug: z.string(),
    title: Localized,
    body: LocalizedLong,
    publishedAt: InstantUtc,
  }),
);
export type ContentPage = z.infer<typeof ContentPage>;
