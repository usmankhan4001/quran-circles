import {
  POSTER_FORMATS,
  type PosterFailureCode,
  type PosterFormat,
  type PosterLanguage,
  type PosterOutOfDateReason,
} from './enums';
import type { Session } from './schemas/sessions';
import { PosterSourceSnapshot, type PosterTemplateKey } from './schemas/posters';

/**
 * Poster rules shared by the API, the worker and the renderer (contract 1.0.0-rc.5). The snapshot
 * comparison and its tests came from `apps/poster-renderer/src/snapshot.ts` unchanged.
 */

/** The languages a poster shows, the leading one first. */
export const posterLanguagesOf = (language: PosterLanguage): Array<'en' | 'ur'> =>
  language === 'en'
    ? ['en']
    : language === 'ur'
      ? ['ur']
      : language === 'en_ur'
        ? ['en', 'ur']
        : ['ur', 'en'];

/** The leading language, stored as `posters.locale`. */
export const posterLocaleOf = (language: PosterLanguage): 'en' | 'ur' =>
  posterLanguagesOf(language)[0] ?? 'en';

/** Builds the snapshot from the contract's `Session`, plus the area name when the API has it. */
export function posterSnapshotFromSession(
  session: Session,
  sessionVersion: string,
  area: { en: string; ur: string | null } | null = null,
): PosterSourceSnapshot {
  return PosterSourceSnapshot.parse({
    sessionId: session.id,
    sessionVersion,
    localStartTime: session.localStartTime,
    durationMinutes: session.durationMinutes,
    daysOfWeek: session.daysOfWeek,
    startsOn: session.startsOn,
    endsOn: session.endsOn,
    timezone: session.timezone,
    venue: { id: session.venue.id, name: session.venue.name, area },
  });
}

const sameDays = (a: readonly number[], b: readonly number[]): boolean => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

const sameText = (
  a: { en: string; ur: string | null } | null,
  b: { en: string; ur: string | null } | null,
): boolean => (a === null || b === null ? a === b : a.en === b.en && a.ur === b.ur);

/**
 * Why a poster made from `made` no longer matches the session as it is now (`current`); empty when it
 * still matches. Only what the poster prints counts: the start time, the days (or the date of a
 * one-off lecture) and the venue (place, name or area). A changed duration, end date, title or
 * description does not: the poster does not print them, and editors type their own title.
 * Throws a RangeError for snapshots of two different sessions.
 */
export function posterOutOfDate(
  made: PosterSourceSnapshot,
  current: PosterSourceSnapshot,
): PosterOutOfDateReason[] {
  if (made.sessionId !== current.sessionId) throw new RangeError('snapshots of different sessions');
  const reasons: PosterOutOfDateReason[] = [];
  // A one-off lecture prints its date; a weekly session prints its days.
  const oneOff = made.daysOfWeek.length === 0 || current.daysOfWeek.length === 0;
  const timeChanged =
    made.localStartTime !== current.localStartTime ||
    !sameDays(made.daysOfWeek, current.daysOfWeek) ||
    made.timezone !== current.timezone ||
    (oneOff && made.startsOn !== current.startsOn);
  if (timeChanged) reasons.push('time');
  const venueChanged =
    made.venue.id !== current.venue.id ||
    !sameText(made.venue.name, current.venue.name) ||
    !sameText(made.venue.area, current.venue.area);
  if (venueChanged) reasons.push('venue');
  return reasons;
}

/** Whether the worker tries a failed render again (pg-boss retry). */
export const POSTER_FAILURE_RETRYABLE: Record<PosterFailureCode, boolean> = {
  invalid_request: false,
  text_too_long: false,
  busy: true,
  render_timeout: true,
  render_failed: true,
};

/**
 * The `posters.failure_code` for a failed call to the renderer, from its HTTP status and error code
 * (`RendererErrorResponse`). A network error or an unreadable answer is `render_failed`.
 */
export function posterFailureFromRenderer(status: number, code?: string): PosterFailureCode {
  if (code === 'text_too_long' || status === 422) return 'text_too_long';
  if (code === 'validation_failed' || status === 400 || status === 413) return 'invalid_request';
  if (code === 'busy' || status === 503) return 'busy';
  if (code === 'render_timeout' || status === 504) return 'render_timeout';
  return 'render_failed';
}

/**
 * Where the worker stores a rendered file: `posters/<session id>/<cache key>.<png|pdf>`. The key is
 * content-addressed (the renderer's cache key), so a retried job writes the same bytes to the same
 * place. The same rule as the renderer's `runPosterJob`.
 */
export function posterStorageKey(
  sessionId: string,
  cacheKey: string,
  contentType: 'image/png' | 'application/pdf',
): string {
  return `posters/${sessionId}/${cacheKey}.${contentType === 'application/pdf' ? 'pdf' : 'png'}`;
}

export interface DemoPosterTemplate {
  key: PosterTemplateKey;
  name: { en: string; ur: string };
  version: number;
  formats: readonly PosterFormat[];
  provisional: boolean;
}

/**
 * The renderer's own templates, which are the demo templates until the owner's final designs
 * arrive. The keys are not a closed list: a new design is a new `poster_templates` row and a new
 * template in the renderer, with no contract change. The development seed inserts these rows.
 */
export const DEMO_POSTER_TEMPLATES: readonly DemoPosterTemplate[] = [
  {
    key: 'cloud',
    name: { en: 'Cloud', ur: 'ہلکا' },
    version: 1,
    formats: POSTER_FORMATS,
    provisional: true,
  },
  {
    key: 'night',
    name: { en: 'Night', ur: 'رات' },
    version: 1,
    formats: POSTER_FORMATS,
    provisional: true,
  },
];
