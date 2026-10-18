import { z } from 'zod';
import { DayOfWeek, InstantUtc, LocalDate, LocalTime, SafeText, Uuid } from '../common';
import {
  Locale,
  PosterAccent,
  PosterFailureCode,
  PosterFormat,
  PosterLanguage,
  PosterOutOfDateReason,
  PosterQrTarget,
  PosterStatus,
} from '../enums';

/**
 * Posters (contract 1.0.0-rc.5, change request `2026-10-17-poster-renderer`).
 *
 * The snapshot, the editable fields and the renderer's own request and response were written in
 * `apps/poster-renderer` and moved here unchanged, so the API, the worker and the renderer share
 * one copy. One deliberate difference: a template id is an open key (`PosterTemplateKey`), not a
 * closed list, because the final designs come later; the renderer refuses a key it does not have.
 */

// Session snapshot -------------------------------------------------------------------------------

/** Venue and area names, under the same rule as the names they copy (`SafeText`). */
const SnapshotText = SafeText(1, 160);
const SnapshotLocalized = z.object({ en: SnapshotText, ur: SnapshotText.nullable() });

/**
 * The session details a poster is made from. The renderer prints the time and the venue from this
 * (editors cannot type them), returns it with the files, and the API stores it in
 * `posters.source_snapshot`. Comparing it with the session later says whether the poster is out of
 * date (`posterOutOfDate`).
 */
export const PosterSourceSnapshot = z.object({
  sessionId: Uuid,
  /** The session's version when the poster was made: its `updatedAt` or a revision number. */
  sessionVersion: z.string().trim().min(1).max(64),
  localStartTime: LocalTime,
  durationMinutes: z.number().int().min(5).max(600),
  /** 0 is Sunday. Empty for a one-off lecture on `startsOn`. */
  daysOfWeek: z.array(DayOfWeek).max(7),
  startsOn: LocalDate,
  endsOn: LocalDate.nullable(),
  timezone: z.string().trim().min(1).max(64),
  venue: z.object({ id: Uuid, name: SnapshotLocalized, area: SnapshotLocalized.nullable() }),
});
export type PosterSourceSnapshot = z.infer<typeof PosterSourceSnapshot>;

// Templates and editable fields ------------------------------------------------------------------

/**
 * A template's key (`poster_templates.key`), which is also the renderer's template id. Open on
 * purpose: the renderer's demo templates (`DEMO_POSTER_TEMPLATES`) stand in until the final designs.
 */
export const PosterTemplateKey = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,39}$/)
  .meta({ examples: ['cloud'], description: 'Lower case letters, digits, - and _; at most 40' });
export type PosterTemplateKey = z.infer<typeof PosterTemplateKey>;

// Control characters, explicit bidi controls and invisible format characters are refused
// (`SafeText`): they could hide or reorder text on a printed poster. Isolation is the renderer's
// job (decision 0012). Each field is one line.
const fieldText = (max: number) => SafeText(1, max);

export const POSTER_TITLE_MAX = 80;
export const POSTER_DETAILS_MAX = 140;

/** The editable fields. Everything else on a template is locked. */
export const PosterFields = z
  .object({
    title: z
      .object({
        en: fieldText(POSTER_TITLE_MAX).optional(),
        ur: fieldText(POSTER_TITLE_MAX).optional(),
      })
      .strict(),
    /** One line under the venue: section, teacher, portion. Optional. */
    details: z
      .object({
        en: fieldText(POSTER_DETAILS_MAX).optional(),
        ur: fieldText(POSTER_DETAILS_MAX).optional(),
      })
      .strict()
      .optional(),
    accent: PosterAccent.default('tanzeem'),
    /** What the QR code opens: registration (default, for posters) or the session page. */
    qrTarget: PosterQrTarget.default('register'),
  })
  .strict();
export type PosterFields = z.infer<typeof PosterFields>;
export type PosterFieldsInput = z.input<typeof PosterFields>;

/** One to four formats, none repeated. */
export const PosterFormats = z
  .array(PosterFormat)
  .min(1)
  .max(4)
  .refine((f) => new Set(f).size === f.length, { message: 'formats must not repeat' });

const LANGUAGE_LOCALES: Record<PosterLanguage, Array<'en' | 'ur'>> = {
  en: ['en'],
  ur: ['ur'],
  en_ur: ['en', 'ur'],
  ur_en: ['ur', 'en'],
};

/** A title is required in every language the poster shows; the issue names the missing one. */
const titleInEveryLanguage = (
  value: { language: PosterLanguage; fields: { title: { en?: string; ur?: string } } },
  ctx: z.RefinementCtx,
): void => {
  for (const locale of LANGUAGE_LOCALES[value.language]) {
    if (!value.fields.title[locale]) {
      ctx.addIssue({ code: 'custom', path: ['fields', 'title', locale], message: 'required' });
    }
  }
};

/** A plain sentence per language the poster shows, for the share sheet and the preview tag. */
export const PosterAltText = z.object({
  en: z.string().min(1).max(1000).optional(),
  ur: z.string().min(1).max(1000).optional(),
});
export type PosterAltText = z.infer<typeof PosterAltText>;

// The renderer's HTTP interface (internal network only) ------------------------------------------

/** `POST /render` on the renderer: the body the worker sends. */
export const RendererRenderRequest = z
  .object({
    templateId: PosterTemplateKey,
    formats: PosterFormats,
    language: PosterLanguage,
    fields: PosterFields,
    session: PosterSourceSnapshot,
  })
  .strict()
  .superRefine(titleInEveryLanguage);
