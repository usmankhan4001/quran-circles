import {
  featureOn,
  type CommunityToday,
  type FeatureFlagKey,
  type ReadingDay,
  type ReadingDayRecord,
} from '@qc/contracts';
import { useAction } from '../../data/useAction';
import { useCacheEntry } from '../../data/useCacheEntry';
import { useQuery } from '../../data/useQuery';
import { useAuthStatus } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { useAppConfig } from '../config/useAppConfig';
import {
  mergeReadingDay,
  readingRange,
  recordReadingDay,
  summariseReadingDays,
  todayInPakistan,
  type RecordOutcome,
} from './days';

/**
 * Whether one of the rc.4 features is on for the person's city. `settled` is false while the
 * first `config.get` is still on its way, so a card does not flash in and out; a failed call
 * leaves every flag off (missing is off, `featureOn`).
 */
export function useFeature(key: FeatureFlagKey): { on: boolean; settled: boolean } {
  const config = useAppConfig();
  return { on: featureOn(config.featureFlags, key), settled: config.status !== 'loading' };
}

const readingKey = (from: string, to: string) => `me:readingDays:${from}:${to}`;

/**
 * The person's days read this week and this month. Personal, so kept in memory only and only
 * while signed in with `reading_days` on. A day recorded on this phone shows at once.
 */
export function useReadingDays() {
  const { api, now } = useServices();
  const status = useAuthStatus();
  const feature = useFeature('reading_days');
  const today = todayInPakistan(now());
  const range = readingRange(today);
  const key = status === 'signedIn' && feature.on ? readingKey(range.from, range.to) : null;
  const query = useQuery<ReadingDay[]>(
    key,
    async () => (await api.readingDays.list({ query: range })).items,
    { staleMs: 60_000 },
  );
  // A day recorded here is written into the cache entry, so read the entry itself.
  const days = useCacheEntry<ReadingDay[]>(key) ?? query.data;
  return {
    query,
    enabled: feature.on,
    summary: days ? summariseReadingDays(days, today) : undefined,
  };
}

/**
 * Records a day read and puts the answer in the week and month counts. Never throws; a failed
 * call is in `error`, and a date the server would refuse comes back as `out_of_range`.
 */
export function useRecordReadingDay() {
  const { api, cache, now } = useServices();
  return useAction(async (body: ReadingDayRecord): Promise<RecordOutcome> => {
    const outcome = await recordReadingDay(api, body, now());
    if (!outcome.ok) {
      if (outcome.reason === 'failed') throw outcome.error;
      return outcome;
    }
    const range = readingRange(todayInPakistan(now()));
    const key = readingKey(range.from, range.to);
    const known = cache.get<ReadingDay[]>(key)?.data;
    if (known) cache.set(key, mergeReadingDay(known, outcome.day), false);
    // The national total counts this person now; ask for it again next time it shows.
    cache.invalidate('community:');
    return outcome;
  });
}

/** The one national number: people who read today and pages read together. Public. */
export function useCommunityToday() {
  const { api, now } = useServices();
  const feature = useFeature('community_today');
  const query = useQuery<CommunityToday>(
    feature.on ? `community:today:${todayInPakistan(now())}` : null,
    () => api.community.today(),
    { persist: true, staleMs: 60_000 },
  );
  return { query, enabled: feature.on };
}
