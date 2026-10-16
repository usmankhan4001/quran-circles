import { z } from 'zod';
import { InstantUtc, Uuid } from './common';
import { CostCategory, Locale, MessageChannel } from './enums';

/**
 * Message formats: outbox payloads, template ids and their variables, push payloads and deep links.
 *
 * Template wording below is a starting point for the admins' approved wording. It is NOT approved by
 * Meta, and every Urdu line is a draft that a native speaker must review before release.
 */

// ---------------------------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------------------------

export const APP_SCHEME = 'qurancircles';

export const DeepLink = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), sessionId: Uuid }),
  z.object({ type: z.literal('occurrence'), occurrenceId: Uuid }),
  /** Opens straight to registration, used by "invite friends and family" share cards. */
  z.object({ type: z.literal('register'), sessionId: Uuid }),
  z.object({ type: z.literal('venue'), venueId: Uuid }),
  z.object({ type: z.literal('circle'), circleId: Uuid }),
  z.object({ type: z.literal('update'), updateId: Uuid }),
  z.object({ type: z.literal('updates') }),
  z.object({ type: z.literal('journey') }),
]);
export type DeepLink = z.infer<typeof DeepLink>;

const linkPath = (link: DeepLink): string => {
  switch (link.type) {
    case 'session':
      return `/session/${link.sessionId}`;
    case 'occurrence':
      return `/occurrence/${link.occurrenceId}`;
    case 'register':
      return `/register/${link.sessionId}`;
    case 'venue':
      return `/venue/${link.venueId}`;
    case 'circle':
      return `/circle/${link.circleId}`;
    case 'update':
      return `/updates/${link.updateId}`;
    case 'updates':
      return '/updates';
    case 'journey':
      return '/journey';
  }
};

/**
 * `webBase` is the public https origin once the domain is chosen, for example
 * `https://example.org`. Without it the link uses the app scheme, `qurancircles://session/<id>`.
 */
export function buildDeepLink(link: DeepLink, webBase?: string): string {
  const path = linkPath(link);
  return webBase ? `${webBase.replace(/\/+$/, '')}${path}` : `${APP_SCHEME}:/${path}`;
}

