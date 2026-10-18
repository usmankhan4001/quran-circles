import { useCallback } from 'react';
import type { Follow, Registration } from '@qc/contracts';
import { useAction } from '../../data/useAction';
import { useQuery } from '../../data/useQuery';
import { useAuthStatus } from '../../providers/hooks';
import { useServices } from '../../providers/services';

/** Own registrations that are still ahead. Personal, so never saved on the device. */
export function useMyRegistrations() {
  const { api } = useServices();
  const status = useAuthStatus();
  return useQuery<Registration[]>(
    status === 'signedIn' ? 'me:registrations' : null,
    async () =>
      (await api.registrations.listMine({ query: { upcomingOnly: 'true', limit: 50 } })).items,
    { staleMs: 15_000 },
  );
}

export function useMyFollows() {
  const { api } = useServices();
  const status = useAuthStatus();
  return useQuery<Follow[]>(
    status === 'signedIn' ? 'me:follows' : null,
    async () => (await api.follows.list()).items,
    { staleMs: 15_000 },
  );
}

export function useCancelRegistration() {
  const { api, cache } = useServices();
  return useAction(async (registrationId: string) => {
    const cancelled = await api.registrations.cancel({ params: { registrationId } });
    cache.invalidate('me:');
    return cancelled;
  });
}

export function useFollowActions() {
  const { api, cache } = useServices();
  const follow = useAction(async (target: { venueId: string } | { circleId: string }) => {
    const created = await api.follows.create({
      body:
        'venueId' in target
          ? { target: 'venue', venueId: target.venueId, alertsEnabled: true }
          : { target: 'circle', circleId: target.circleId, alertsEnabled: true },
    });
    cache.invalidate('me:follows');
    return created;
  });
  const unfollow = useAction(async (followId: string) => {
    await api.follows.delete({ params: { followId } });
    cache.invalidate('me:follows');
  });
  const setAlerts = useAction(async (followId: string, alertsEnabled: boolean) => {
    const updated = await api.follows.update({ params: { followId }, body: { alertsEnabled } });
    cache.invalidate('me:follows');
    return updated;
  });
  return { follow, unfollow, setAlerts };
}

/** The follow for a venue, if the person has one. */
export function findVenueFollow(
  follows: readonly Follow[] | undefined,
  venueId: string,
): Follow | undefined {
  return follows?.find((f) => f.venueId === venueId);
}

export function useIsFollowing(venueId: string): {
  follow: Follow | undefined;
  toggle: () => Promise<void>;
} {
  const follows = useMyFollows();
  const { follow: followAction, unfollow } = useFollowActions();
  const follow = findVenueFollow(follows.data, venueId);
  const toggle = useCallback(async () => {
    if (follow) await unfollow.run(follow.id);
    else await followAction.run({ venueId });
  }, [follow, unfollow, followAction, venueId]);
  return { follow, toggle };
}
