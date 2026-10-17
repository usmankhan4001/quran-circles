import { z } from 'zod';
import { PosterFormat } from '@qc/contracts';
import { Accent } from './palette';
import { SourceSnapshot } from './snapshot';

export const TEMPLATE_IDS = ['cloud', 'night'] as const;
export const TemplateId = z.enum(TEMPLATE_IDS);
export type TemplateId = z.infer<typeof TemplateId>;

/**
 * Which languages a poster shows. `en_ur` and `ur_en` are bilingual: the first language leads (top,
 * or the start side). The stored `posters.locale` is the leading language.
 */
export const POSTER_LANGUAGES = ['en', 'ur', 'en_ur', 'ur_en'] as const;
export const PosterLanguage = z.enum(POSTER_LANGUAGES);
export type PosterLanguage = z.infer<typeof PosterLanguage>;

export const languagesOf = (language: PosterLanguage): Array<'en' | 'ur'> =>
  language === 'en'
    ? ['en']
    : language === 'ur'
      ? ['ur']
      : language === 'en_ur'
        ? ['en', 'ur']
        : ['ur', 'en'];

// Control characters and explicit bidi controls are refused: they could hide or reorder text on a
// printed poster. Isolation is the renderer's job (decision 0012).
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u0008\u000b-\u001f\u007f‎‏‪-‮⁦-⁩]/;
const fieldText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !FORBIDDEN.test(v), { message: 'control characters are not allowed' });

export const TITLE_MAX = 80;
export const DETAILS_MAX = 140;

/** The editable fields. Everything else on a template is locked. */
export const PosterFields = z
  .object({
    title: z
      .object({ en: fieldText(TITLE_MAX).optional(), ur: fieldText(TITLE_MAX).optional() })
      .strict(),
    /** One line under the venue: section, teacher, portion. Optional. */
    details: z
      .object({ en: fieldText(DETAILS_MAX).optional(), ur: fieldText(DETAILS_MAX).optional() })
      .strict()
      .optional(),
    accent: Accent.default('tanzeem'),
    /** What the QR code opens: registration (default, for posters) or the session page. */
    qrTarget: z.enum(['register', 'session']).default('register'),
  })
  .strict();
export type PosterFields = z.infer<typeof PosterFields>;

export const RenderRequest = z
  .object({
    templateId: TemplateId,
    formats: z
      .array(PosterFormat)
      .min(1)
      .max(4)
      .refine((f) => new Set(f).size === f.length, { message: 'formats must not repeat' }),
    language: PosterLanguage,
    fields: PosterFields,
    session: SourceSnapshot,
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const locale of languagesOf(value.language)) {
      if (!value.fields.title[locale]) {
        ctx.addIssue({ code: 'custom', path: ['fields', 'title', locale], message: 'required' });
      }
    }
  });
export type RenderRequest = z.infer<typeof RenderRequest>;
export type RenderRequestInput = z.input<typeof RenderRequest>;
