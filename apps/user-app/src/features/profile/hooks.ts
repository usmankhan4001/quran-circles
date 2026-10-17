import { useCallback } from 'react';
import { consentGranted, type Consent, type Follow, type ProfileUpdate } from '@qc/contracts';
import { useAction } from '../../data/useAction';
import { useQuery } from '../../data/useQuery';
import { useAuthState } from '../../providers/hooks';
import { useServices } from '../../providers/services';

export function useConsents() {
  const { api } = useServices();
  const { status } = useAuthState();
  return useQuery<Consent[]>(
    status === 'signedIn' ? 'me:consents' : null,
    async () => (await api.consents.list()).items,
    { staleMs: 15_000 },
  );
}

/** WhatsApp consents that are on right now. */
export function activeWhatsappConsents(consents: readonly Consent[] | undefined): Consent[] {
  return (consents ?? []).filter((c) => c.channel === 'whatsapp' && c.revokedAt === null);
}

/**
 * One switch for WhatsApp messages. Turning it off revokes every WhatsApp consent at once ("one
 * tap stops messages"). Turning it on grants session reminders only; the rest stay explicit
 * choices made at registration or per venue.
 */
export function useWhatsappConsent() {
  const { api, cache } = useServices();
  const consents = useConsents();
  const active = activeWhatsappConsents(consents.data);
  const change = useAction(async (enabled: boolean) => {
    if (enabled) {
      await api.consents.set({
        body: { channel: 'whatsapp', purpose: 'session_reminders', granted: true },
      });
    } else {
      for (const consent of active) {
        await api.consents.set({
          body: {
            channel: 'whatsapp',
            purpose: consent.purpose,
            venueId: consent.venueId,
            granted: false,
          },
        });
      }
    }
    cache.invalidate('me:consents');
  });
  return { query: consents, enabled: active.length > 0, change };
}

export function useAlertToggle() {
  const { api, cache } = useServices();
  return useAction(async (follow: Follow, alertsEnabled: boolean) => {
    const updated = await api.follows.update({
      params: { followId: follow.id },
      body: { alertsEnabled },
    });
    cache.invalidate('me:follows');
    return updated;
  });
}

export function useProfileName() {
  const { api, auth } = useServices();
  return useAction(async (displayName: string) => {
    const me = await api.me.update({ body: { displayName } });
    auth.setMe(me);
    return me;
  });
}

export function useLocaleSync() {
  const { api } = useServices();
  const { status } = useAuthState();
  return useCallback(
    async (locale: 'en' | 'ur') => {
      if (status !== 'signedIn') return;
      await api.me.update({ body: { locale } }).catch(() => undefined);
    },
    [api, status],
  );
}

/** The person's `ayah_daily` push rows (rc.4): push only, never per venue. */
export function ayahConsentRows(consents: readonly Consent[] | undefined): Consent[] {
  return (consents ?? []).filter(
    (c) => c.channel === 'push' && c.purpose === 'ayah_daily' && c.venueId === null,
  );
}

/**
 * The morning ayah notification switch (feature 2). On by default: no row means on, a revoked
 * row means off (`consentGranted`). Changing it writes one `consents.set` for push and
 * `ayah_daily`, with no venue.
 */
export function useAyahNotification() {
  const { api, cache } = useServices();
  const consents = useConsents();
  const enabled = consentGranted('push', 'ayah_daily', ayahConsentRows(consents.data));
  const change = useAction(async (granted: boolean) => {
    await api.consents.set({ body: { channel: 'push', purpose: 'ayah_daily', granted } });
    cache.invalidate('me:consents');
  });
  return { query: consents, enabled, change };
}

/** Saves reading settings on the profile (daily goal, revise-after) and keeps `me` in step. */
export function useProfileSettings() {
  const { api, auth } = useServices();
  return useAction(
    async (change: Pick<ProfileUpdate, 'dailyGoal' | 'memorisationReviseAfterDays'>) => {
      const me = await api.me.update({ body: change });
      auth.setMe(me);
      return me;
    },
  );
}
