import type { Occurrence } from '@qc/contracts';
import { toLocalDigits } from '../../core/format';
import type { Locale } from '@qc/contracts';
import type { TFunction } from '../../i18n/translate';

/**
 * What the session reads on a day, in words: "Para 5", "Surah 36, ayahs 1 to 12" or a lesson
 * title. Surah names come with the reader from the content lane; until then it is the number.
 */
export function describePortion(
  occurrence: Pick<Occurrence, 'portion' | 'portionLabel'>,
  t: TFunction,
  locale: Locale,
): string | null {
  const portion = occurrence.portion;
  if (!portion) return occurrence.portionLabel;
  const n = (value: number) => toLocalDigits(value, locale);
  switch (portion.kind) {
    case 'para':
      return t('session.portion.para', { number: n(portion.para) });
    case 'surah':
      return t('session.portion.surah', { number: n(portion.surah) });
    case 'ayah_range':
      return t('session.portion.ayahRange', {
        surah: n(portion.surah),
        from: n(portion.fromAyah),
        to: n(portion.toAyah),
      });
    case 'lesson':
      return portion.title;
  }
}
