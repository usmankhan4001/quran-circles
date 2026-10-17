import { describe, expect, it } from 'vitest';
import { AYAH_COUNTS } from './bookmarks';
import { createApiClient, ApiClientError } from './client';
import { errorsFor, type EndpointDef } from './define';
import { endpoints } from './endpoints';
import {
  AYAH_OF_THE_DAY_SOURCES,
  CONSENT_PURPOSES,
  DAILY_AYAH_SCOPES,
  DAILY_GOAL_UNITS,
  MEMORISATION_STATUSES,
  READING_DAY_CLIENT_SOURCES,
  READING_DAY_SOURCES,
} from './enums';
import { ApiError } from './errors';
import * as fx from './fixtures';
import { fixtureId } from './fixtures';
import { buildDeepLink, parseDeepLink } from './messages';
import { createMockHandler } from './mock';
import {
  BUILT_IN_DAILY_AYAHS,
  addDays,
  builtInAyahFor,
  needsRevision,
  pakistanDate,
  readingDayDateIssue,
  readingRangeIssue,
  resolveDailyAyah,
  type DailyAyahPick,
} from './reading';
import { AppConfig, FEATURE_FLAGS, NEXT_FEATURE_FLAGS, featureOn } from './schemas/config';
import {
  ConsentSet,
  DEFAULT_ON_CONSENTS,
  Me,
  Profile,
  ProfileUpdate,
  consentDefault,
  consentGranted,
} from './schemas/people';
import {
  AdminDailyAyahsQuery,
  AyahOfTheDay,
  AyahOfTheDayQuery,
  AyahRef,
  CommunityToday,
  DailyAyahEntry,
  DailyAyahPut,
  DailyGoal,
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  MemorisationEntry,
  MemorisationParams,
  MemorisationPut,
  MemorisationResponse,
  ReadingDay,
  ReadingDayRecord,
  ReadingDaysQuery,
  isAyahInSurah,
} from './schemas/reading';
import { ACTIONS, can, dailyAyahResource, scopeFilter, type Principal } from './scopes';

const UUID = '00000000-0000-4000-8000-000000000001';
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe('rc.4 vocabularies', () => {
  it('lists the reading sources, with attendance kept for the server', () => {
    expect(READING_DAY_SOURCES).toEqual(['reader', 'goal', 'manual', 'attendance', 'portion']);
    expect(READING_DAY_CLIENT_SOURCES).toEqual(['reader', 'goal', 'manual', 'portion']);
  });
  it('lists goal units, memorisation states and ayah scopes', () => {
    expect(DAILY_GOAL_UNITS).toEqual(['pages', 'rukus', 'minutes']);
    expect(MEMORISATION_STATUSES).toEqual(['learning', 'memorised', 'revising']);
    expect(DAILY_AYAH_SCOPES).toEqual(['national', 'venue', 'circle']);
    expect(AYAH_OF_THE_DAY_SOURCES).toEqual(['national', 'venue', 'circle', 'built_in']);
  });
  it('adds the ayah_daily notification purpose without removing any', () => {
    expect(CONSENT_PURPOSES).toEqual([
      'registration_updates',
      'session_reminders',
      'venue_alerts',
      'announcements',
      'ayah_daily',
    ]);
  });
});

describe('ayah references', () => {
  it('knows each surah has its own ayah count', () => {
    expect(isAyahInSurah(2, 286)).toBe(true);
    expect(isAyahInSurah(1, 7)).toBe(true);
    expect(isAyahInSurah(1, 8)).toBe(false);
    expect(isAyahInSurah(114, 6)).toBe(true);
    expect(isAyahInSurah(114, 7)).toBe(false);
    expect(isAyahInSurah(0, 1)).toBe(false);
    expect(isAyahInSurah(115, 1)).toBe(false);
    expect(isAyahInSurah(2, 0)).toBe(false);
    expect(isAyahInSurah(2, 1.5)).toBe(false);
  });
  it('refuses an ayah past the end of its surah, at the ayah path', () => {
    expect(ok(AyahRef, { surah: 2, ayah: 255 })).toBe(true);
    const bad = AyahRef.safeParse({ surah: 103, ayah: 4 });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(['ayah']);
    expect(ok(AyahRef, { surah: 2, ayah: 287 })).toBe(false);
    expect(ok(AyahRef, { surah: 0, ayah: 1 })).toBe(false);
  });
});

