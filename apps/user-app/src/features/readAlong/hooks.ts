import { pakistanDate, type OccurrenceWithSession } from '@qc/contracts';
import { useQuery } from '../../data/useQuery';
import { useAuthStatus } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { followedIds } from '../ayah/useAyahOfTheDay';
import { toInstant } from '../home/useHome';
import { useMyFollows, useMyRegistrations } from '../journey/hooks';
import { useFeature } from '../reading/hooks';
import { todaysPortions, type PortionCandidate, type TodayPortion } from './portion';

/** At most this many followed places are asked about today's sessions. */
export const READ_ALONG_MAX_FOLLOWS = 10;

const PKT_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

/** The instants a Pakistan-time date runs between, as the API's `from` and `to`. */
export function pakistanDayBounds(date: string): { from: string; to: string } {
  const start = Date.parse(`${date}T00:00:00Z`) - PKT_OFFSET_MS;
  return { from: toInstant(new Date(start)), to: toInstant(new Date(start + DAY_MS - 1000)) };
}

/**
 * Today's portions for sessions the person registered for or follows, with `read_along` on and
 * signed in. Registrations come with their next date already; followed venues and circles are
 * asked for today's sessions (a failed one is left out rather than failing the card).
 */
export function useTodayPortions(): { enabled: boolean; portions: TodayPortion[] } {
  const { api, now } = useServices();
  const status = useAuthStatus();
  const feature = useFeature('read_along');
  const enabled = feature.on && status === 'signedIn';
  const registrations = useMyRegistrations();
  const follows = useMyFollows();
  const today = pakistanDate(now());
  const ids = followedIds(follows.data);
  const targets = [
    ...ids.venueId.map((venueId) => ({ venueId })),
    ...ids.circleId.map((circleId) => ({ circleId })),
  ].slice(0, READ_ALONG_MAX_FOLLOWS);
  const followed = useQuery<OccurrenceWithSession[]>(
    enabled && follows.data && targets.length > 0
      ? `me:readAlong:${today}:${targets.map((t) => Object.values(t)[0]).join(',')}`
      : null,
    async () => {
      const bounds = pakistanDayBounds(today);
      const answers = await Promise.allSettled(
        targets.map((target) =>
          api.occurrences.list({ query: { ...target, ...bounds, limit: 10 } }),
        ),
      );
      return answers.flatMap((a) => (a.status === 'fulfilled' ? a.value.items : []));
    },
    { staleMs: 5 * 60_000 },
  );

  if (!enabled) return { enabled: false, portions: [] };
  const candidates: PortionCandidate[] = [];
  for (const registration of registrations.data ?? []) {
    const occurrence = registration.session.nextOccurrence;
    if (registration.status !== 'confirmed' || !occurrence) continue;
    if (registration.occurrenceId && registration.occurrenceId !== occurrence.id) continue;
    candidates.push({ occurrence, session: registration.session, via: 'registration' });
  }
  for (const item of followed.data ?? []) {
    const { session, ...occurrence } = item;
    candidates.push({ occurrence, session, via: 'follow' });
  }
  return { enabled: true, portions: todaysPortions(candidates, now()) };
}
