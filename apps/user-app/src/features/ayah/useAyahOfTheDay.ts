import { builtInAyahFor, pakistanDate, type AyahOfTheDay, type Follow } from '@qc/contracts';
import { useQuery } from '../../data/useQuery';
import { useAuthStatus } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { ayahOfTheDay, type AyahPlace } from '../home/ayah';
import { useMyFollows } from '../journey/hooks';
import { useFeature } from '../reading/hooks';

/** The most ids of each kind `GET /v1/ayah-of-the-day` takes (`AyahOfTheDayQuery`). */
export const MAX_FOLLOWED_IDS = 50;

/** The venues and circles a person follows, as the endpoint's `venueId` and `circleId` lists. */
export function followedIds(follows: readonly Follow[] | undefined): {
  venueId: string[];
  circleId: string[];
} {
  const venueId = new Set<string>();
  const circleId = new Set<string>();
  for (const follow of follows ?? []) {
    if (follow.venueId) venueId.add(follow.venueId);
    if (follow.circleId) circleId.add(follow.circleId);
  }
  return {
    venueId: [...venueId].sort().slice(0, MAX_FOLLOWED_IDS),
    circleId: [...circleId].sort().slice(0, MAX_FOLLOWED_IDS),
  };
}

export interface DailyAyah extends AyahPlace {
  /** Where the pick came from; absent when the feature is off and the app picks it itself. */
  source?: AyahOfTheDay['source'];
  venueId?: string | null;
  circleId?: string | null;
}

/**
 * The ayah for Home's card.
 * - `ayah_of_the_day` on: the server's pick for today (`resolveDailyAyah`), sent the ids the
 *   person follows so a coordinator's pick for their masjid or circle can win. When the call
 *   fails with nothing saved, the contract's built-in list for today, which is the server's own
 *   last fallback.
 * - Off: the place the app showed before rc.4 (`ayahOfTheDay`), with no source line.
 * `ayah` is null while the flag, the follows or the pick are still on their way.
 */
export function useAyahOfTheDay(): { ayah: DailyAyah | null; enabled: boolean } {
  const { api, now } = useServices();
  const status = useAuthStatus();
  const feature = useFeature('ayah_of_the_day');
  const follows = useMyFollows();
  const today = pakistanDate(now());
  const waitingForFollows = status === 'signedIn' && follows.status === 'loading';
  const ids = followedIds(follows.data);
  const personal = ids.venueId.length > 0 || ids.circleId.length > 0;
  const key =
    feature.on && !waitingForFollows
      ? `ayah:today:${today}:${ids.venueId.join(',')}:${ids.circleId.join(',')}`
      : null;
  const query = useQuery<AyahOfTheDay>(
    key,
    () =>
      api.ayahOfTheDay.get({
        query: {
          ...(ids.venueId.length > 0 ? { venueId: ids.venueId } : {}),
          ...(ids.circleId.length > 0 ? { circleId: ids.circleId } : {}),
        },
      }),
    // Which places someone follows is personal, so only the plain national pick is saved.
    { persist: !personal, staleMs: 10 * 60_000 },
  );

  if (!feature.settled) return { ayah: null, enabled: false };
  if (!feature.on) return { ayah: ayahOfTheDay(now()), enabled: false };
  if (query.data) {
    const { surah, ayah, source, venueId, circleId } = query.data;
    return { ayah: { surah, ayah, source, venueId, circleId }, enabled: true };
  }
  if (query.status === 'error') {
    return {
      ayah: { ...builtInAyahFor(today), source: 'built_in', venueId: null, circleId: null },
      enabled: true,
    };
  }
  return { ayah: null, enabled: true };
}
