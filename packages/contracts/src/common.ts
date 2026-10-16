import { z } from 'zod';

/** Primitives shared by every schema. Instants are UTC ISO strings; dates and times are local. */

export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export const Uuid = z.uuid().meta({ examples: ['00000000-0000-4000-8000-000000000001'] });
export type Uuid = z.infer<typeof Uuid>;

/** A phone number in E.164 form, for example +923001234567. Pakistan is +92. */
export const PhoneE164 = z
  .string()
  .regex(E164_PATTERN)
  .meta({ examples: ['+923001234567'], description: 'E.164, for example +923001234567' });
export type PhoneE164 = z.infer<typeof PhoneE164>;

/** An instant in UTC, for example 2027-02-18T01:15:00Z. Show it in Pakistan time (UTC+5). */
export const InstantUtc = z.iso.datetime().meta({ examples: ['2027-02-18T01:15:00Z'] });
export type InstantUtc = z.infer<typeof InstantUtc>;

export const LocalDate = z.iso.date().meta({ examples: ['2027-02-18'] });
export type LocalDate = z.infer<typeof LocalDate>;

/** Wall-clock time in the session's timezone, 24 hour clock. */
export const LocalTime = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  .meta({ examples: ['19:30'], description: 'HH:MM, 24 hour clock' });
export type LocalTime = z.infer<typeof LocalTime>;

/** A day of the week: 0 is Sunday, 6 is Saturday. */
export const DayOfWeek = z.number().int().min(0).max(6);

/** English is always present. Urdu is null until someone writes it; clients fall back to English. */
export const Localized = z
  .object({
    en: z.string().min(1),
    ur: z.string().min(1).nullable(),
  })
  .meta({ id: 'Localized' });
export type Localized = z.infer<typeof Localized>;

export const LocalizedInput = z.object({
  en: z.string().trim().min(1).max(500),
  ur: z.string().trim().min(1).max(500).nullable().optional(),
});
export type LocalizedInput = z.infer<typeof LocalizedInput>;

export const LocalizedLong = z.object({
  en: z.string().min(1),
  ur: z.string().min(1).nullable(),
});

export const LocalizedLongInput = z.object({
  en: z.string().trim().min(1).max(4000),
  ur: z.string().trim().min(1).max(4000).nullable().optional(),
});

export const Latitude = z.number().min(-90).max(90);
export const Longitude = z.number().min(-180).max(180);

/** Pagination: opaque cursors, never offsets. Pass nextCursor back to get the next page. */
export const PageQuery = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

/** Query-string booleans arrive as 'true' or 'false'. */
export const QueryBool = z.stringbool();

export const Empty = z.object({});

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

/** Person's chosen display name. Never logged. */
export const PersonName = z.string().trim().min(2).max(80);
