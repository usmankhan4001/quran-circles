import { OccurrenceUpdate, type AdminOccurrence, type Locale, type Portion } from '@qc/contracts';
import type { MessageKey } from '../../i18n/translate';

export type PortionChoice = 'none' | Portion['kind'];

export interface OccurrenceForm {
  portionKind: PortionChoice;
  para: string;
  surah: string;
  fromAyah: string;
  toAyah: string;
  lesson: string;
  /** Free text shown next to the portion, such as "pages 12 to 15". */
  portionLabel: string;
  recapNote: string;
  recapLocale: Locale;
  cancelled: boolean;
  /** Tell people, when cancelling. */
  notify: boolean;
}

export type OccurrenceErrors = Partial<
  Record<'para' | 'surah' | 'ayahs' | 'lesson' | 'portionLabel' | 'recap' | 'nothing', MessageKey>
>;

export const RECAP_MAX = 2000;
export const LABEL_MAX = 200;

export function initialOccurrenceForm(o: AdminOccurrence, fallbackLocale: Locale): OccurrenceForm {
  const p = o.portion;
  return {
    portionKind: p ? p.kind : 'none',
    para: p?.kind === 'para' ? String(p.para) : '',
    surah: p && (p.kind === 'surah' || p.kind === 'ayah_range') ? String(p.surah) : '',
    fromAyah: p?.kind === 'ayah_range' ? String(p.fromAyah) : '',
    toAyah: p?.kind === 'ayah_range' ? String(p.toAyah) : '',
    lesson: p?.kind === 'lesson' ? p.title : '',
    portionLabel: o.portionLabel ?? '',
    recapNote: o.recapNote ?? '',
    recapLocale: o.recapLocale ?? fallbackLocale,
    cancelled: o.status === 'cancelled',
    notify: true,
  };
}

const intIn = (text: string, min: number, max: number): number | null => {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const v = Number(text);
  return v >= min && v <= max ? v : null;
};

/** Builds the portion the form describes. Returns an error key when it is incomplete. */
function buildPortion(f: OccurrenceForm): { portion: Portion | null; error?: [keyof OccurrenceErrors, MessageKey] } {
  switch (f.portionKind) {
    case 'none':
      return { portion: null };
    case 'para': {
      const para = intIn(f.para, 1, 30);
      return para === null
        ? { portion: null, error: ['para', 'admin.schedule.error.para'] }
        : { portion: { kind: 'para', para } };
    }
    case 'surah': {
      const surah = intIn(f.surah, 1, 114);
      return surah === null
        ? { portion: null, error: ['surah', 'admin.schedule.error.surah'] }
        : { portion: { kind: 'surah', surah } };
    }
    case 'ayah_range': {
      const surah = intIn(f.surah, 1, 114);
      if (surah === null) return { portion: null, error: ['surah', 'admin.schedule.error.surah'] };
      const fromAyah = intIn(f.fromAyah, 1, 286);
      const toAyah = intIn(f.toAyah, 1, 286);
      if (fromAyah === null || toAyah === null || fromAyah > toAyah) {
        return { portion: null, error: ['ayahs', 'admin.schedule.error.ayahs'] };
      }
      return { portion: { kind: 'ayah_range', surah, fromAyah, toAyah } };
    }
    case 'lesson': {
      const title = f.lesson.trim();
      return title.length === 0 || title.length > LABEL_MAX
        ? { portion: null, error: ['lesson', 'admin.schedule.error.lesson'] }
        : { portion: { kind: 'lesson', title } };
    }
  }
}

export interface ValidatedOccurrence {
  errors: OccurrenceErrors;
  body?: ReturnType<typeof OccurrenceUpdate.parse>;
}

/**
 * Checks the form and builds a request with only the fields that changed. Clearing a field sends
 * null, which removes the portion or the recap.
 */
export function validateOccurrence(f: OccurrenceForm, original: AdminOccurrence): ValidatedOccurrence {
  const errors: OccurrenceErrors = {};
  const built = buildPortion(f);
  if (built.error) errors[built.error[0]] = built.error[1];
  const label = f.portionLabel.trim();
  if (label.length > LABEL_MAX) errors.portionLabel = 'admin.schedule.error.label';
  const recap = f.recapNote.trim();
  if (recap.length > RECAP_MAX) errors.recap = 'admin.schedule.error.recap';
  if (Object.keys(errors).length > 0) return { errors };

  const patch: Record<string, unknown> = {};
  if (JSON.stringify(built.portion) !== JSON.stringify(original.portion)) patch.portion = built.portion;
  if ((label || null) !== original.portionLabel) patch.portionLabel = label || null;
  if ((recap || null) !== original.recapNote) {
    patch.recapNote = recap || null;
    patch.recapLocale = recap ? f.recapLocale : null;
  } else if (recap && f.recapLocale !== original.recapLocale) {
    patch.recapLocale = f.recapLocale;
  }
  const wasCancelled = original.status === 'cancelled';
  if (f.cancelled !== wasCancelled) {
    patch.status = f.cancelled ? 'cancelled' : 'scheduled';
    if (f.cancelled) patch.notify = f.notify;
  }
  if (Object.keys(patch).length === 0) return { errors: { nothing: 'admin.schedule.error.nothing' } };

  const parsed = OccurrenceUpdate.safeParse(patch);
  if (!parsed.success) return { errors: { nothing: 'errors.validation_failed' } };
  return { errors, body: parsed.data };
}

/** Whether the date has passed, so it can be recapped but not cancelled. */
export const isPast = (o: AdminOccurrence, now: Date): boolean => Date.parse(o.endsAt) < now.getTime();
