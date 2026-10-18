import { Suspense, lazy, memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  ContentProvider,
  ContinueReadingCard,
  NextPrayerCard,
  QuranTextCredit,
  createContentServices,
  useContent,
  useNow,
  verseTranslation,
  type ContentServices,
  type CreateContentServicesOptions,
  type QuranVerse,
} from '@qc/content/home';
import {
  FIVE_PRAYERS,
  PAKISTAN_CITIES,
  computeDay,
  formatClock,
  nextPrayer,
  offsetOf,
  todayAt,
} from '@qc/content/prayer';
import { Skeleton, Text, screenGutter, spacing } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { HomePrayerTimes } from '../../ui/HomePrayerTimes';
import type { ContentModules, QuranPlace } from './modules';

/**
 * The Quran & Prayer tab's screens (the reader, the surah list, prayer times) are a file of
 * their own on the web, downloaded when the tab is first opened, so Home's start does not wait
 * for them. A phone bundles them anyway.
 */
const QuranPrayerTab = lazy(() => import('./quranPrayerTab'));

function TabLoading() {
  return (
    <View style={{ padding: screenGutter }} testID="tab-loading">
      <Skeleton shape="text" lines={4} announce />
    </View>
  );
}

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

/**
 * Home's prayer strip: today's five prayers at the city chosen in the prayer view, else at the
 * app's own city, worked out on the phone. The prayer whose time it is sits on a white pill.
 * With no city at all the strip still shows, with "--:--" for each time, and opens the prayer
 * view to choose one.
 */
function HomePrayerStrip({ onPress, citySlug }: { onPress?: () => void; citySlug?: string }) {
  const { t, locale } = useI18n();
  const cityId = usePrayerCityId();
  const now = useNow(30_000);
  const place =
    PAKISTAN_CITIES.find((city) => city.id === cityId) ??
    PAKISTAN_CITIES.find((city) => city.id === citySlug) ??
    null;
  const names = FIVE_PRAYERS.map((key) => ({ key, name: t(`prayer.${key}`) }));
  if (!place) {
    return (
      <HomePrayerTimes
        prayers={names.map((p) => ({ ...p, time: '--:--' }))}
        activeLabel={t('home.prayer.now')}
        accessibilityLabel={`${t('prayer.noCity.title')}. ${t('prayer.noCity.body')}`}
        {...(onPress ? { onPress } : {})}
        testID="home-prayer-strip"
      />
    );
  }
  const day = computeDay(place, todayAt(place, now));
  const next = nextPrayer(place, now);
  // The figures only, as drawn ("6:28"): the strip has no room for "pm" under each prayer.
  const labels = { am: '', pm: '' };
  const prayers = names.map((p) => ({
    ...p,
    time: formatClock(day.times[p.key], offsetOf(place), { locale, labels }).trim(),
  }));
  return (
    <HomePrayerTimes
      prayers={prayers}
      activeKey={next.current ?? next.prayer}
      activeLabel={next.current ? t('home.prayer.now') : t('prayer.next')}
      accessibilityLabel={t('home.prayer.title')}
      {...(onPress ? { onPress } : {})}
      testID="home-prayer-strip"
    />
  );
}

/**
 * The words of one ayah, read through the package's own source and cache (the same path as the
 * reader), fetching only that ayah. Arabic always, with the text credit, and Maududi's translation
 * in the screen's language (Urdu or English) when the source has it.
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
  const translation = verseTranslation(verse, locale);
  return (
    <View style={{ gap: spacing.sm }} testID="home-ayah-text">
      <Text variant="quran" lang="ar" align="center" testID="home-ayah-arabic">
        {verse.arabic}
      </Text>
      {translation.text ? (
        <Text variant="body" lang={translation.lang} testID="home-ayah-translation">
          {translation.text}
        </Text>
      ) : null}
      <QuranTextCredit />
    </View>
  );
}

/**
 * Builds the Quran and prayer modules from `@qc/content`. The package owns its own storage, text
 * cache and bookmark sync; this only gives it a device, a fetch and the signed-in API client,
 * and fits its components to the mount points the screens use.
 */
export function createContentModules(
  options: CreateContentServicesOptions,
  services: ContentServices = createContentServices(options),
): ContentModules {
  return {
    Provider: ({ signedIn, hijriOffsetDays, children }) => (
      <ContentProvider services={services} signedIn={signedIn} hijriOffsetDays={hijriOffsetDays}>
        {children}
      </ContentProvider>
    ),
    QuranPrayerScreen: ({ reader }) => (
      <Suspense fallback={<TabLoading />}>
        <QuranPrayerTab {...(reader ? { reader } : {})} />
      </Suspense>
    ),
    NextPrayerCard: ({ onPress }) => {
      // The city is the one chosen in the prayer view; the card asks for one until then.
      const cityId = usePrayerCityId();
      const place = PAKISTAN_CITIES.find((city) => city.id === cityId) ?? null;
      return <NextPrayerCard place={place} {...(onPress ? { onPress } : {})} />;
    },
    ContinueReadingCard: ({ onOpen }: { onOpen: (place: QuranPlace) => void }) => (
      <ContinueReadingCard onOpen={({ surah, ayah }) => onOpen({ surah, ayah })} />
    ),
    // Memoised: Home passes a stable `onPress`, so the strip draws again only on its own clock.
    PrayerStrip: memo(HomePrayerStrip),
    AyahText: HomeAyahText,
    subscribeReading: (listener) =>
      services.readingPosition.subscribe(() => {
        services.readingPosition
          .getLocal()
          .then((value) => {
            if (value) listener({ surah: value.surah, ayah: value.ayah, at: value.updatedAt });
          })
          .catch(() => undefined);
      }),
  };
}
