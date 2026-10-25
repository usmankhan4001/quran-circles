import {
  POSTER_ADDRESS_MAX,
  POSTER_DETAILS_MAX,
  POSTER_FAILURE_RETRYABLE,
  POSTER_PHONE_MAX,
  POSTER_TITLE_MAX,
  PosterCreate,
  posterLanguagesOf,
  type Poster,
  type PosterAccent,
  type PosterCreateInput,
  type PosterFailureCode,
  type PosterFormat,
  type PosterLanguage,
  type PosterOutOfDateReason,
  type PosterQrTarget,
  type PosterStatus,
  type PosterTemplate,
  type ValidationIssue,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { formatClock } from './datetime';

/**
 * The poster screens (contract 1.0.0-rc.5). The API builds the snapshot from the session, so the
 * date, the time and the venue are never typed here: the form sends the template, the language,
 * the formats and the editable fields only.
 */

export const POSTER_STATUS_KEYS = {
  queued: 'console.posters.status.queued',
  ready: 'console.posters.status.ready',
  failed: 'console.posters.status.failed',
} as const satisfies Record<PosterStatus, MessageKey>;

export const POSTER_FORMAT_KEYS = {
  story: 'console.posters.format.story',
  print_a4: 'console.posters.format.printA4',
  print_a3: 'console.posters.format.printA3',
  link_preview: 'console.posters.format.linkPreview',
} as const satisfies Record<PosterFormat, MessageKey>;

export const POSTER_FORMAT_HINT_KEYS = {
  story: 'console.posters.format.story.hint',
  print_a4: 'console.posters.format.printA4.hint',
  print_a3: 'console.posters.format.printA3.hint',
  link_preview: 'console.posters.format.linkPreview.hint',
} as const satisfies Record<PosterFormat, MessageKey>;

export const POSTER_LANGUAGE_KEYS = {
  en: 'console.posters.language.en',
  ur: 'console.posters.language.ur',
  en_ur: 'console.posters.language.enUr',
  ur_en: 'console.posters.language.urEn',
} as const satisfies Record<PosterLanguage, MessageKey>;

export const POSTER_ACCENT_KEYS = {
  tanzeem: 'console.posters.accent.tanzeem',
  deep: 'console.posters.accent.deep',
  night: 'console.posters.accent.night',
} as const satisfies Record<PosterAccent, MessageKey>;

export const POSTER_QR_KEYS = {
  register: 'console.posters.qr.register',
  session: 'console.posters.qr.session',
} as const satisfies Record<PosterQrTarget, MessageKey>;

export const POSTER_QR_HINT_KEYS = {
  register: 'console.posters.qr.register.hint',
  session: 'console.posters.qr.session.hint',
} as const satisfies Record<PosterQrTarget, MessageKey>;

/** A plain sentence per failure code, saying what to do next. */
export const POSTER_FAILURE_KEYS = {
  invalid_request: 'console.posters.failure.invalidRequest',
  text_too_long: 'console.posters.failure.textTooLong',
  busy: 'console.posters.failure.busy',
  render_timeout: 'console.posters.failure.renderTimeout',
  render_failed: 'console.posters.failure.renderFailed',
} as const satisfies Record<PosterFailureCode, MessageKey>;

/** PNG for the screen formats, PDF for print. */
export const isPrintFormat = (format: PosterFormat): boolean =>
  format === 'print_a4' || format === 'print_a3';

export const posterMime = (format: PosterFormat): 'image/png' | 'application/pdf' =>
  isPrintFormat(format) ? 'application/pdf' : 'image/png';

/** `poster-cloud-story-en_ur.png`: no session or person in the name. */
export const posterFileName = (p: Pick<Poster, 'templateKey' | 'format' | 'language'>): string =>
  `poster-${p.templateKey}-${p.format}-${p.language}.${isPrintFormat(p.format) ? 'pdf' : 'png'}`;

/** Which out-of-date sentence to show: the time, the venue, or both. */
export type OutOfDateKind = 'time' | 'venue' | 'both';

export function outOfDateKind(reasons: readonly PosterOutOfDateReason[]): OutOfDateKind | null {
  const time = reasons.includes('time');
  const venue = reasons.includes('venue');
  if (time && venue) return 'both';
  if (time) return 'time';
  if (venue) return 'venue';
  return null;
}

export const OUT_OF_DATE_KEYS = {
  time: 'console.posters.outOfDate.time',
  venue: 'console.posters.outOfDate.venue',
  both: 'console.posters.outOfDate.both',
} as const satisfies Record<OutOfDateKind, MessageKey>;

/** What a failed poster offers: make it again as it was, or change the text first. */
export type FailureAction = 'retry' | 'edit';

export const failureAction = (code: PosterFailureCode | null): FailureAction =>
  code !== null && POSTER_FAILURE_RETRYABLE[code] ? 'retry' : 'edit';

/** Posters that a queued regeneration will replace once it is ready. */
export function beingReplaced(posters: readonly Poster[]): Set<string> {
  return new Set(
    posters
      .filter((p) => p.status === 'queued' && p.replacesPosterId !== null)
      .map((p) => p.replacesPosterId as string),
  );
}

/**
 * The list as the server sent it, with posters this page just asked for that the list does not
 * have yet (a create or a regenerate answers before the next list), newest first.
 */
export function mergePosters(listed: readonly Poster[], recent: readonly Poster[]): Poster[] {
  const known = new Set(listed.map((p) => p.id));
  return [...recent.filter((p) => !known.has(p.id)), ...listed].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export const hasQueued = (posters: readonly Poster[]): boolean =>
  posters.some((p) => p.status === 'queued');

/** What may be done to one poster, given the person's right to make posters here. */
export function posterActions(
  poster: Poster,
  canCreate: boolean,
  replaced: ReadonlySet<string>,
): { download: boolean; regenerate: boolean; edit: boolean } {
  const pending = replaced.has(poster.id);
  const failed = poster.status === 'failed';
  const action = failed ? failureAction(poster.failureCode) : null;
  return {
    download: poster.status === 'ready',
    regenerate:
      canCreate &&
      !pending &&
      ((poster.status === 'ready' && poster.outOfDate !== null) || action === 'retry'),
    edit: canCreate && failed && action === 'edit',
  };
}

// The form ----------------------------------------------------------------------------------

export interface PosterForm {
  templateKey: string;
  language: PosterLanguage;
  formats: PosterFormat[];
  titleEn: string;
  titleUr: string;
  detailsEn: string;
  detailsUr: string;
  /** The halaqa flyer's own lines (address, phone, the two QR links); only the Quranic Circles template prints them. */
  addressEn: string;
  addressUr: string;
  phone: string;
  whatsappUrl: string;
  locationUrl: string;
  accent: PosterAccent;
  qrTarget: PosterQrTarget;
}

/** The template that prints the flyer lines; the form asks for them only with it. */
export const FLYER_TEMPLATE_KEY = 'quranic_circles';

export type PosterFormField =
  | 'template'
  | 'language'
  | 'formats'
  | 'titleEn'
  | 'titleUr'
  | 'detailsEn'
  | 'detailsUr'
  | 'addressEn'
  | 'addressUr'
  | 'phone'
  | 'whatsappUrl'
  | 'locationUrl'
  | 'accent'
  | 'qrTarget';

export type PosterFieldProblem = 'required' | 'tooLong' | 'invalid' | 'notOffered';
export type PosterFormErrors = Partial<Record<PosterFormField, PosterFieldProblem>>;

/** Where an issue path (`fields.title.ur`, `formats.1`) lands on the form. */
export const POSTER_ISSUE_FIELDS: Readonly<Record<string, PosterFormField>> = {
  templateKey: 'template',
  language: 'language',
  formats: 'formats',
  'fields.title.en': 'titleEn',
  'fields.title.ur': 'titleUr',
  'fields.title': 'titleEn',
  'fields.details.en': 'detailsEn',
  'fields.details.ur': 'detailsUr',
  'fields.flyer.address.en': 'addressEn',
  'fields.flyer.address.ur': 'addressUr',
  'fields.flyer.phone': 'phone',
  'fields.flyer.whatsappUrl': 'whatsappUrl',
  'fields.flyer.locationUrl': 'locationUrl',
  'fields.accent': 'accent',
  'fields.qrTarget': 'qrTarget',
};

export function fieldOfPath(path: string): PosterFormField | null {
  const parts = path.split('.');
  for (let n = parts.length; n > 0; n--) {
    const field = POSTER_ISSUE_FIELDS[parts.slice(0, n).join('.')];
    if (field !== undefined) return field;
  }
  return null;
}

const DEFAULT_FORMATS: readonly PosterFormat[] = ['story', 'print_a4'];

/** The session's own title fills the poster title when it fits; everything else is a default. */
export function initialPosterForm(
  templates: readonly PosterTemplate[],
  sessionTitle: { en: string; ur: string | null } | null,
): PosterForm {
  const template = templates[0];
  const offered = template?.formats ?? [];
  const fits = (v: string | null | undefined) => (v && v.length <= POSTER_TITLE_MAX ? v : '');
  return {
    templateKey: template?.key ?? '',
    language: 'en_ur',
    formats: DEFAULT_FORMATS.filter((f) => offered.includes(f)),
    titleEn: fits(sessionTitle?.en),
    titleUr: fits(sessionTitle?.ur),
    detailsEn: '',
    detailsUr: '',
    addressEn: '',
    addressUr: '',
    phone: '',
    whatsappUrl: '',
    locationUrl: '',
    accent: 'tanzeem',
    qrTarget: 'register',
  };
}

/** A failed poster's choices back in the form, so the person can shorten the title and retry. */
export function formFromPoster(poster: Poster): PosterForm {
  return {
    templateKey: poster.templateKey,
    language: poster.language,
    formats: [poster.format],
    titleEn: poster.fields.title.en ?? '',
    titleUr: poster.fields.title.ur ?? '',
    detailsEn: poster.fields.details?.en ?? '',
    detailsUr: poster.fields.details?.ur ?? '',
    addressEn: poster.fields.flyer?.address?.en ?? '',
    addressUr: poster.fields.flyer?.address?.ur ?? '',
    phone: poster.fields.flyer?.phone ?? '',
    whatsappUrl: poster.fields.flyer?.whatsappUrl ?? '',
    locationUrl: poster.fields.flyer?.locationUrl ?? '',
    accent: poster.fields.accent,
    qrTarget: poster.fields.qrTarget,
  };
}

/** Changing the template keeps only the formats it offers. */
export function withTemplate(form: PosterForm, template: PosterTemplate): PosterForm {
  return {
    ...form,
    templateKey: template.key,
    formats: form.formats.filter((f) => template.formats.includes(f)),
  };
}

/** The languages a form shows: the title (and details) are asked for in each of them. */
export const formLanguages = (form: Pick<PosterForm, 'language'>) =>
  posterLanguagesOf(form.language);

const valuesOf = (form: PosterForm): Record<PosterFormField, string> => ({
  template: form.templateKey,
  language: form.language,
  formats: form.formats.join(','),
  titleEn: form.titleEn,
  titleUr: form.titleUr,
  detailsEn: form.detailsEn,
  detailsUr: form.detailsUr,
  addressEn: form.addressEn,
  addressUr: form.addressUr,
  phone: form.phone,
  whatsappUrl: form.whatsappUrl,
  locationUrl: form.locationUrl,
  accent: form.accent,
  qrTarget: form.qrTarget,
});

function problemOf(issue: { code: string }, value: string): PosterFieldProblem {
  if (value.trim() === '') return 'required';
  if (issue.code === 'too_big') return 'tooLong';
  return 'invalid';
}

/**
 * Builds the request body and checks it with the contract's own schema, so the form refuses what
 * the API would. Only the languages the poster shows are sent.
 */
export function buildPosterCreate(
  form: PosterForm,
  template: PosterTemplate | undefined,
): { body: PosterCreateInput | null; errors: PosterFormErrors } {
  const errors: PosterFormErrors = {};
  if (!template) errors.template = 'required';
  else if (form.formats.some((f) => !template.formats.includes(f))) errors.formats = 'notOffered';
  if (form.formats.length === 0) errors.formats = 'required';

  const shown = formLanguages(form);
  const pick = (en: string, ur: string) => ({
    ...(shown.includes('en') && en.trim() ? { en: en.trim() } : {}),
    ...(shown.includes('ur') && ur.trim() ? { ur: ur.trim() } : {}),
  });
  const details = pick(form.detailsEn, form.detailsUr);
  const address = pick(form.addressEn, form.addressUr);
  const flyer = {
    ...(Object.keys(address).length > 0 ? { address } : {}),
    ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    ...(form.whatsappUrl.trim() ? { whatsappUrl: form.whatsappUrl.trim() } : {}),
    ...(form.locationUrl.trim() ? { locationUrl: form.locationUrl.trim() } : {}),
  };
  const sendFlyer = form.templateKey === FLYER_TEMPLATE_KEY && Object.keys(flyer).length > 0;
  const body: PosterCreateInput = {
    templateKey: form.templateKey,
    language: form.language,
    formats: form.formats,
    fields: {
      title: pick(form.titleEn, form.titleUr),
      ...(Object.keys(details).length > 0 ? { details } : {}),
      ...(sendFlyer ? { flyer } : {}),
      accent: form.accent,
      qrTarget: form.qrTarget,
    },
  };
  const values = valuesOf(form);
  const checked = PosterCreate.safeParse(body);
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const field = fieldOfPath(issue.path.map(String).join('.'));
      if (!field || errors[field]) continue;
      errors[field] = field === 'formats' ? 'required' : problemOf(issue, values[field]);
    }
  }
  return { body: Object.keys(errors).length === 0 ? body : null, errors };
}