export type RendererRenderRequest = z.infer<typeof RendererRenderRequest>;
export type RendererRenderRequestInput = z.input<typeof RendererRenderRequest>;

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** One rendered file in the renderer's answer, its bytes as base64. */
export const RendererRenderedFile = z.object({
  format: PosterFormat,
  contentType: z.enum(['image/png', 'application/pdf']),
  filename: z.string().min(1).max(200),
  /** Template, version, format, language, fields, snapshot and link, hashed. Names the stored file. */
  cacheKey: Sha256Hex,
  sha256: Sha256Hex,
  byteLength: z.number().int().min(0),
  /** True when the file came from the renderer's cache rather than a fresh render. */
  cached: z.boolean(),
  base64: z.string(),
});
export type RendererRenderedFile = z.infer<typeof RendererRenderedFile>;

/** `POST /render` on the renderer: its 200 answer. */
export const RendererRenderResponse = z.object({
  templateId: PosterTemplateKey,
  templateVersion: z.number().int().min(1),
  provisional: z.boolean(),
  language: PosterLanguage,
  /** The leading language, for `posters.locale`. */
  locale: Locale,
  /** What the QR code opens. */
  deepLink: z.string().min(1),
  /** Store with the poster (`posters.source_snapshot`) to detect a later change. */
  sourceSnapshot: PosterSourceSnapshot,
  altText: PosterAltText,
  files: z.array(RendererRenderedFile).min(1).max(4),
});
export type RendererRenderResponse = z.infer<typeof RendererRenderResponse>;

/**
 * The renderer's error body: codes, paths and box names only, never a value. Codes:
 * `validation_failed` (400, with `issues`), `unauthenticated` (401), `payload_too_large` (413),
 * `text_too_long` (422, with `fields` and `regions`), `render_failed` (500), `busy` (503, with
 * Retry-After), `render_timeout` (504), `not_found`, `internal_error`.
 * `posterFailureFromRenderer` maps them to `posters.failure_code`.
 */
export const RendererErrorResponse = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    issues: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
    fields: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
  }),
});
export type RendererErrorResponse = z.infer<typeof RendererErrorResponse>;

// The worker queue -------------------------------------------------------------------------------

/** The pg-boss queue the API fills and the worker drains. */
export const POSTER_RENDER_QUEUE = 'poster-render';

/**
 * One `poster-render` job: the queued `posters` rows one request created (one per format). The
 * worker loads them, sends one `RendererRenderRequest`, and fills each row.
 */
export const PosterRenderJob = z.object({ posterIds: z.array(Uuid).min(1).max(4) });
export type PosterRenderJob = z.infer<typeof PosterRenderJob>;

// The admin API ----------------------------------------------------------------------------------

/** An active row of `poster_templates`. */
export const PosterTemplate = z.object({
  id: Uuid,
  key: PosterTemplateKey,
  name: z.object({ en: z.string().min(1), ur: z.string().min(1) }),
  version: z.number().int().min(1),
  formats: z.array(PosterFormat).min(1),
  /** True for a demo template that has not had its human design approval. */
  provisional: z.boolean(),
});
export type PosterTemplate = z.infer<typeof PosterTemplate>;

export const PosterTemplatesResponse = z.object({ items: z.array(PosterTemplate) });
export type PosterTemplatesResponse = z.infer<typeof PosterTemplatesResponse>;

/** `POST /v1/admin/sessions/{sessionId}/posters`. */
export const PosterCreate = z
  .object({
    templateKey: PosterTemplateKey,
    language: PosterLanguage,
    formats: PosterFormats,
    fields: PosterFields,
  })
  .strict()
  .superRefine(titleInEveryLanguage);
export type PosterCreate = z.infer<typeof PosterCreate>;
export type PosterCreateInput = z.input<typeof PosterCreate>;

/** Set when what the poster prints no longer matches the session. */
export const PosterOutOfDate = z.object({ reasons: z.array(PosterOutOfDateReason).min(1) });
export type PosterOutOfDate = z.infer<typeof PosterOutOfDate>;

/** One poster file: one format of one request. */
export const Poster = z.object({
  id: Uuid,
  sessionId: Uuid,
  templateKey: PosterTemplateKey,
  format: PosterFormat,
  language: PosterLanguage,
  /** The leading language. */
  locale: Locale,
  fields: PosterFields,
  status: PosterStatus,
  /** Set when `status` is `failed`. */
  failureCode: PosterFailureCode.nullable(),
  /** Set when `status` is `ready`. */
  altText: PosterAltText.nullable(),
  /**
   * Where to fetch the file once `status` is `ready`: the `adminPosters.file` path (relative to the
   * API base, needs the token) or a short-lived signed https URL, as the server's storage allows.
   */
  fileUrl: z.string().min(1).nullable(),
  sourceSnapshot: PosterSourceSnapshot,
  /** Compared with the session as it is now (`posterOutOfDate`); null while it still matches. */
  outOfDate: PosterOutOfDate.nullable(),
  /** The poster this one regenerates; the old one is removed once this one is ready. */
  replacesPosterId: Uuid.nullable(),
  createdAt: InstantUtc,
});
export type Poster = z.infer<typeof Poster>;

export const PostersResponse = z.object({ items: z.array(Poster) });
export type PostersResponse = z.infer<typeof PostersResponse>;

/** The bytes of a stored poster file (`adminPosters.file`): a PNG or a PDF. */
export const PosterFileBytes = z.instanceof(Uint8Array);