export function parseDeepLink(url: string): DeepLink | null {
  let path: string;
  try {
    const u = new URL(url);
    path =
      u.protocol === `${APP_SCHEME}:` ? `/${u.host}${u.pathname}`.replace(/\/+$/, '') : u.pathname;
  } catch {
    return null;
  }
  const [, head, arg] = path.split('/');
  const candidates: Record<string, unknown> = {
    session: { type: 'session', sessionId: arg },
    occurrence: { type: 'occurrence', occurrenceId: arg },
    register: { type: 'register', sessionId: arg },
    venue: { type: 'venue', venueId: arg },
    circle: { type: 'circle', circleId: arg },
    updates: arg ? { type: 'update', updateId: arg } : { type: 'updates' },
    journey: { type: 'journey' },
  };
  const parsed = DeepLink.safeParse(head ? candidates[head] : undefined);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

const str = z.string().min(1).max(200);

/** Variables per template. Values are plain strings, already formatted for the recipient's locale. */
export const TEMPLATE_VARIABLES = {
  auth_code: z.object({ code: z.string().regex(/^[0-9]{6}$/), minutes: z.string() }),
  registration_confirmation: z.object({
    name: str,
    sessionTitle: str,
    venueName: str,
    when: str,
    link: z.string(),
  }),
  session_reminder: z.object({ sessionTitle: str, venueName: str, when: str, link: z.string() }),
  session_changed: z.object({ sessionTitle: str, venueName: str, newWhen: str, link: z.string() }),
  session_cancelled: z.object({ sessionTitle: str, when: str, link: z.string() }),
  waitlist_promoted: z.object({ sessionTitle: str, when: str, link: z.string() }),
  coordinator_invite: z.object({ inviterName: str, scopeName: str, link: z.string() }),
  circle_opened: z.object({ areaName: str, circleName: str, link: z.string() }),
} as const;

export type TemplateKey = keyof typeof TEMPLATE_VARIABLES;
export const TEMPLATE_KEYS = Object.keys(TEMPLATE_VARIABLES) as TemplateKey[];
export const TemplateKeySchema = z.enum(TEMPLATE_KEYS as [TemplateKey, ...TemplateKey[]]);
export type TemplateVariables<K extends TemplateKey> = z.infer<(typeof TEMPLATE_VARIABLES)[K]>;

export interface TemplateDef {
  /** Channels allowed to carry it. Push and in-app go first; WhatsApp is the fallback. */
  channels: readonly MessageChannel[];
  /** Meta pricing category used for budgets. */
  costCategory: CostCategory;
  /** Name registered with Meta for this template. Approval is a human step. */
  waTemplateName: string;
  /** Always sent over WhatsApp, whatever the person's push state (codes, confirmations, critical changes). */
  critical: boolean;
  /** Needs the person's WhatsApp consent. Sign-in codes are the exception: the person asked for them. */
  requiresConsent: boolean;
  body: Record<Locale, string>;
  /** Urdu wording is a draft until a native speaker signs it off. */
  urduStatus: 'draft' | 'reviewed';
}

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  auth_code: {
    channels: ['whatsapp', 'sms'],
    costCategory: 'authentication',
    waTemplateName: 'qc_auth_code',
    critical: true,
    requiresConsent: false,
    body: {
      en: '{code} is your Quran Circles code. It works for {minutes} minutes. Do not share it.',
      ur: 'آپ کا قرآن سرکلز کوڈ {code} ہے۔ یہ {minutes} منٹ تک کارآمد ہے۔ اسے کسی کو نہ بتائیں۔',
    },
    urduStatus: 'draft',
  },
  registration_confirmation: {
    channels: ['whatsapp', 'push'],
    costCategory: 'utility',
    waTemplateName: 'qc_registration_confirmation',
    critical: true,
    requiresConsent: true,
    body: {
      en: 'Assalamu alaikum {name}. You are registered for {sessionTitle} at {venueName}, {when}. Details: {link}',
      ur: 'السلام علیکم {name}۔ آپ {venueName} میں {sessionTitle} کے لیے رجسٹر ہو گئے ہیں، {when}۔ تفصیل: {link}',
    },
    urduStatus: 'draft',
  },
  session_reminder: {
    channels: ['push', 'whatsapp'],
    costCategory: 'utility',
    waTemplateName: 'qc_session_reminder',
    critical: false,
    requiresConsent: true,
    body: {
      en: 'Reminder: {sessionTitle} at {venueName}, {when}. {link}',
      ur: 'یاد دہانی: {venueName} میں {sessionTitle}، {when}۔ {link}',
    },
    urduStatus: 'draft',
  },
  session_changed: {
    channels: ['push', 'whatsapp'],
    costCategory: 'utility',
    waTemplateName: 'qc_session_changed',
    critical: true,
    requiresConsent: true,
    body: {
      en: 'Change: {sessionTitle} at {venueName} is now {newWhen}. {link}',
      ur: 'تبدیلی: {venueName} میں {sessionTitle} اب {newWhen} ہو گا۔ {link}',
    },
    urduStatus: 'draft',
  },
  session_cancelled: {
    channels: ['push', 'whatsapp'],
    costCategory: 'utility',
    waTemplateName: 'qc_session_cancelled',
    critical: true,
    requiresConsent: true,
    body: {
      en: 'Cancelled: {sessionTitle}, {when}. {link}',
      ur: 'منسوخ: {sessionTitle}، {when}۔ {link}',
    },
    urduStatus: 'draft',
  },
  waitlist_promoted: {
    channels: ['push', 'whatsapp'],
    costCategory: 'utility',
    waTemplateName: 'qc_waitlist_promoted',
    critical: true,
    requiresConsent: true,
    body: {
      en: 'A seat opened up. You are now registered for {sessionTitle}, {when}. {link}',
      ur: 'ایک نشست خالی ہو گئی۔ اب آپ {sessionTitle} کے لیے رجسٹر ہیں، {when}۔ {link}',
    },
    urduStatus: 'draft',
  },
  coordinator_invite: {
    channels: ['whatsapp', 'sms'],
    costCategory: 'utility',
    waTemplateName: 'qc_coordinator_invite',
    critical: true,
    requiresConsent: false,
    body: {
      en: '{inviterName} invited you to help run {scopeName} on Quran Circles. Sign in with this number: {link}',
      ur: '{inviterName} نے آپ کو قرآن سرکلز پر {scopeName} چلانے کی دعوت دی ہے۔ اسی نمبر سے سائن اِن کریں: {link}',
    },
    urduStatus: 'draft',
  },
  circle_opened: {
    channels: ['push', 'whatsapp'],
    costCategory: 'marketing',
    waTemplateName: 'qc_circle_opened',
    critical: false,
    requiresConsent: true,
    body: {
      en: 'A new circle opened in {areaName}: {circleName}. {link}',
      ur: '{areaName} میں نیا سرکل شروع ہوا: {circleName}۔ {link}',
    },
    urduStatus: 'draft',
  },
};

