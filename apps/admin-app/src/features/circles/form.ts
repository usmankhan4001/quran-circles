import {
  CircleCreate,
  CircleUpdate,
  type AdminCircle,
  type Locale,
  type Section,
} from '@qc/contracts';
import type { MessageKey } from '../../i18n/translate';
import {
  bilingualOf,
  emptyBilingual,
  isBilingualEmpty,
  toLocalizedInput,
  toLocalizedOptional,
  type BilingualFields,
} from '../../lib/localized';

export interface CircleForm {
  venueId: string | null;
  name: BilingualFields;
  /** The teacher is an optional name, not an account. */
  teacherName: string;
  description: BilingualFields;
  language: Locale;
  section: Section;
  onlineLink: string;
}

export type CircleErrors = Partial<
  Record<'venue' | 'name' | 'teacher' | 'description' | 'link' | 'nothing', MessageKey>
>;

export const emptyCircleForm = (venueId: string | null, language: Locale): CircleForm => ({
  venueId,
  name: emptyBilingual(),
  teacherName: '',
  description: emptyBilingual(),
  language,
  section: 'family',
  onlineLink: '',
});

export const circleFormOf = (c: AdminCircle): CircleForm => ({
  venueId: c.venueId,
  name: bilingualOf(c.name),
  teacherName: c.teacherName ?? '',
  description: bilingualOf(c.description),
  language: c.language,
  section: c.section,
  onlineLink: c.onlineLink ?? '',
});

/** An online link must be a full web address, so a typo does not become a dead link. */
export function isWebAddress(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface ValidatedCircle {
  errors: CircleErrors;
  create?: ReturnType<typeof CircleCreate.parse>;
  update?: ReturnType<typeof CircleUpdate.parse>;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function validateCircle(form: CircleForm, original?: AdminCircle): ValidatedCircle {
  const errors: CircleErrors = {};
  if (!original && !form.venueId) errors.venue = 'admin.circleEditor.error.venue';
  if (isBilingualEmpty(form.name)) errors.name = 'admin.circleEditor.error.name';
  const teacher = form.teacherName.trim();
  if (teacher && (teacher.length < 2 || teacher.length > 80)) {
    errors.teacher = 'admin.circleEditor.error.teacher';
  }
  const link = form.onlineLink.trim();
  if (link && !isWebAddress(link)) errors.link = 'admin.circleEditor.error.link';
  if (Object.keys(errors).length > 0) return { errors };

  const name = toLocalizedOptional(form.name);
  const description = isBilingualEmpty(form.description)
    ? null
    : toLocalizedOptional(form.description);

  if (!original) {
    const parsed = CircleCreate.safeParse({
      venueId: form.venueId,
      name,
      teacherName: teacher || null,
      description,
      language: form.language,
      section: form.section,
      onlineLink: link || null,
    });
    return parsed.success
      ? { errors, create: parsed.data }
      : { errors: { name: 'errors.validation_failed' } };
  }

  const patch: Record<string, unknown> = {};
  if (!same(toLocalizedInput(form.name), toLocalizedInput(bilingualOf(original.name))))
    patch.name = name;
  if ((teacher || null) !== original.teacherName) patch.teacherName = teacher || null;
  const desc = isBilingualEmpty(form.description) ? null : toLocalizedInput(form.description);
  if (
    !same(desc, original.description ? toLocalizedInput(bilingualOf(original.description)) : null)
  ) {
    patch.description = description;
  }
  if (form.language !== original.language) patch.language = form.language;
  if (form.section !== original.section) patch.section = form.section;
  if ((link || null) !== original.onlineLink) patch.onlineLink = link || null;
  if (Object.keys(patch).length === 0)
    return { errors: { nothing: 'admin.circleEditor.error.nothing' } };
  const parsed = CircleUpdate.safeParse(patch);
  return parsed.success
    ? { errors, update: parsed.data }
    : { errors: { name: 'errors.validation_failed' } };
}
