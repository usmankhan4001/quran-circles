import { useCallback, useEffect } from 'react';
import type { Registration } from '@qc/contracts';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuthState, useReminderOptIns } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { useToast } from '../../providers/Toasts';
import { useMyRegistrations } from '../journey/hooks';

/** Keeps the on-device schedule in step with the registrations and the opt-ins. */
export function useReminderSync(): void {
  const { reminders, api, now } = useServices();
  const { t, locale } = useI18n();
  const { status } = useAuthState();
  const optedIn = useReminderOptIns();
  const registrations = useMyRegistrations();
  const data = registrations.data;

  useEffect(() => {
    if (status !== 'signedIn' || !data || !reminders.supported) return;
    void reminders.sync({ api, registrations: data, locale, t, now: now() }).catch(() => undefined);
  }, [status, data, optedIn, reminders, api, locale, t, now]);
}

export function useReminderToggle(sessionId: string) {
  const { reminders, api, now } = useServices();
  const { t, locale } = useI18n();
  const toast = useToast();
  const optedIn = useReminderOptIns();
  const registrations = useMyRegistrations();

  const toggle = useCallback(
    async (next: boolean, extra?: Registration) => {
      const permission = await reminders.setEnabled(sessionId, next);
      if (permission === 'denied') {
        toast.show(t('reminders.denied'), 'warning');
        return;
      }
      if (permission === 'unsupported') return;
      const all = [...(registrations.data ?? [])];
      if (extra && !all.some((r) => r.id === extra.id)) all.push(extra);
      await reminders
        .sync({ api, registrations: all, locale, t, now: now() })
        .catch(() => undefined);
      toast.show(next ? t('reminders.on') : t('reminders.off'), 'success');
    },
    [reminders, sessionId, registrations.data, api, locale, t, now, toast],
  );

  return { enabled: optedIn.has(sessionId), supported: reminders.supported, toggle };
}