describe('daily goal and profile', () => {
  it('accepts a goal in each unit and refuses nonsense', () => {
    for (const unit of DAILY_GOAL_UNITS) expect(ok(DailyGoal, { unit, amount: 1 })).toBe(true);
    expect(ok(DailyGoal, { unit: 'pages', amount: 604 })).toBe(true);
    expect(ok(DailyGoal, { unit: 'pages', amount: 605 })).toBe(false);
    expect(ok(DailyGoal, { unit: 'pages', amount: 0 })).toBe(false);
    expect(ok(DailyGoal, { unit: 'pages', amount: 1.5 })).toBe(false);
    expect(ok(DailyGoal, { unit: 'juz', amount: 1 })).toBe(false);
  });

  const rc3Profile = {
    areaId: null,
    ageBand: null,
    profession: null,
    education: null,
    priorReading: null,
    preferredLanguage: null,
  };

  it('still parses an rc.3 profile with no goal or revise setting', () => {
    expect(ok(Profile, rc3Profile)).toBe(true);
    expect(Profile.parse(rc3Profile).dailyGoal).toBeUndefined();
  });

  it('carries the goal and the revise-after setting, null when unset', () => {
    expect(
      ok(Profile, {
        ...rc3Profile,
        dailyGoal: { unit: 'minutes', amount: 10 },
        memorisationReviseAfterDays: 7,
      }),
    ).toBe(true);
    expect(ok(Profile, { ...rc3Profile, dailyGoal: null, memorisationReviseAfterDays: null })).toBe(
      true,
    );
    expect(ok(Profile, { ...rc3Profile, memorisationReviseAfterDays: 0 })).toBe(false);
    expect(ok(Profile, { ...rc3Profile, memorisationReviseAfterDays: 366 })).toBe(false);
  });

  it('sets or clears the goal and the setting through a profile update', () => {
    expect(ProfileUpdate.parse({ dailyGoal: { unit: 'rukus', amount: 1 } }).dailyGoal).toEqual({
      unit: 'rukus',
      amount: 1,
    });
    expect(ProfileUpdate.parse({ dailyGoal: null }).dailyGoal).toBeNull();
    expect(ProfileUpdate.parse({ memorisationReviseAfterDays: null })).toEqual({
      memorisationReviseAfterDays: null,
    });
    expect(ok(ProfileUpdate, { memorisationReviseAfterDays: 365 })).toBe(true);
    expect(ok(ProfileUpdate, { dailyGoal: { unit: 'pages' } })).toBe(false);
    expect(ok(ProfileUpdate, {})).toBe(true);
  });

  it('keeps the fixture person valid', () => {
    expect(ok(Me, fx.fixtureMe)).toBe(true);
    expect(fx.fixtureMe.profile.dailyGoal).toBeNull();
    expect(MEMORISATION_REVISE_AFTER_DAYS_DEFAULT).toBe(14);
  });
});

describe('reading log schemas', () => {
  it('records a day from the client sources, never attendance', () => {
    for (const source of READING_DAY_CLIENT_SOURCES)
      expect(ok(ReadingDayRecord, { source })).toBe(true);
    expect(ok(ReadingDayRecord, { source: 'attendance' })).toBe(false);
    expect(ok(ReadingDayRecord, { source: 'manual', date: '2027-02-15' })).toBe(true);
    expect(ok(ReadingDayRecord, { source: 'manual', date: '15/02/2027' })).toBe(false);
  });

  it('keeps pages and ayahs within one day of reading', () => {
    expect(ok(ReadingDayRecord, { source: 'reader', pages: 604, ayahs: 6236 })).toBe(true);
    expect(ok(ReadingDayRecord, { source: 'reader', pages: 605 })).toBe(false);
    expect(ok(ReadingDayRecord, { source: 'reader', ayahs: 6237 })).toBe(false);
    expect(ok(ReadingDayRecord, { source: 'reader', pages: -1 })).toBe(false);
  });

  it('returns a day with at least one source', () => {
    expect(ok(ReadingDay, { date: '2027-02-15', sources: ['manual'], pages: 0, ayahs: 0 })).toBe(
      true,
    );
    expect(ok(ReadingDay, { date: '2027-02-15', sources: [], pages: 0, ayahs: 0 })).toBe(false);
    fx.fixtureReadingDays.forEach((d) => ReadingDay.parse(d));
  });

  it('needs both dates of a range', () => {
    expect(ok(ReadingDaysQuery, { from: '2027-02-09', to: '2027-02-15' })).toBe(true);
    expect(ok(ReadingDaysQuery, { from: '2027-02-09' })).toBe(false);
  });

  it('has a national total with no breakdown', () => {
    expect(Object.keys(CommunityToday.shape).sort()).toEqual([
      'date',
      'pagesTogether',
      'readersToday',
    ]);
    expect(ok(CommunityToday, fx.fixtureCommunityToday)).toBe(true);
    expect(ok(CommunityToday, { date: '2027-02-15', readersToday: -1, pagesTogether: 0 })).toBe(
      false,
    );
  });
});

describe('reading rules', () => {
  it('turns an instant into the Pakistan date (UTC+5)', () => {
    expect(pakistanDate('2027-02-15T18:59:59Z')).toBe('2027-02-15');
    expect(pakistanDate('2027-02-15T19:00:00Z')).toBe('2027-02-16');
    expect(pakistanDate(new Date('2027-02-14T19:30:00Z'))).toBe('2027-02-15');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
  });

  it('accepts today and yesterday only for a day read', () => {
    const now = new Date('2027-02-15T08:00:00Z');
    expect(readingDayDateIssue(undefined, now)).toBeNull();
    expect(readingDayDateIssue('2027-02-15', now)).toBeNull();
    expect(readingDayDateIssue('2027-02-14', now)).toBeNull();
    expect(readingDayDateIssue('2027-02-13', now)).toEqual({ path: 'date', code: 'out_of_range' });
    expect(readingDayDateIssue('2027-02-16', now)).toEqual({ path: 'date', code: 'out_of_range' });
    // Just after midnight in Pakistan the new day is today.
    expect(readingDayDateIssue('2027-02-16', new Date('2027-02-15T19:05:00Z'))).toBeNull();
  });

  it('refuses a backwards range and one longer than 366 days', () => {
    expect(readingRangeIssue({ from: '2027-02-15', to: '2027-02-15' })).toBeNull();
    expect(readingRangeIssue({ from: '2027-01-01', to: '2028-01-01' })).toBeNull();
    expect(readingRangeIssue({ from: '2027-02-16', to: '2027-02-15' })).toEqual({
      path: 'from',
      code: 'invalid_range',
    });
    expect(readingRangeIssue({ from: '2027-01-01', to: '2028-01-02' })).toEqual({
      path: 'to',
      code: 'too_big',
    });
  });

  it('shows a memorised surah in "revise this week" once it is due', () => {
    const now = new Date('2027-02-15T08:00:00Z');
    const at = (iso: string | null) => ({ status: 'memorised' as const, lastRevisedAt: iso });
    expect(needsRevision(at(null), now)).toBe(true);
    expect(needsRevision(at('2027-02-01T08:00:00Z'), now)).toBe(true);
    expect(needsRevision(at('2027-02-01T08:00:01Z'), now)).toBe(false);
    expect(needsRevision(at('2027-02-10T08:00:00Z'), now, 5)).toBe(true);
    expect(needsRevision({ status: 'learning', lastRevisedAt: null }, now)).toBe(false);
    expect(needsRevision({ status: 'revising', lastRevisedAt: null }, now)).toBe(false);
  });
});

