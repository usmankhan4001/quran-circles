import { useEffect, useState } from 'react';
import {
  ContentProvider,
  ContinueReadingCard,
  NextPrayerCard,
  PAKISTAN_CITIES,
  QuranPrayerTab,
  createContentServices,
  useContent,
  useNow,
  type CreateContentServicesOptions,
} from '@qc/content';
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
        <QuranPrayerTab
          key={reader ? `${reader.surah}:${reader.ayah}:${reader.at ?? 0}` : 'tab'}
          {...(target ? { initialReader: target } : {})}
          testID="content-tab"
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
  };
}
