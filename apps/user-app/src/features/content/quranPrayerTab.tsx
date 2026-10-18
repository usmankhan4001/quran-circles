import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useContent, type ReaderTarget, type ViewState } from '@qc/content/home';
import { PrayerTimesScreen, QuranIndexScreen, QuranReaderScreen } from '@qc/content/screens';
import { SegmentedControl, Skeleton, screenGutter, spacing } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReaderRequest } from './modules';

// The Quran & Prayer tab, put together from `@qc/content/screens`. `contentPackage.tsx` loads
// this file only when the tab is opened (on the web, it is a download of its own).

/** The package's saved view (Quran or Prayer, the city, week or month), read and changed here. */
function useSavedView() {
  const { services } = useContent();
  const [state, setState] = useState<ViewState | null>(null);
  useEffect(() => {
    let active = true;
    void services.viewState.load().then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
    };
  }, [services]);
  const update = (change: Partial<ViewState>) => {
    setState((current) => (current ? { ...current, ...change } : current));
    void services.viewState.update(change);
  };
  return { state, update };
}

/**
 * The Quran & Prayer tab, put together from the package's screens under the app's own green
 * header, so the page has one title (the package's own tab adds a second, large one). The
 * switch, the saved choice and the screens are the package's.
 */
function AppQuranPrayerTab({ initialReader }: { initialReader?: ReaderTarget }) {
  const { t } = useI18n();
  const view = useSavedView();
  const [reader, setReader] = useState<ReaderTarget | null>(initialReader ?? null);
  if (reader) {
    return (
      <QuranReaderScreen
        target={reader}
        onBack={() => setReader(null)}
        testID="content-tab-reader"
      />
    );
  }
  const section = view.state?.section ?? 'quran';
  return (
    <View style={{ flex: 1 }} testID="content-tab">
      <View style={{ paddingHorizontal: screenGutter, paddingVertical: spacing.md }}>
        <SegmentedControl<ViewState['section']>
          accessibilityLabel={t('tabs.quranPrayer')}
          value={section}
          onChange={(next) => view.update({ section: next })}
          options={[
            { value: 'quran', label: t('quran.tab.quran') },
            { value: 'prayer', label: t('quran.tab.prayer') },
          ]}
          testID="section-switch"
        />
      </View>
      {!view.state ? (
        <View style={{ padding: screenGutter }} testID="tab-loading">
          <Skeleton shape="text" lines={4} announce />
        </View>
      ) : section === 'prayer' ? (
        <PrayerTimesScreen
          placeId={view.state.placeId}
          ready
          onPlaceChange={(placeId) => view.update({ placeId })}
          calendarView={view.state.calendarView}
          onCalendarViewChange={(calendarView) => view.update({ calendarView })}
        />
      ) : (
        <QuranIndexScreen onOpen={setReader} />
      )}
    </View>
  );
}

function readerTarget(request: ReaderRequest | undefined) {
  return request ? ({ kind: 'surah', id: request.surah, ayah: request.ayah } as const) : undefined;
}

/** The tab at the place a request asks for, or at its saved view. */
export default function QuranPrayerTab({ reader }: { reader?: ReaderRequest }) {
  const target = readerTarget(reader);
  // A new request mounts the tab again so it opens at the requested place.
  return (
    <AppQuranPrayerTab
      key={reader ? `${reader.surah}:${reader.ayah}:${reader.at ?? 0}` : 'tab'}
      {...(target ? { initialReader: target } : {})}
    />
  );
}