describe('ayah of the day', () => {
  it('ships well-known ayat as numbers only, each one real and listed once', () => {
    expect(BUILT_IN_DAILY_AYAHS.length).toBeGreaterThanOrEqual(60);
    const keys = BUILT_IN_DAILY_AYAHS.map((a) => `${a.surah}:${a.ayah}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of BUILT_IN_DAILY_AYAHS) {
      expect(Object.keys(a).sort()).toEqual(['ayah', 'surah']);
      expect(a.ayah, `${a.surah}:${a.ayah}`).toBeLessThanOrEqual(AYAH_COUNTS[a.surah - 1]!);
      expect(ok(AyahRef, a)).toBe(true);
    }
  });

  it('picks the built-in ayah by date, the same each time, walking the list day by day', () => {
    expect(builtInAyahFor('2027-02-15')).toEqual(builtInAyahFor('2027-02-15'));
    const n = BUILT_IN_DAILY_AYAHS.length;
    expect(builtInAyahFor(addDays('2027-02-15', n))).toEqual(builtInAyahFor('2027-02-15'));
    const days = Array.from({ length: n }, (_, i) => builtInAyahFor(addDays('2027-02-15', i)));
    expect(new Set(days.map((a) => `${a.surah}:${a.ayah}`)).size).toBe(n);
    expect(ok(AyahRef, builtInAyahFor('1969-12-31'))).toBe(true);
  });

  const VENUE = fixtureId('venue', 1);
  const OTHER_VENUE = fixtureId('venue', 2);
  const CIRCLE = fixtureId('circle', 1);
  const pick = (p: Partial<DailyAyahPick>): DailyAyahPick => ({
    date: '2027-02-15',
    scopeType: 'national',
    venueId: null,
    circleId: null,
    surah: 2,
    ayah: 255,
    ...p,
  });
  const national = pick({});
  const venuePick = pick({ scopeType: 'venue', venueId: VENUE, surah: 13, ayah: 28 });
  const circlePick = pick({
    scopeType: 'circle',
    venueId: VENUE,
    circleId: CIRCLE,
    surah: 73,
    ayah: 4,
  });

  it('shows the national pick to someone who follows nothing', () => {
    expect(resolveDailyAyah({ date: '2027-02-15', picks: [national, venuePick] })).toEqual({
      date: '2027-02-15',
      surah: 2,
      ayah: 255,
      source: 'national',
      venueId: null,
      circleId: null,
    });
  });

  it("shows a followed venue's pick when it is the only one that applies", () => {
    expect(
      resolveDailyAyah({
        date: '2027-02-15',
        picks: [national, venuePick],
        followedVenueIds: [VENUE, OTHER_VENUE],
      }),
    ).toMatchObject({ surah: 13, ayah: 28, source: 'venue', venueId: VENUE, circleId: null });
  });

  it("shows a followed circle's pick when it is the only one", () => {
    expect(
      resolveDailyAyah({ date: '2027-02-15', picks: [circlePick], followedCircleIds: [CIRCLE] }),
    ).toMatchObject({ surah: 73, ayah: 4, source: 'circle', venueId: VENUE, circleId: CIRCLE });
  });

  it('falls back to the national pick when several followed picks apply', () => {
    expect(
      resolveDailyAyah({
        date: '2027-02-15',
        picks: [national, venuePick, circlePick],
        followedVenueIds: [VENUE],
        followedCircleIds: [CIRCLE],
      }),
    ).toMatchObject({ source: 'national', surah: 2, ayah: 255 });
  });

  it('falls back to the built-in list with no national pick, or picks for another day', () => {
    const builtIn = builtInAyahFor('2027-02-15');
    expect(resolveDailyAyah({ date: '2027-02-15', picks: [] })).toEqual({
      date: '2027-02-15',
      ...builtIn,
      source: 'built_in',
      venueId: null,
      circleId: null,
    });
    expect(
      resolveDailyAyah({
        date: '2027-02-15',
        picks: [pick({ date: '2027-02-16' }), { ...venuePick, date: '2027-02-14' }],
        followedVenueIds: [VENUE],
      }).source,
    ).toBe('built_in');
    // Several followed picks and no national pick: the built-in list.
    expect(
      resolveDailyAyah({
        date: '2027-02-15',
        picks: [venuePick, circlePick],
        followedVenueIds: [VENUE],
        followedCircleIds: [CIRCLE],
      }).source,
    ).toBe('built_in');
  });

  it('ignores a pick for a place the person does not follow', () => {
    expect(
      resolveDailyAyah({ date: '2027-02-15', picks: [venuePick], followedVenueIds: [OTHER_VENUE] })
        .source,
    ).toBe('built_in');
  });

  it('validates the schemas: numbers only, real ayat, one scope', () => {
    expect(Object.keys(AyahOfTheDay.shape)).not.toContain('text');
    expect(Object.keys(DailyAyahEntry.shape)).not.toContain('text');
    fx.dailyAyahs.forEach((x) => DailyAyahEntry.parse(x));
    const base = { date: '2027-02-15', surah: 2, ayah: 255 };
    expect(ok(DailyAyahPut, { ...base, scope: { type: 'national' } })).toBe(true);
    expect(ok(DailyAyahPut, { ...base, scope: { type: 'venue', venueId: UUID } })).toBe(true);
    expect(ok(DailyAyahPut, { ...base, scope: { type: 'circle', circleId: UUID } })).toBe(true);
    expect(ok(DailyAyahPut, { ...base, scope: { type: 'city', cityId: UUID } })).toBe(false);
    expect(ok(DailyAyahPut, { ...base, scope: { type: 'venue' } })).toBe(false);
    expect(ok(DailyAyahPut, { ...base, ayah: 287, scope: { type: 'national' } })).toBe(false);
    const short = DailyAyahPut.safeParse({
      ...base,
      surah: 1,
      ayah: 8,
      scope: { type: 'national' },
    });
    expect(short.error?.issues[0]?.path).toEqual(['ayah']);
  });

  it('takes followed places as repeated query parameters, at most 50 each', () => {
    expect(ok(AyahOfTheDayQuery, {})).toBe(true);
    expect(ok(AyahOfTheDayQuery, { venueId: [UUID], circleId: [UUID], date: '2027-02-15' })).toBe(
      true,
    );
    expect(ok(AyahOfTheDayQuery, { venueId: Array.from({ length: 51 }, () => UUID) })).toBe(false);
    expect(ok(AyahOfTheDayQuery, { venueId: ['not-a-uuid'] })).toBe(false);
    expect(ok(AdminDailyAyahsQuery, { from: '2027-02-01', to: '2027-02-28' })).toBe(true);
    expect(ok(AdminDailyAyahsQuery, { from: '2027-02-01', to: '2027-02-28', scopeType: 'x' })).toBe(
      false,
    );
  });

  it('keeps fixture picks consistent with the places they name', () => {
    for (const p of fx.dailyAyahs) {
      if (p.scopeType === 'national') {
        expect([p.cityId, p.venueId, p.circleId]).toEqual([null, null, null]);
        continue;
      }
      const venue = fx.venues.find((v) => v.id === p.venueId)!;
      expect(venue.cityId).toBe(p.cityId);
      if (p.scopeType === 'circle')
        expect(fx.circles.find((c) => c.id === p.circleId)?.venueId).toBe(p.venueId);
      else expect(p.circleId).toBeNull();
    }
    expect(fx.venues[4]!.cityId).not.toBe(fx.venues[0]!.cityId);
  });
});

describe('memorisation schemas', () => {
  it('marks a surah in one of three states', () => {
    for (const status of MEMORISATION_STATUSES) expect(ok(MemorisationPut, { status })).toBe(true);
    expect(ok(MemorisationPut, { status: 'memorised', markRevised: true })).toBe(true);
    expect(ok(MemorisationPut, { status: 'forgotten' })).toBe(false);
    expect(ok(MemorisationPut, {})).toBe(false);
  });

  it('reads the surah from the path as a number from 1 to 114', () => {
    expect(MemorisationParams.parse({ surah: '67' })).toEqual({ surah: 67 });
    expect(ok(MemorisationParams, { surah: '0' })).toBe(false);
    expect(ok(MemorisationParams, { surah: '115' })).toBe(false);
    expect(ok(MemorisationParams, { surah: 'abc' })).toBe(false);
    expect(ok(MemorisationParams, { surah: '2.5' })).toBe(false);
  });

  it('lists entries with the setting', () => {
    fx.fixtureMemorisation.forEach((m) => MemorisationEntry.parse(m));
    expect(ok(MemorisationResponse, { items: fx.fixtureMemorisation, reviseAfterDays: 14 })).toBe(
      true,
    );
    expect(ok(MemorisationResponse, { items: [], reviseAfterDays: 0 })).toBe(false);
  });
});

describe('ayah notification preference', () => {
  it('is on by default for push only, and every other consent is off by default', () => {
    expect(DEFAULT_ON_CONSENTS).toEqual([{ channel: 'push', purpose: 'ayah_daily' }]);
    expect(consentDefault('push', 'ayah_daily')).toBe(true);
    expect(consentDefault('whatsapp', 'ayah_daily')).toBe(false);
    for (const purpose of CONSENT_PURPOSES.filter((p) => p !== 'ayah_daily'))
      expect(consentDefault('push', purpose)).toBe(false);
  });

  it('follows the live row when there is one', () => {
    expect(consentGranted('push', 'ayah_daily', [])).toBe(true);
    expect(consentGranted('push', 'ayah_daily', [{ revokedAt: '2027-02-15T08:00:00Z' }])).toBe(
      false,
    );
    expect(
      consentGranted('push', 'ayah_daily', [
        { revokedAt: '2027-02-10T08:00:00Z' },
        { revokedAt: null },
      ]),
    ).toBe(true);
    expect(consentGranted('push', 'session_reminders', [])).toBe(false);
    expect(consentGranted('push', 'session_reminders', [{ revokedAt: null }])).toBe(true);
  });

  it('accepts ayah_daily on push only, and never for one venue', () => {
    expect(ok(ConsentSet, { channel: 'push', purpose: 'ayah_daily', granted: false })).toBe(true);
    const wa = ConsentSet.safeParse({ channel: 'whatsapp', purpose: 'ayah_daily', granted: true });
    expect(wa.success).toBe(false);
    expect(wa.error?.issues[0]?.path).toEqual(['channel']);
    expect(
      ok(ConsentSet, { channel: 'push', purpose: 'ayah_daily', venueId: UUID, granted: true }),
    ).toBe(false);
    expect(ok(ConsentSet, { channel: 'whatsapp', purpose: 'venue_alerts', granted: true })).toBe(
      true,
    );
  });
});

describe('feature flags', () => {
  it('adds one flag per next feature', () => {
    expect(NEXT_FEATURE_FLAGS).toEqual([
      'reading_days',
      'community_today',
      'ayah_of_the_day',
      'memorisation',
      'read_along',
    ]);
    for (const f of NEXT_FEATURE_FLAGS) expect(FEATURE_FLAGS).toContain(f);
    expect(FEATURE_FLAGS).toContain('circle_requests');
  });

  const rc3Config = {
    seasonMode: 'dora',
    hijriOffsetDays: 0,
    featureFlags: {
      circle_requests: true,
      session_companion: true,
      invite_friends: true,
      poster_sharing: false,
      quran_offline_copy: false,
      whatsapp_fallback_reminders: false,
    },
    supportedLocales: ['en', 'ur'],
    minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
    serverTime: '2027-02-15T08:00:00Z',
  };

  it('treats a missing new flag as off, so an rc.3 config still parses', () => {
    const config = AppConfig.parse(rc3Config);
    for (const f of NEXT_FEATURE_FLAGS) expect(featureOn(config.featureFlags, f)).toBe(false);
    expect(featureOn(config.featureFlags, 'circle_requests')).toBe(true);
    expect(featureOn(undefined, 'reading_days')).toBe(false);
  });

  it('reads a new flag the server sends', () => {
    const config = AppConfig.parse({
      ...rc3Config,
      featureFlags: { ...rc3Config.featureFlags, reading_days: true, memorisation: false },
    });
    expect(featureOn(config.featureFlags, 'reading_days')).toBe(true);
    expect(featureOn(config.featureFlags, 'memorisation')).toBe(false);
    expect(
      ok(AppConfig, { ...rc3Config, featureFlags: { ...rc3Config.featureFlags, read_along: 'y' } }),
    ).toBe(false);
  });

  it('still requires the rc.3 flags', () => {
    const flags: Record<string, boolean> = { ...rc3Config.featureFlags };
    delete flags.circle_requests;
    expect(ok(AppConfig, { ...rc3Config, featureFlags: flags })).toBe(false);
  });
});

describe('deep link for the ayah of the day', () => {
  it('opens the reader at an ayah, with the app route the reader already uses', () => {
    const link = { type: 'quran', surah: 2, ayah: 255 } as const;
    expect(buildDeepLink(link)).toBe('qurancircles://quran?surah=2&ayah=255');
    expect(buildDeepLink(link, 'https://example.org/')).toBe(
      'https://example.org/quran?surah=2&ayah=255',
    );
    expect(parseDeepLink(buildDeepLink(link))).toEqual(link);
    expect(parseDeepLink(buildDeepLink(link, 'https://example.org'))).toEqual(link);
    expect(parseDeepLink('qurancircles://quran?surah=0&ayah=1')).toBeNull();
    expect(parseDeepLink('qurancircles://quran')).toBeNull();
  });
});

describe('rc.4 endpoints in the registry', () => {
  const expected = {
    'readingDays.record': ['POST', '/v1/me/reading-days', 'user', ['reading.manage'], 200, true],
    'readingDays.list': ['GET', '/v1/me/reading-days', 'user', ['reading.manage'], 200, true],
    'memorisation.list': ['GET', '/v1/me/memorisation', 'user', ['memorisation.manage'], 200, true],
    'memorisation.put': [
      'PUT',
      '/v1/me/memorisation/{surah}',
      'user',
      ['memorisation.manage'],
      200,
      true,
    ],
    'memorisation.delete': [
      'DELETE',
      '/v1/me/memorisation/{surah}',
      'user',
      ['memorisation.manage'],
      204,
      true,
    ],
    'community.today': ['GET', '/v1/community/today', 'public', ['community.read'], 200, true],
    'ayahOfTheDay.get': ['GET', '/v1/ayah-of-the-day', 'public', ['daily_ayah.read'], 200, true],
    'adminDailyAyahs.list': [
      'GET',
      '/v1/admin/daily-ayahs',
      'staff',
      ['daily_ayah.manage'],
      200,
      true,
    ],
    'adminDailyAyahs.put': [
      'PUT',
      '/v1/admin/daily-ayahs',
      'staff',
      ['daily_ayah.manage'],
      200,
      true,
    ],
    'adminDailyAyahs.delete': [
      'DELETE',
      '/v1/admin/daily-ayahs/{dailyAyahId}',
      'staff',
      ['daily_ayah.manage'],
      204,
      true,
    ],
  } as const;

  for (const [id, [method, path, auth, actions, status, idempotent]] of Object.entries(expected)) {
    it(`${id}: ${method} ${path}`, () => {
      const d = endpoints[id as keyof typeof endpoints] as EndpointDef;
      expect(d.method).toBe(method);
      expect(d.path).toBe(path);
      expect(d.auth).toBe(auth);
      expect([...d.actions]).toEqual(actions);
      expect(d.success.status).toBe(status);
      expect(d.idempotent).toBe(idempotent);
      expect(d.rateLimit).toBe('default');
    });
  }

  it('lists not_found where a pick names a place that may not exist', () => {
    expect(errorsFor(endpoints['adminDailyAyahs.put'] as EndpointDef)).toContain('not_found');
    expect(errorsFor(endpoints['adminDailyAyahs.put'] as EndpointDef)).toContain('forbidden');
    expect(errorsFor(endpoints['adminDailyAyahs.delete'] as EndpointDef)).toContain('not_found');
  });

  it('documents the rules the API must apply', () => {
    const text = (id: keyof typeof endpoints) => (endpoints[id] as EndpointDef).description ?? '';
    expect(text('readingDays.record')).toMatch(/out_of_range/);
    expect(text('readingDays.record')).toMatch(/larger of the stored and the sent/);
    expect(text('readingDays.record')).toMatch(/without the user id/);
    expect(text('readingDays.list')).toMatch(/invalid_range/);
    expect(text('ayahOfTheDay.get')).toMatch(/resolveDailyAyah/);
    expect(text('adminDailyAyahs.put')).toMatch(/dailyAyahResource/);
    expect(text('community.today')).toMatch(/no city, venue or circle breakdown/);
  });

  it('sends a public endpoint no token and no personal data in the community total', () => {
    expect(endpoints['community.today'].auth).toBe('public');
    expect((endpoints['community.today'] as EndpointDef).query).toBeUndefined();
  });
});

describe('rc.4 scope rules', () => {
  const CITY_A = fixtureId('city', 901);
  const CITY_B = fixtureId('city', 902);
  const VENUE_A1 = fixtureId('venue', 901);
  const VENUE_A2 = fixtureId('venue', 902);
  const VENUE_B1 = fixtureId('venue', 903);
  const ME = fixtureId('user', 901);
  const OTHER = fixtureId('user', 902);
  const people: Record<string, Principal | null> = {
    anonymous: null,
    attendee: { userId: ME, assignments: [] },
    venueCoordinatorA1: {
      userId: ME,
      assignments: [{ role: 'venue_coordinator', venueId: VENUE_A1 }],
    },
    cityCoordinatorA: { userId: ME, assignments: [{ role: 'city_coordinator', cityId: CITY_A }] },
    nationalAdmin: { userId: ME, assignments: [{ role: 'national_admin' }] },
  };
  const national = dailyAyahResource('national', null);
  const atA1 = dailyAyahResource('venue', { cityId: CITY_A, venueId: VENUE_A1 });
  const atA2 = dailyAyahResource('circle', { cityId: CITY_A, venueId: VENUE_A2 });
  const atB1 = dailyAyahResource('venue', { cityId: CITY_B, venueId: VENUE_B1 });

  // Written out by hand: who may set a pick for which scope.
  const table: Record<string, [national: boolean, a1: boolean, a2: boolean, b1: boolean]> = {
    anonymous: [false, false, false, false],
    attendee: [false, false, false, false],
    venueCoordinatorA1: [false, true, false, false],
    cityCoordinatorA: [false, true, true, false],
    nationalAdmin: [true, true, true, true],
  };

  for (const [who, row] of Object.entries(table)) {
    it(`daily_ayah.manage for ${who}: national ${row[0]}, venue A1 ${row[1]}, circle at A2 ${row[2]}, venue B1 ${row[3]}`, () => {
      const p = people[who]!;
      expect(can(p, 'daily_ayah.manage', national)).toBe(row[0]);
      expect(can(p, 'daily_ayah.manage', atA1)).toBe(row[1]);
      expect(can(p, 'daily_ayah.manage', atA2)).toBe(row[2]);
      expect(can(p, 'daily_ayah.manage', atB1)).toBe(row[3]);
    });
  }

  it('checks a national pick, or a pick with no known place, with no place at all', () => {
    expect(national).toEqual({});
    expect(dailyAyahResource('venue', null)).toEqual({});
    expect(atA1).toEqual({ cityId: CITY_A, venueId: VENUE_A1 });
    expect(ACTIONS['daily_ayah.manage'].level).toBe('venue');
    expect(ACTIONS['daily_ayah.manage'].roles).toEqual([
      'national_admin',
      'city_coordinator',
      'venue_coordinator',
    ]);
  });

  it('filters the admin list to each role scope', () => {
    expect(scopeFilter(people.nationalAdmin!, 'daily_ayah.manage').national).toBe(true);
    expect(scopeFilter(people.cityCoordinatorA!, 'daily_ayah.manage').cityIds).toEqual([CITY_A]);
    expect(scopeFilter(people.venueCoordinatorA1!, 'daily_ayah.manage').venueIds).toEqual([
      VENUE_A1,
    ]);
    expect(scopeFilter(people.attendee!, 'daily_ayah.manage')).toEqual({
      national: false,
      cityIds: [],
      venueIds: [],
    });
  });

  it('keeps days read and memorisation private to the person, for every role', () => {
    for (const action of ['reading.manage', 'memorisation.manage'] as const) {
      expect(ACTIONS[action].level).toBe('self');
      for (const [who, p] of Object.entries(people)) {
        expect(can(p, action, { ownerUserId: OTHER }), `${who} other`).toBe(false);
        expect(can(p, action, { ownerUserId: ME }), `${who} own`).toBe(p !== null);
      }
    }
  });

  it('opens the community total and the ayah of the day to everyone', () => {
    for (const action of ['community.read', 'daily_ayah.read'] as const) {
      expect(ACTIONS[action].level).toBe('public');
      for (const p of Object.values(people)) expect(can(p, action)).toBe(true);
    }
  });
});

describe('mock server, rc.4 endpoints', () => {
  const mock = createMockHandler();
  const call = async (
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ): Promise<{ status: number; data: unknown }> => {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await mock(
      new Request(`http://mock.test${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  };
  const issues = (data: unknown) => ApiError.parse(data).error.issues;

  it('records a day read and merges it with what the day already holds', async () => {
    const r = await call('POST', '/v1/me/reading-days', 'mock-user', {
      source: 'manual',
      pages: 1,
    });
    expect(r.status).toBe(200);
    expect(ReadingDay.parse(r.data)).toEqual({
      date: '2027-02-15',
      sources: ['reader', 'manual', 'portion'],
      pages: 3,
      ayahs: 42,
    });
    const yesterday = await call('POST', '/v1/me/reading-days', 'mock-user', {
      source: 'goal',
      date: '2027-02-14',
      pages: 2,
    });
    expect(yesterday.data).toEqual({ date: '2027-02-14', sources: ['goal'], pages: 2, ayahs: 0 });
  });

  it('refuses a day read that is not today or yesterday, attendance, or no sign-in', async () => {
    const old = await call('POST', '/v1/me/reading-days', 'mock-user', {
      source: 'manual',
      date: '2027-02-10',
    });
    expect(old.status).toBe(400);
    expect(issues(old.data)).toEqual([{ path: 'date', code: 'out_of_range' }]);
    const attendance = await call('POST', '/v1/me/reading-days', 'mock-user', {
      source: 'attendance',
    });
    expect(attendance.status).toBe(400);
    expect(
      (await call('POST', '/v1/me/reading-days', undefined, { source: 'manual' })).status,
    ).toBe(401);
  });

  it('lists own days in a range and refuses a bad range', async () => {
    const week = await call(
      'GET',
      '/v1/me/reading-days?from=2027-02-09&to=2027-02-15',
      'mock-user',
    );
    expect(week.status).toBe(200);
    expect((week.data as { items: { date: string }[] }).items.map((d) => d.date)).toEqual([
      '2027-02-11',
      '2027-02-12',
      '2027-02-13',
      '2027-02-15',
    ]);
    const back = await call(
      'GET',
      '/v1/me/reading-days?from=2027-02-15&to=2027-02-09',
      'mock-user',
    );
    expect(back.status).toBe(400);
    expect(issues(back.data)).toEqual([{ path: 'from', code: 'invalid_range' }]);
    const long = await call(
      'GET',
      '/v1/me/reading-days?from=2026-01-01&to=2027-02-15',
      'mock-user',
    );
    expect(issues(long.data)).toEqual([{ path: 'to', code: 'too_big' }]);
    expect((await call('GET', '/v1/me/reading-days?from=2027-02-09', 'mock-user')).status).toBe(
      400,
    );
  });

  it('serves the national total without a token', async () => {
    const r = await call('GET', '/v1/community/today');
    expect(r.status).toBe(200);
    expect(r.data).toEqual(fx.fixtureCommunityToday);
  });

  it('resolves the ayah of the day from the follows sent', async () => {
    const plain = await call('GET', '/v1/ayah-of-the-day');
    expect(plain.data).toMatchObject({
      date: '2027-02-15',
      surah: 2,
      ayah: 255,
      source: 'national',
    });
    const venue1 = fixtureId('venue', 1);
    const followed = await call('GET', `/v1/ayah-of-the-day?venueId=${venue1}`);
    expect(followed.data).toMatchObject({ surah: 13, ayah: 28, source: 'venue', venueId: venue1 });
    const two = await call(
      'GET',
      `/v1/ayah-of-the-day?venueId=${venue1}&venueId=${fixtureId('venue', 5)}`,
    );
    expect(two.data).toMatchObject({ source: 'national' });
    const circle = await call(
      'GET',
      `/v1/ayah-of-the-day?date=2027-02-16&circleId=${fixtureId('circle', 1)}`,
    );
    expect(circle.data).toMatchObject({ surah: 73, ayah: 4, source: 'circle' });
    const empty = await call('GET', '/v1/ayah-of-the-day?date=2027-03-01');
    expect(empty.data).toMatchObject({ source: 'built_in', ...builtInAyahFor('2027-03-01') });
    expect((await call('GET', '/v1/ayah-of-the-day?venueId=nope')).status).toBe(400);
  });

  it('keeps the memorisation tracker per person, with the default setting', async () => {
    const list = await call('GET', '/v1/me/memorisation', 'mock-user');
    expect(list.status).toBe(200);
    const parsed = MemorisationResponse.parse(list.data);
    expect(parsed.reviseAfterDays).toBe(14);
    expect(parsed.items.map((m) => m.surah)).toEqual([1, 36, 67, 112]);

    const learnt = await call('PUT', '/v1/me/memorisation/36', 'mock-user', {
      status: 'memorised',
    });
    expect(learnt.data).toMatchObject({
      surah: 36,
      status: 'memorised',
      lastRevisedAt: fx.FIXTURE_NOW,
    });
    const kept = await call('PUT', '/v1/me/memorisation/112', 'mock-user', { status: 'memorised' });
    expect(kept.data).toMatchObject({ lastRevisedAt: '2027-01-02T16:00:00Z' });
    const revised = await call('PUT', '/v1/me/memorisation/112', 'mock-user', {
      status: 'memorised',
      markRevised: true,
    });
    expect(revised.data).toMatchObject({ lastRevisedAt: fx.FIXTURE_NOW });

    expect((await call('DELETE', '/v1/me/memorisation/36', 'mock-user')).status).toBe(204);
    expect(
      (await call('PUT', '/v1/me/memorisation/115', 'mock-user', { status: 'learning' })).status,
    ).toBe(400);
    expect((await call('GET', '/v1/me/memorisation')).status).toBe(401);
  });

  describe('admin picks, by role', () => {
    const al = fx.venues[0]!; // Rawalpindi
    const lahore = fx.venues[4]!;
    const put = (token: string, scope: unknown) =>
      call('PUT', '/v1/admin/daily-ayahs', token, {
        date: '2027-02-20',
        surah: 94,
        ayah: 6,
        scope,
      });

    it('lets only a national admin set a national pick', async () => {
      expect((await put('mock-staff', { type: 'national' })).status).toBe(200);
      expect((await put('mock-city', { type: 'national' })).status).toBe(403);
      expect((await put('mock-venue', { type: 'national' })).status).toBe(403);
      expect((await put('mock-user', { type: 'national' })).status).toBe(403);
    });

    it('lets each coordinator set picks only inside their scope', async () => {
      const own = await put('mock-venue', { type: 'venue', venueId: al.id });
      expect(own.status).toBe(200);
      expect(DailyAyahEntry.parse(own.data)).toMatchObject({
        scopeType: 'venue',
        venueId: al.id,
        cityId: al.cityId,
        circleId: null,
        surah: 94,
        ayah: 6,
      });
      expect((await put('mock-venue', { type: 'venue', venueId: lahore.id })).status).toBe(403);
      expect((await put('mock-city', { type: 'venue', venueId: al.id })).status).toBe(200);
      expect((await put('mock-city', { type: 'venue', venueId: lahore.id })).status).toBe(403);
      expect((await put('mock-staff', { type: 'venue', venueId: lahore.id })).status).toBe(200);
      const circle = await put('mock-venue', { type: 'circle', circleId: fixtureId('circle', 1) });
      expect(circle.data).toMatchObject({ scopeType: 'circle', venueId: al.id });
      expect(
        (await put('mock-venue', { type: 'circle', circleId: fixtureId('circle', 2) })).status,
      ).toBe(403);
    });

    it('answers not_found for an unknown place and validation_failed for a wrong ayah', async () => {
      expect(
        (await put('mock-staff', { type: 'venue', venueId: fixtureId('venue', 999) })).status,
      ).toBe(404);
      expect(
        (await put('mock-staff', { type: 'circle', circleId: fixtureId('circle', 999) })).status,
      ).toBe(404);
      const bad = await call('PUT', '/v1/admin/daily-ayahs', 'mock-staff', {
        date: '2027-02-20',
        surah: 103,
        ayah: 4,
        scope: { type: 'national' },
      });
      expect(bad.status).toBe(400);
    });

    it('replaces the existing pick for the same date and scope', async () => {
      const r = await call('PUT', '/v1/admin/daily-ayahs', 'mock-staff', {
        date: '2027-02-15',
        surah: 1,
        ayah: 1,
        scope: { type: 'national' },
      });
      expect((r.data as { id: string }).id).toBe(fixtureId('dailyAyah', 1));
    });

    it('lists national picks for everyone and place picks in scope', async () => {
      const q = '/v1/admin/daily-ayahs?from=2027-02-14&to=2027-02-16';
      const ids = async (token: string) =>
        ((await call('GET', q, token)).data as { items: { id: string }[] }).items.map((x) => x.id);
      const n = (k: number) => fixtureId('dailyAyah', k);
      expect(await ids('mock-staff')).toEqual([n(1), n(2), n(3), n(4), n(5)]);
      expect(await ids('mock-city')).toEqual([n(1), n(2), n(3), n(4)]);
      expect(await ids('mock-venue')).toEqual([n(1), n(2), n(3), n(4)]);
      expect((await call('GET', q, 'mock-user')).status).toBe(403);
      expect((await call('GET', q)).status).toBe(401);
      const filtered = await call('GET', `${q}&scopeType=circle`, 'mock-staff');
      expect((filtered.data as { items: unknown[] }).items).toHaveLength(1);
      const backwards = await call(
        'GET',
        '/v1/admin/daily-ayahs?from=2027-02-16&to=2027-02-14',
        'mock-staff',
      );
      expect(backwards.status).toBe(400);
    });

    it('removes a pick only inside the caller scope', async () => {
      const del = (token: string, k: number) =>
        call('DELETE', `/v1/admin/daily-ayahs/${fixtureId('dailyAyah', k)}`, token);
      expect((await del('mock-venue', 1)).status).toBe(403);
      expect((await del('mock-city', 1)).status).toBe(403);
      expect((await del('mock-staff', 1)).status).toBe(204);
      expect((await del('mock-venue', 3)).status).toBe(204);
      expect((await del('mock-venue', 5)).status).toBe(403);
      expect((await del('mock-city', 5)).status).toBe(403);
      expect((await del('mock-city', 4)).status).toBe(204);
    });

    it('answers not_found for an unknown pick, for every staff role (rc.4 changelog)', async () => {
      const unknown = `/v1/admin/daily-ayahs/${fixtureId('dailyAyah', 999)}`;
      for (const token of ['mock-staff', 'mock-city', 'mock-venue']) {
        const r = await call('DELETE', unknown, token);
        expect(r.status, token).toBe(404);
        expect(ApiError.parse(r.data).error.code).toBe('not_found');
      }
      // No role at all still learns nothing.
      expect((await call('DELETE', unknown, 'mock-user')).status).toBe(403);
      expect((await call('DELETE', unknown)).status).toBe(401);
    });
  });

  it('turns the rc.4 feature flags on in the mock config', async () => {
    const r = await call('GET', '/v1/config');
    const config = AppConfig.parse(r.data);
    for (const f of NEXT_FEATURE_FLAGS) expect(featureOn(config.featureFlags, f)).toBe(true);
  });
});

describe('typed client, rc.4 endpoints', () => {
  const mock = createMockHandler();
  const api = createApiClient({
    baseUrl: 'http://mock.test',
    getAccessToken: () => 'mock-user',
    fetch: (async (url: string | URL | Request, init?: RequestInit) =>
      mock(new Request(url as string, init))) as typeof fetch,
  });

  it('fills the surah path parameter and parses the answer', async () => {
    const entry = await api.memorisation.put({
      params: { surah: 18 },
      body: { status: 'learning' },
    });
    expect(entry).toMatchObject({ surah: 18, status: 'learning', lastRevisedAt: null });
    await expect(api.memorisation.delete({ params: { surah: 18 } })).resolves.toBeUndefined();
  });

  it('reads the ayah of the day with followed places and the national total', async () => {
    const ayah = await api.ayahOfTheDay.get({ query: { venueId: [fixtureId('venue', 1)] } });
    expect(ayah.source).toBe('venue');
    const today = await api.community.today();
    expect(today.readersToday).toBe(1240);
    const days = await api.readingDays.list({ query: { from: '2027-02-15', to: '2027-02-15' } });
    expect(days.items).toHaveLength(1);
  });

  it('refuses a bad body before it is sent', async () => {
    await expect(
      api.readingDays.record({ body: { source: 'attendance' as 'manual' } }),
    ).rejects.toThrow();
    const err = await api.readingDays
      .record({ body: { source: 'manual', date: '2027-01-01' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).issues).toEqual([{ path: 'date', code: 'out_of_range' }]);
  });
});
