import { Suspense, lazy, memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { Card, PrayerStrip, Skeleton, Text, screenGutter, spacing } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
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
