import { useState } from 'react';
import { View } from 'react-native';
import { Skeleton, screenGutter } from '@qc/ui';
import { PrayerTimesScreen } from './PrayerTimesScreen';
import { QuranIndexScreen } from './QuranIndexScreen';
import { QuranReaderScreen } from './QuranReaderScreen';
import { useViewState } from './hooks';
import { QuranHubHeader } from './QuranHubHeader';
import type { ReaderTarget } from './reader';

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

  const header = (
    <QuranHubHeader
      section={view.section}
      onSectionChange={(section) => view.update({ section })}
    />
  );

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {!view.loaded ? (
        <>
          {header}
          <View style={{ padding: screenGutter }} testID="tab-loading">
            <Skeleton shape="text" lines={4} announce />
          </View>
        </>
      ) : view.section === 'prayer' ? (
        <PrayerTimesScreen
          header={header}
          placeId={view.placeId}
          onPlaceChange={(placeId) => view.update({ placeId })}
          calendarView={view.calendarView}
          onCalendarViewChange={(calendarView) => view.update({ calendarView })}
        />
      ) : (
        <QuranIndexScreen header={header} onOpen={setReader} />
      )}
    </View>
  );
}
