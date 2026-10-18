import { pakistanDate, type Occurrence, type Portion, type Session } from '@qc/contracts';
import { juzOf, juzStart } from '@qc/content/meta';
import type { QuranPlace } from '../content/modules';

/**
 * Read along with your session (feature 4): on the day of a session the person registered for
 * or follows, Home offers "Read tonight's portion", opening the reader at the portion. Reading
 * any ayah of it counts as a day read with the `portion` source.
 */

/** Where the reader opens for a portion. A lesson has no place in the Quran, so it has none. */
export function portionStart(portion: Portion | null): QuranPlace | null {
  if (!portion) return null;
  switch (portion.kind) {
    case 'para': {
      const start = juzStart(portion.para);
      return { surah: start.surah, ayah: start.ayah };
    }
    case 'surah':
      return { surah: portion.surah, ayah: 1 };
    case 'ayah_range':
      return { surah: portion.surah, ayah: portion.fromAyah };
    case 'lesson':
      return null;
  }
}

/** Whether an ayah the person reached is part of the portion. */
export function placeInPortion(place: QuranPlace, portion: Portion | null): boolean {
  if (!portion) return false;
  switch (portion.kind) {
    case 'para':
      return juzOf(place) === portion.para;
    case 'surah':
      return place.surah === portion.surah;
    case 'ayah_range':
      return (
        place.surah === portion.surah &&
        place.ayah >= portion.fromAyah &&
        place.ayah <= portion.toAyah
      );
    case 'lesson':
      return false;
  }
}

/** One dated session the person is connected to, by a registration or a follow. */
export interface PortionCandidate {
  occurrence: Occurrence;
  session: Session;
  /** How the person is connected: registered sessions come first. */
  via: 'registration' | 'follow';
}

export interface TodayPortion extends PortionCandidate {
  start: QuranPlace;
}

/**
 * Today's portions (Pakistan date), soonest first, one per occurrence: not cancelled, and with a
 * place in the Quran to open. A session that already ended today still shows until midnight,
 * because the portion can be read after it.
 */
export function todaysPortions(candidates: readonly PortionCandidate[], now: Date): TodayPortion[] {
  const today = pakistanDate(now);
  const seen = new Set<string>();
  const result: TodayPortion[] = [];
  const ordered = [...candidates].sort(
    (a, b) =>
      a.occurrence.startsAt.localeCompare(b.occurrence.startsAt) ||
      (a.via === b.via ? 0 : a.via === 'registration' ? -1 : 1),
  );
  for (const candidate of ordered) {
    const { occurrence } = candidate;
    if (seen.has(occurrence.id)) continue;
    if (occurrence.status === 'cancelled') continue;
    if (pakistanDate(occurrence.startsAt) !== today) continue;
    const start = portionStart(occurrence.portion);
    if (!start) continue;
    seen.add(occurrence.id);
    result.push({ ...candidate, start });
  }
  return result;
}
