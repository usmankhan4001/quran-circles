import { View } from 'react-native';
import { Button, Card, Text, spacing } from '@qc/ui';
import { getSurah } from '../meta/surahs';
import { surahName } from './format';
import { useReadingPosition } from './hooks';
import { useContentI18n } from './i18n';

export interface ContinueReadingCardProps {
  /** Opens the reader at the saved place, or at the first surah when nothing has been read. */
  onOpen: (target: { surah: number; ayah: number }) => void;
  /**
   * `home` is the card on the Home tab, which also invites a first read. `tab` is the one at the
   * top of the Quran list: it shows only once something has been read, with a Continue button.
   */
  variant?: 'home' | 'tab';
  testID?: string;
}

/** Home card: where the person stopped reading. "Start reading" when nothing has been read. */
export function ContinueReadingCard({
  onOpen,
  variant = 'home',
  testID,
}: ContinueReadingCardProps) {
  const i18n = useContentI18n();
  const { position, loading } = useReadingPosition();
  const surah = position ? getSurah(position.surah) : undefined;
  if (loading) return null;

  if (!position || !surah) {
    if (variant === 'tab') return null;
    return (
      <Card testID={testID}>
        <Text variant="title3" heading={2}>
          {i18n.t('home.reading.title')}
        </Text>
        <View style={{ height: spacing.md }} />
        <Button
          label={i18n.t('home.reading.start')}
          onPress={() => onOpen({ surah: 1, ayah: 1 })}
        />
      </Card>
    );
  }
  const place = i18n.t('home.reading.position', {
    surah: surahName(i18n, surah),
    ayah: i18n.n(position.ayah),
  });
  if (variant === 'tab') {
    return (
      <Card testID={testID}>
        <Text variant="caption" color="textSecondary">
          {i18n.t('home.reading.title')}
        </Text>
        <Text variant="title3" heading={2} testID="continue-reading-place">
          {place}
        </Text>
        <View style={{ height: spacing.md }} />
        <Button
          size="large"
          label={i18n.t('quran.continue')}
          onPress={() => onOpen({ surah: position.surah, ayah: position.ayah })}
          testID="continue-reading-button"
        />
      </Card>
    );
  }
  return (
    <Card
      testID={testID}
      onPress={() => onOpen({ surah: position.surah, ayah: position.ayah })}
      accessibilityLabel={`${i18n.t('home.reading.title')}. ${place}`}
    >
      <Text variant="caption" color="textSecondary" decorative>
        {i18n.t('home.reading.title')}
      </Text>
      <View style={{ height: spacing.xs }} />
      <Text variant="title3" heading={2} decorative testID="continue-reading-place">
        {place}
      </Text>
    </Card>
  );
}
