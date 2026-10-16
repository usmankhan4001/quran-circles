import type { ApiClient, Locale, Occurrence, Registration } from '@qc/contracts';
import { Observable } from '../../core/observable';
import { readJson, writeJson, type KeyValueStore } from '../../core/storage';
import type { TFunction } from '../../i18n/translate';
import { pickLocalized } from '../../i18n/localized';
import { formatClockTime } from '../../core/format';
import { planReminders } from './plan';
import type { PermissionResult, PushRegistrar, ReminderScheduler } from './types';

export const REMINDERS_KEY = 'qc.reminders.v1';
export const DEVICE_KEY = 'qc.device.v1';

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Per-session reminder opt-ins and the on-device schedule. Reminders are free and work
 * offline, so they come first; WhatsApp is only a fallback decided on the server.
 */
export class RemindersService {
  private readonly optedIn = new Observable<ReadonlySet<string>>(new Set());

  constructor(
    private readonly storage: KeyValueStore,
    private readonly scheduler: ReminderScheduler,
  ) {}

  get supported(): boolean {
    return this.scheduler.isSupported();
  }

  getOptedIn = (): ReadonlySet<string> => this.optedIn.get();
  subscribe = (listener: () => void): (() => void) => this.optedIn.subscribe(listener);

  async load(): Promise<void> {
    const ids = await readJson(this.storage, REMINDERS_KEY, isIdList);
    if (ids) this.optedIn.set(new Set(ids));
  }

  isEnabled(sessionId: string): boolean {
    return this.optedIn.get().has(sessionId);
  }

  /** Switches reminders for one session. Turning on asks for permission once. */
  async setEnabled(sessionId: string, enabled: boolean): Promise<PermissionResult> {
    let permission: PermissionResult = 'granted';
    if (enabled) {
      permission = await this.scheduler.requestPermission();
      if (permission !== 'granted') return permission;
    }
    const next = new Set(this.optedIn.get());
    if (enabled) next.add(sessionId);
    else next.delete(sessionId);
    this.optedIn.set(next);
    await writeJson(this.storage, REMINDERS_KEY, [...next]);
    return permission;
  }

  /** Forgets every opt-in and cancels every scheduled reminder: after sign-out or deletion. */
  async reset(): Promise<void> {
    this.optedIn.set(new Set());
    await this.storage.remove(REMINDERS_KEY).catch(() => undefined);
    await this.scheduler.cancelAll();
  }

  /**
   * Reads the coming occurrences of the sessions with reminders on and schedules them.
   * Call after the registrations load and when the app comes to the front.
   */
  async sync(input: {
    api: ApiClient;
    registrations: readonly Registration[];
    locale: Locale;
    t: TFunction;
    now: Date;
  }): Promise<number> {
    if (!this.scheduler.isSupported()) return 0;
    const optedIn = this.optedIn.get();
    const sessionIds = [
      ...new Set(
        input.registrations
          .filter((r) => r.status === 'confirmed' && optedIn.has(r.sessionId))
          .map((r) => r.sessionId),
      ),
    ];
    const occurrences: Record<string, Occurrence[]> = {};
    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const result = await input.api.sessions.occurrences({
          params: { sessionId },
          query: { from: input.now.toISOString().replace(/\.\d+Z$/, 'Z'), limit: 10 },
        });
        occurrences[sessionId] = result.items;
      }),
    );
    const plan = planReminders({
      registrations: input.registrations,
      occurrences,
      optedIn,
      now: input.now,
    });
    const sessions = new Map(input.registrations.map((r) => [r.sessionId, r.session]));
    await this.scheduler.replaceAll(
      plan.map((p) => {
        const session = sessions.get(p.sessionId);
        const title = session ? pickLocalized(session.title, input.locale).text : '';
        const venue = session ? pickLocalized(session.venue.name, input.locale).text : '';
        return {
          id: p.id,
          fireAt: p.fireAt,
          sessionId: p.sessionId,
          title: input.t('notifications.sessionReminder.title'),
          body: input.t('notifications.sessionReminder.body', {
            title,
            venue,
            time: formatClockTime(p.startsAt, session?.timezone ?? 'Asia/Karachi', input.locale),
          }),
        };
      }),
    );
    return plan.length;
  }
}

function isDeviceRecord(value: unknown): value is { deviceId: string } {
  return typeof value === 'object' && value !== null && typeof (value as { deviceId?: unknown }).deviceId === 'string';
}

/** Push registration with the contract's device endpoint. */
export class PushService {
  constructor(
    private readonly storage: KeyValueStore,
    private readonly registrar: PushRegistrar,
  ) {}

  get supported(): boolean {
    return this.registrar.isSupported();
  }

  async isEnabled(): Promise<boolean> {
    return (await readJson(this.storage, DEVICE_KEY, isDeviceRecord)) !== undefined;
  }

  /** Asks permission, gets the token and registers it. Registering again refreshes it. */
  async enable(api: ApiClient, locale: Locale): Promise<PermissionResult> {
    const result = await this.registrar.register(locale);
    if (result === 'denied' || result === 'unsupported') return result;
    const device = await api.devices.register({
      body: { platform: result.platform, provider: result.provider, token: result.token, locale },
    });
    await writeJson(this.storage, DEVICE_KEY, { deviceId: device.id });
    return 'granted';
  }

  async disable(api: ApiClient): Promise<void> {
    const record = await readJson(this.storage, DEVICE_KEY, isDeviceRecord);
    if (record) {
      await api.devices.remove({ params: { deviceId: record.deviceId } });
    }
    await this.storage.remove(DEVICE_KEY).catch(() => undefined);
  }
}
