import { messages, type MessageKey } from '@qc/i18n';
import { buildDeepLink, outboxKey, type Locale, type PushPayload } from '@qc/contracts';

/** Looks up a string and fills `{placeholders}`. Falls back to English, then to the key itself. */
export function t(locale: Locale, key: MessageKey, vars: Record<string, string> = {}): string {
  const table = messages[locale] as Record<string, string>;
  const fallback = messages.en as Record<string, string>;
  const template = table[key] ?? fallback[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => vars[name] ?? `{${name}}`);
}

/** "Fri 6 Mar, 7:30 pm" in the session's own timezone and the person's language. */
export function formatWhen(startsAt: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
    .format(startsAt)
    .replace(/\u202f/g, ' ');
}

export const reminderKey = (occurrenceId: string, userId: string): string =>
  outboxKey('reminder', occurrenceId, userId, 'push');

/** The occurrence id inside a reminder key, or undefined for any other key. */
export function occurrenceOfKey(key: string): string | undefined {
  const parts = key.split(':');
  return parts.length === 4 && parts[0] === 'reminder' && parts[3] === 'push'
    ? parts[1]
    : undefined;
}

export interface ReminderFacts {
  occurrenceId: string;
  sessionId: string;
  sessionTitle: { en: string; ur: string };
  venueName: { en: string; ur: string };
  startsAt: Date;
  timezone: string;
  fireAt: Date;
}

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

export function buildReminderPush(
  facts: ReminderFacts,
  locale: Locale,
  webBase: string | undefined,
): PushPayload {
  const leadSeconds = Math.floor((facts.startsAt.getTime() - facts.fireAt.getTime()) / 1000);
  return {
    title: t(locale, 'notifications.reminder.title'),
    body: clip(
      t(locale, 'notifications.reminder.body', {
        sessionTitle: facts.sessionTitle[locale],
        venueName: facts.venueName[locale],
        when: formatWhen(facts.startsAt, facts.timezone, locale),
      }),
      500,
    ),
    data: {
      type: 'reminder',
      deepLink: buildDeepLink({ type: 'occurrence', occurrenceId: facts.occurrenceId }, webBase),
      sessionId: facts.sessionId,
      occurrenceId: facts.occurrenceId,
    },
    collapseKey: `reminder:${facts.occurrenceId}`,
    ttlSeconds: Math.min(6 * 3600, Math.max(60, leadSeconds)),
  };
}

/** JSON with sorted keys, so two payloads compare equal whatever order a database returned them in. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
