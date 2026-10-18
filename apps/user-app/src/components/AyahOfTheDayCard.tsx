import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Skeleton, Text, formatNumber, spacing, useTheme } from '@qc/ui';
import type { Follow, Localized } from '@qc/contracts';
import { useAyahOfTheDay, type DailyAyah } from '../features/ayah/useAyahOfTheDay';
import { useMyFollows } from '../features/journey/hooks';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import type { LocalizedText } from '../i18n/localized';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  ayah: { gap: spacing.md },
  rule: { height: 3, width: spacing.xxl, borderRadius: 2 },
});

/**
 * Who chose the ayah, when it is a coordinator's pick for a masjid or circle the person follows.
 * The national pick and the built-in list say nothing: they are the default.
 */
export function ayahSourceLine(
  ayah: DailyAyah,
  follows: readonly Follow[] | undefined,
  t: TFunction,
  l: (value: Localized) => LocalizedText,
): string | null {
  if (ayah.source === 'circle') {
    const follow = follows?.find((f) => f.circleId !== null && f.circleId === ayah.circleId);
    return follow ? t('home.ayah.from', { name: l(follow.name).text }) : t('home.ayah.from.circle');
  }
  if (ayah.source === 'venue') {
    const follow = follows?.find((f) => f.venueId !== null && f.venueId === ayah.venueId);
    return follow ? t('home.ayah.from', { name: l(follow.name).text }) : t('home.ayah.from.venue');
  }
  return null;
}

/**
 * Home's ayah of the day (feature 2). The pick is numbers only; the Arabic (Quran font), the
 * translation in the screen's language (`verseTranslation`) and the text credit come from the
 * content package's `AyahText` mount, read from the reader's own source. "Read this ayah" opens
 * the reader at it: the `quran` route, `/quran?surah=…&ayah=…`.
 */
function AyahOfTheDayCardContent() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { content, now } = useServices();
  const { ayah } = useAyahOfTheDay();
  const follows = useMyFollows();
  const AyahText = content.AyahText;
  const from = ayah ? ayahSourceLine(ayah, follows.data, t, l) : null;

  return (
    <Card testID="home-ayah">
      <View style={styles.ayah}>
        <View style={[styles.rule, { backgroundColor: c.decoration }]} aria-hidden />
        <Text variant="eyebrow" color="textSecondary">
          {t('home.ayah.title')}
        </Text>
        {ayah ? (
          <>
            {AyahText ? <AyahText surah={ayah.surah} ayah={ayah.ayah} /> : null}
            <Text variant="label" color="textSecondary" testID="home-ayah-reference">
              {t('home.ayah.reference', {
                surah: formatNumber(ayah.surah, locale),
                ayah: formatNumber(ayah.ayah, locale),
              })}
            </Text>
            {from ? (
              <Text variant="caption" color="textSecondary" testID="home-ayah-from">
                {from}
              </Text>
            ) : null}
            <Button
              variant="secondary"
              label={t('home.ayah.read')}
              onPress={() =>
                nav.tab({
                  name: 'quran',
                  reader: { surah: ayah.surah, ayah: ayah.ayah, at: now().getTime() },
                })
              }
              testID="home-ayah-read"
            />
          </>
        ) : (
          <View testID="home-ayah-loading">
            <Skeleton shape="text" lines={2} announce />
          </View>
        )}
      </View>
    </Card>
  );
}

/** It takes no props, so it draws again when its own data changes, not each time Home does. */
export const AyahOfTheDayCard = memo(AyahOfTheDayCardContent);