/** The server's `validation_failed` issues on the form, in the same words as the form's own. */
export function serverPosterErrors(
  issues: readonly ValidationIssue[],
  form: PosterForm,
): PosterFormErrors {
  const out: PosterFormErrors = {};
  const values = valuesOf(form);
  for (const issue of issues) {
    const field = fieldOfPath(issue.path);
    if (!field || out[field]) continue;
    out[field] =
      field === 'formats'
        ? issue.code === 'invalid_value'
          ? 'notOffered'
          : 'required'
        : problemOf(issue, values[field]);
  }
  return out;
}

export { POSTER_ADDRESS_MAX, POSTER_DETAILS_MAX, POSTER_PHONE_MAX, POSTER_TITLE_MAX };

/**
 * "21:30" as the person reads it: "9:30 pm", or in Urdu the part of the day and then the figures,
 * "رات 9:30" (A-09), with Latin digits as elsewhere. `Intl` in `ur-PK` writes a Latin "PM", so
 * the Urdu time is built here; its figures are isolated so they stay left to right inside Urdu
 * text. Never a narrow no-break space (U+202F), which the Urdu font cannot draw. The one clock
 * formatter for the whole console lives in `lib/datetime.ts`.
 */
export const formatLocalTime = (time: string, locale: 'en' | 'ur'): string =>
  formatClock(time, locale);
