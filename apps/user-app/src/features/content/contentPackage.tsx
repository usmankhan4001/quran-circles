import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ContentProvider,
  ContinueReadingCard,
  FIVE_PRAYERS,
  NextPrayerCard,
  PAKISTAN_CITIES,
  PrayerTimesScreen,
  QuranIndexScreen,
  QuranReaderScreen,
  QuranTextCredit,
  computeDay,
  createContentServices,
  formatClock,
  nextPrayer,
  offsetOf,
  todayAt,
  useContent,
  useNow,
  type CreateContentServicesOptions,
  type QuranVerse,
  type ReaderTarget,
  type ViewState,
} from '@qc/content';
import { Card, PrayerStrip, SegmentedControl, Skeleton, Text, screenGutter, spacing } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import type { ContentModules, QuranPlace, ReaderRequest } from './modules';

/**
 * The city chosen in the prayer view. The package keeps it in its own saved state and does not
 * publish a hook for it yet, so this reads it again every couple of seconds; Home and the
 * Quran & Prayer tab are both mounted, and a city chosen in one has to reach the other.
 */
function usePrayerCityId(): string | null {
  const { services } = useContent();
  const tick = useNow(2000);
  const [cityId, setCityId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void services.viewState.load().then((state) => {
      if (active) setCityId(state.placeId);
    });
    return () => {
      active = false;
    };
  }, [services, tick]);
  return cityId;
}

/** Home's prayer strip: today's five prayers at the chosen city, worked out on the phone. */
function HomePrayerStrip({ onPress }: { onPress?: () => void }) {
  const { t, locale } = useI18n();
  const cityId = usePrayerCityId();
  const now = useNow(30_000);
  const place = PAKISTAN_CITIES.find((city) => city.id === cityId) ?? null;
  if (!place) {
    return (
      <Card
        {...(onPress ? { onPress } : {})}
        accessibilityLabel={t('prayer.noCity.title')}
        testID="home-prayer-city"
      >
        <Text variant="label">{t('prayer.noCity.title')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('prayer.noCity.body')}
        </Text>
      </Card>
    );
  }
  const day = computeDay(place, todayAt(place, now));
  const next = nextPrayer(place, now);
  const labels = { am: t('prayer.am'), pm: t('prayer.pm') };
  const prayers = FIVE_PRAYERS.map((key) => ({
    key,
    name: t(`prayer.${key}`),
    time: formatClock(day.times[key], offsetOf(place), { locale, labels }),
  }));
  const strip = (
    <PrayerStrip
      prayers={prayers}
      nextKey={next.prayer}
      nextLabel={t('prayer.next')}
      testID="home-prayer-strip"
    />
  );
  if (!onPress) return strip;
  return (
    <Pressable role="button" aria-label={t('home.prayer.title')} onPress={onPress}>
      {strip}
    </Pressable>
  );
}

/**
 * The words of one ayah, read through the package's own source and cache (the same path as the
 * reader), fetching only that ayah. Arabic always, with the text credit; the Urdu translation on an Urdu screen. There is no English
 * translation source, so an English screen shows the Arabic alone.
 */
function HomeAyahText({ surah, ayah }: QuranPlace) {
  const { locale } = useI18n();
  const { services } = useContent();
  const [verse, setVerse] = useState<QuranVerse | null>(null);
  useEffect(() => {
    let active = true;
    setVerse(null);
    services.source
      .getAyah(surah, ayah)
      .then((result) => {
        if (active) setVerse(result.verse);
      })
      .catch(() => {
        // Offline with nothing cached, or the source is down: the card keeps the reference.
      });
    return () => {
      active = false;
    };
  }, [services, surah, ayah]);
  if (!verse) return null;
  return (
    <View style={{ gap: spacing.sm }} testID="home-ayah-text">
      <Text variant="quran" lang="ar" align="center" testID="home-ayah-arabic">
        {verse.arabic}
      </Text>
      {locale === 'ur' && verse.urdu ? (
        <Text variant="body" lang="ur" testID="home-ayah-translation">
          {verse.urdu}
        </Text>
      ) : null}
      <QuranTextCredit />
    </View>
  );
}

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

/**
 * Builds the Quran and prayer modules from `@qc/content`. The package owns its own storage, text
 * cache and bookmark sync; this only gives it a device, a fetch and the signed-in API client,
 * and fits its components to the mount points the screens use.
 */
export function createContentModules(options: CreateContentServicesOptions): ContentModules {
  const services = createContentServices(options);

  return {
    Provider: ({ signedIn, hijriOffsetDays, children }) => (
      <ContentProvider services={services} signedIn={signedIn} hijriOffsetDays={hijriOffsetDays}>
        {children}
      </ContentProvider>
    ),
    QuranPrayerScreen: ({ reader }) => {
      const target = readerTarget(reader);
      // A new request mounts the tab again so it opens at the requested place.
      return (
        <AppQuranPrayerTab
          key={reader ? `${reader.surah}:${reader.ayah}:${reader.at ?? 0}` : 'tab'}
          {...(target ? { initialReader: target } : {})}
        />
      );
    },
    NextPrayerCard: ({ onPress }) => {
      // The city is the one chosen in the prayer view; the card asks for one until then.
      const cityId = usePrayerCityId();
      const place = PAKISTAN_CITIES.find((city) => city.id === cityId) ?? null;
      return <NextPrayerCard place={place} {...(onPress ? { onPress } : {})} />;
    },
    ContinueReadingCard: ({ onOpen }: { onOpen: (place: QuranPlace) => void }) => (
      <ContinueReadingCard onOpen={({ surah, ayah }) => onOpen({ surah, ayah })} />
    ),
    PrayerStrip: HomePrayerStrip,
    AyahText: HomeAyahText,
  };
}