/** Fills `{name}` placeholders. Throws on a missing variable so a bad send never goes out half-filled. */
export function renderTemplate<K extends TemplateKey>(
  key: K,
  locale: Locale,
  vars: TemplateVariables<K>,
): string {
  const parsed = TEMPLATE_VARIABLES[key].parse(vars) as Record<string, string>;
  return TEMPLATES[key].body[locale].replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = parsed[name];
    if (v === undefined) throw new Error(`Template ${key} is missing variable ${name}`);
    return v;
  });
}

/** Placeholder names a template body uses, in order of first use. */
export function templatePlaceholders(body: string): string[] {
  return [...new Set([...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string))];
}

// ---------------------------------------------------------------------------------------------
// Push and outbox
// ---------------------------------------------------------------------------------------------

export const PushData = z.object({
  type: z.enum([
    'update',
    'reminder',
    'session_changed',
    'session_cancelled',
    'waitlist_promoted',
    'circle_opened',
  ]),
  /** A deep link built by `buildDeepLink`. */
  deepLink: z.string(),
  updateId: Uuid.optional(),
  sessionId: Uuid.optional(),
  occurrenceId: Uuid.optional(),
});

/** What a device receives. Title and body are already in the device's language. */
export const PushPayload = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: PushData,
  /** Replaces an earlier notification with the same key, for example a reminder for one occurrence. */
  collapseKey: z.string().max(100).optional(),
  ttlSeconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 3600)
    .default(6 * 3600),
});
export type PushPayload = z.infer<typeof PushPayload>;

const templatePayload = <K extends TemplateKey>(key: K, channel: 'whatsapp' | 'sms') =>
  z.object({
    channel: z.literal(channel),
    template: z.literal(key),
    locale: Locale,
    variables: TEMPLATE_VARIABLES[key],
  });

/** The `payload` column of `message_outbox`. The worker validates it before every send. */
export const OutboxPayload = z.union([
  z.object({ channel: z.literal('push'), push: PushPayload }),
  ...TEMPLATE_KEYS.map((k) => templatePayload(k, 'whatsapp')),
  templatePayload('auth_code', 'sms'),
  templatePayload('coordinator_invite', 'sms'),
] as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]);
export type OutboxPayload =
  | { channel: 'push'; push: PushPayload }
  | {
      [K in TemplateKey]: {
        channel: 'whatsapp' | 'sms';
        template: K;
        locale: Locale;
        variables: TemplateVariables<K>;
      };
    }[TemplateKey];

/**
 * Idempotency keys make retries and reruns safe. The worker inserts with ON CONFLICT DO NOTHING.
 * Examples: `reminder:<occurrenceId>:<userId>:push`, `registration_confirmation:<registrationId>:whatsapp`.
 */
export const outboxKey = (kind: string, ...parts: string[]): string => [kind, ...parts].join(':');

export const OutboxStatusInfo = z.object({
  status: z.enum(['queued', 'sending', 'sent', 'delivered', 'failed', 'dead']),
  attempts: z.number().int().min(0),
  updatedAt: InstantUtc,
});
