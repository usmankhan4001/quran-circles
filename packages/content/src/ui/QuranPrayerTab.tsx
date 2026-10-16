import { useState } from 'react';
import { View } from 'react-native';
import { Header, SegmentedControl, Skeleton, screenGutter, spacing } from '@qc/ui';
import { PrayerTimesScreen } from './PrayerTimesScreen';
import { QuranIndexScreen } from './QuranIndexScreen';
import { QuranReaderScreen } from './QuranReaderScreen';
import { useViewState } from './hooks';
import { useContentI18n } from './i18n';
import type { ReaderTarget } from './reader';
import type { Section } from '../state/viewState';

export interface QuranPrayerTabProps {
  /** Opens the reader straight away, for a deep link. */
  initialReader?: ReaderTarget;
  /** Shares text from the reader. Defaults to the system share sheet. */
  onShare?: (message: string) => void;
  testID?: string;
}

/**
 * The whole fourth tab: a switch between the Quran and Prayer times (the choice is remembered),
 * the surah list, the reader, and the prayer view. The app puts this inside its tab bar.
 */
export function QuranPrayerTab({ initialReader, onShare, testID }: QuranPrayerTabProps) {
  const i18n = useContentI18n();
  const view = useViewState();
  const [reader, setReader] = useState<ReaderTarget | null>(initialReader ?? null);

  if (reader) {
    return (
      <QuranReaderScreen
        target={reader}
        onBack={() => setReader(null)}
        {...(onShare ? { onShare } : {})}
        testID={testID ? `${testID}-reader` : undefined}
      />
    );
  }

  return (
    <View style={{ flex: 1 }} testID={testID}>
      <Header
        variant="large"
        title={view.section === 'prayer' ? i18n.t('prayer.title') : i18n.t('quran.title')}
      />
      <View style={{ paddingHorizontal: screenGutter, paddingBottom: spacing.md }}>
        <SegmentedControl<Section>
          accessibilityLabel={i18n.t('tabs.quranPrayer')}
          value={view.section}
          onChange={(section) => view.update({ section })}
          options={[
            { value: 'quran', label: i18n.t('quran.tab.quran') },
            { value: 'prayer', label: i18n.t('quran.tab.prayer') },
          ]}
          testID="section-switch"
        />
      </View>
      {!view.loaded ? (
        <View style={{ padding: screenGutter }} testID="tab-loading">
          <Skeleton shape="text" lines={4} announce />
        </View>
      ) : view.section === 'prayer' ? (
        <PrayerTimesScreen
          placeId={view.placeId}
          onPlaceChange={(placeId) => view.update({ placeId })}
          calendarView={view.calendarView}
          onCalendarViewChange={(calendarView) => view.update({ calendarView })}
        />
      ) : (
        <QuranIndexScreen onOpen={setReader} />
      )}
    </View>
  );
}
