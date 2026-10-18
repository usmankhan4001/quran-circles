import { z } from 'zod';
import { lazy } from './lazy';

/** Primitives shared by every schema. Instants are UTC ISO strings; dates and times are local. */

export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export const Uuid = lazy(() =>
  z.uuid().meta({ examples: ['00000000-0000-4000-8000-000000000001'] }),
);
export type Uuid = z.infer<typeof Uuid>;

/** A phone number in E.164 form, for example +923001234567. Pakistan is +92. */
export const PhoneE164 = lazy(() =>
  z
    .string()
    .regex(E164_PATTERN)
    .meta({ examples: ['+923001234567'], description: 'E.164, for example +923001234567' }),
);
export type PhoneE164 = z.infer<typeof PhoneE164>;

/** A Pakistani mobile number in E.164: +92, then 3, then nine digits (+92 3xx xxxxxxx). */
export const PAKISTAN_MOBILE_PATTERN = /^\+923[0-9]{9}$/;

/** The issue code a well-formed number outside Pakistan's mobile range gets (`validation_failed`). */
export const PHONE_NOT_PAKISTAN_MOBILE = 'phone_not_pakistan_mobile';

/**
 * The number a sign-in code is sent to (SEC-04, owner decision): Pakistani mobile numbers only.
 * A malformed number fails as `PhoneE164` does (`invalid_format`); a well-formed number elsewhere,
 * or a Pakistani landline, gets the issue code `PHONE_NOT_PAKISTAN_MOBILE` (through
 * `issuesFromZod`). Only `RequestCodeBody.phone` uses it; every other phone field stays `PhoneE164`.
 */
export const PakistaniMobilePhone = lazy(() =>
  z
    .string()
    .regex(E164_PATTERN)
    .refine((value) => !E164_PATTERN.test(value) || PAKISTAN_MOBILE_PATTERN.test(value), {
      message: 'only Pakistani mobile numbers (+92 3xx xxxxxxx) can sign in',
      params: { code: PHONE_NOT_PAKISTAN_MOBILE },
    })
    .meta({
      examples: ['+923001234567'],
      description: 'A Pakistani mobile number in E.164: +923 followed by nine digits',
    }),
);
export type PakistaniMobilePhone = z.infer<typeof PakistaniMobilePhone>;

/** An instant in UTC, for example 2027-02-18T01:15:00Z. Show it in Pakistan time (UTC+5). */
export const InstantUtc = lazy(() => z.iso.datetime().meta({ examples: ['2027-02-18T01:15:00Z'] }));
export type InstantUtc = z.infer<typeof InstantUtc>;

export const LocalDate = lazy(() => z.iso.date().meta({ examples: ['2027-02-18'] }));
export type LocalDate = z.infer<typeof LocalDate>;

/** Wall-clock time in the session's timezone, 24 hour clock. */
export const LocalTime = lazy(() =>
  z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    .meta({ examples: ['19:30'], description: 'HH:MM, 24 hour clock' }),
);
export type LocalTime = z.infer<typeof LocalTime>;

/** A day of the week: 0 is Sunday, 6 is Saturday. */
export const DayOfWeek = lazy(() => z.number().int().min(0).max(6));

/** English is always present. Urdu is null until someone writes it; clients fall back to English. */
export const Localized = lazy(() =>
  z
    .object({
      en: z.string().min(1),
      ur: z.string().min(1).nullable(),
    })
    .meta({ id: 'Localized' }),
);
export type Localized = z.infer<typeof Localized>;

/**
 * Characters refused in names and place text (SEC-08): they can hide or reorder text in WhatsApp
 * messages, on posters, in CSV exports and on admin screens.
 *
 * - C0 and C1 controls and DEL. Line text also refuses tab, line feed and carriage return; long
 *   text (`multiline`) keeps those three.
 * - Explicit bidi controls: LRM, RLM, ALM (U+061C), the embeddings and overrides U+202A to U+202E,
 *   and the isolates U+2066 to U+2069. Isolation is the renderer's and the clients' job
 *   (decision 0012), never the text's.
 * - Invisible format characters a name never needs: zero-width space, zero-width joiner, the line
 *   and paragraph separators, word joiner and invisible operators (U+2060 to U+2064), the
 *   deprecated format controls (U+206A to U+206F), the byte order mark and the interlinear
 *   annotation controls.
 *
 * The zero-width non-joiner (U+200C) is allowed: Urdu and Persian use it to stop letters joining.
 */
const UNSAFE_LINE_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f-\u009f\u061c\u200b\u200d-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]/;
const UNSAFE_MULTILINE_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200b\u200d-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]/;

export interface SafeTextOptions {
  /** Long text: tab, line feed and carriage return are allowed. Default false. */
  multiline?: boolean;
}

export const SAFE_TEXT_MESSAGE = 'control characters are not allowed';

/** True when `value` holds none of the characters `SafeText` refuses. */
export function isSafeText(value: string, options: SafeTextOptions = {}): boolean {
  return !(options.multiline ? UNSAFE_MULTILINE_CHARS : UNSAFE_LINE_CHARS).test(value);
}

/**
 * Removes the characters `SafeText` refuses. A second guard for text that was stored before the
 * rule, or that reaches a printer by another path (the poster renderer uses it).
 */
export function stripUnsafeText(value: string, options: SafeTextOptions = {}): string {
  const pattern = options.multiline ? UNSAFE_MULTILINE_CHARS : UNSAFE_LINE_CHARS;
  return value.replace(new RegExp(pattern.source, 'g'), '');
}

/**
 * The one refinement for names and place text: trimmed, `min` to `max` characters, and none of the
 * characters listed above (issue code `custom`, message `SAFE_TEXT_MESSAGE`). Person names, venue,
 * area, circle and session names and titles, teacher names and the poster fields all use it.
 */
export const SafeText = (min: number, max: number, options: SafeTextOptions = {}) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => isSafeText(value, options), { message: SAFE_TEXT_MESSAGE });

/**
 * A web link that clients may open (SEC-09): `https://` with a domain name, at most 2048
 * characters, and no user name or password in it. `http:`, `javascript:`, `data:`, `file:` and
 * every other scheme are refused, and so are IP addresses and `localhost`.
 */
export const HttpsUrl = lazy(() =>
  z
    .url({ protocol: /^https$/, hostname: z.regexes.domain })
    .max(2048)
    .refine(
      // Another scheme or a malformed link is already reported by the url check above. This one asks
      // for the `//` and refuses user info (`user:pass@`), with no URL getters (React Native has few).
      (value) => !/^https:/i.test(value) || /^https:\/\/[^/?#@\\]+(?:[/?#]|$)/i.test(value),
      { message: 'must be an https link' },
    )
    .meta({ examples: ['https://meet.example.org/circle'], description: 'An https link' }),
);
export type HttpsUrl = z.infer<typeof HttpsUrl>;

/** Line text: names and titles. */
export const LocalizedInput = lazy(() =>
  z.object({
    en: SafeText(1, 500),
    ur: SafeText(1, 500).nullable().optional(),
  }),
);
export type LocalizedInput = z.infer<typeof LocalizedInput>;

export const LocalizedLong = lazy(() =>
  z.object({
    en: z.string().min(1),
    ur: z.string().min(1).nullable(),
  }),
);

/** Long text (descriptions, update bodies, addresses): line breaks allowed. */
export const LocalizedLongInput = lazy(() =>
  z.object({
    en: SafeText(1, 4000, { multiline: true }),
    ur: SafeText(1, 4000, { multiline: true }).nullable().optional(),
  }),
);

/** An address: up to 500 characters like `LocalizedInput`, but on several lines. */
export const LocalizedAddressInput = lazy(() =>
  z.object({
    en: SafeText(1, 500, { multiline: true }),
    ur: SafeText(1, 500, { multiline: true }).nullable().optional(),
  }),
);

export const Latitude = lazy(() => z.number().min(-90).max(90));
export const Longitude = lazy(() => z.number().min(-180).max(180));

/** Pagination: opaque cursors, never offsets. Pass nextCursor back to get the next page. */
export const PageQuery = lazy(() =>
  z.object({
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
);
export type PageQuery = z.infer<typeof PageQuery>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

/**
 * Query-string booleans arrive as strings. The server accepts `true`/`false` (and Zod's other
 * spellings: `1`/`0`, `yes`/`no`, `on`/`off`, any case). Clients send exactly `'true'` or
 * `'false'`; the typed client types these parameters as strings, so pass `'true'`, not `true`.
 * Every `z.stringbool()` query parameter in the registry follows this rule.
 */
export const QueryBool = lazy(() => z.stringbool());

export const Empty = lazy(() => z.object({}));

export const OkResponse = lazy(() => z.object({ ok: z.literal(true) }));
export type OkResponse = z.infer<typeof OkResponse>;

/** Person's chosen display name. Never logged. */
export const PersonName = lazy(() => SafeText(2, 80));
