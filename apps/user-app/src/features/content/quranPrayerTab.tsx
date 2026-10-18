import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useContent, type ReaderTarget, type ViewState } from '@qc/content/home';
import {
  PillCta,
  PrayerTimesScreen,
  QuranHubHeader,
  QuranIndexScreen,
  QuranLeadCard,
  QuranReaderScreen,
  SectionHead,
  StatusLine,
  WhiteCard,
  useArtSize,
} from '@qc/content/screens';
import { Banner, Skeleton, Text, formatNumber, screenGutter, spacing, useTheme } from '@qc/ui';
import { ProfileButton } from '../../components/ProfileButton';
import { formatClockTime, formatShortDate } from '../../core/format';
import { useI18n } from '../../i18n/I18nProvider';
import { useNav } from '../../nav/NavProvider';
import { useAuthStatus, useOffline } from '../../providers/hooks';
import { useInsets } from '../../providers/insets';
import { useMemorisation } from '../memorisation/hooks';
import { countByStatus, reviseThisWeek, surahNames } from '../memorisation/logic';
import { useTodayPortions } from '../readAlong/hooks';
import { useUpdatesFeed } from '../updates/hooks';
import { describePortion } from '../session/portion';
import { useServices } from '../../providers/services';
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

/** The page: the `main` landmark on the page colour, with the status bar area kept green. */
function Page({ children, testID }: { children: ReactNode; testID?: string }) {
  const c = useTheme().colors;
  return (
    <View role="main" testID={testID} style={{ flex: 1, backgroundColor: c.background }}>
      {children}
    </View>
  );
}

/**
 * Tonight's circle portion (feature 4) as the lead card of the Quran list, when the person has a
 * session today with a portion in the Quran. It opens the reader at the portion's start.
 */
function usePortionLead(onOpen: (target: ReaderTarget) => void): {
  card: ReactNode;
  tags: Record<number, string> | undefined;
} {
  const { t, l, locale } = useI18n();
  const { portions } = useTodayPortions();
  const first = portions[0];
  if (!first) return { card: null, tags: undefined };
  const { occurrence, session, start } = first;
  const when = formatClockTime(occurrence.startsAt, session.timezone, locale);
  const portion = describePortion(occurrence, t, locale);
  const n = (value: number) => formatNumber(value, locale);
  const tags: Record<number, string> = {};
  for (const item of portions) {
    const p = item.occurrence.portion;
    if (p?.kind === 'surah') tags[p.surah] ??= t('quran.portion.tonight');
    if (p?.kind === 'ayah_range')
      tags[p.surah] ??= `${t('quran.portion.tonight')} · ${n(p.fromAyah)}–${n(p.toAyah)}`;
  }
  const names = surahNames(start.surah);
  return {
    tags,
    card: (
      <QuranLeadCard
        testID="quran-portion-card"
        status={t('quran.portion.status', { time: when })}
        title={portion ?? names.simple}
        detail={l(session.title).text}
        arabicName={names.arabic}
        actionLabel={t('readAlong.open')}
        onAction={() => onOpen({ kind: 'surah', id: start.surah, ayah: start.ayah })}
        actionTestID="quran-portion-open"
      />
    ),
  };
}

/**
 * "Hifz & Revision" (as drawn): two surahs from the person's memorisation list, the ones due for
 * revision first, each opening the reader; the count memorised opens the tracker. Shown only
 * when the tracker is on and holds something.
 */
function HifzSection({ onOpen }: { onOpen: (target: ReaderTarget) => void }) {
  const { t, locale } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();
  const { now } = useServices();
  const tracker = useMemorisation();
  const size = useArtSize();
  const items = tracker.data?.items ?? [];
  if (status !== 'signedIn' || !tracker.enabled || items.length === 0) {
    // As drawn, the section is always there; with nothing to show it opens the tracker.
    return (
      <View testID="quran-hifz" style={{ marginTop: spacing.xs }}>
        <SectionHead title={t('quran.hifz.title')} />
        <WhiteCard radius={18} padding={14} style={{ gap: 10 }}>
          <Text variant="caption" color="textSecondary">
            {status !== 'signedIn'
              ? t('memorisation.signedOut')
              : tracker.enabled
                ? t('memorisation.list.empty')
                : t('memorisation.off')}
          </Text>
          <PillCta
            label={t('memorisation.title')}
            height={30}
            small
            onPress={() => nav.go({ name: 'memorisation' })}
            testID="quran-hifz-open"
          />
        </WhiteCard>
      </View>
    );
  }
  const due = reviseThisWeek(items, now(), tracker.reviseAfterDays);
  const picks = [...due, ...items.filter((i) => !due.includes(i))].slice(0, 2);
  const memorised = countByStatus(items).memorised;
  return (
    <View testID="quran-hifz" style={{ marginTop: spacing.xs }}>
      <SectionHead
        title={t('quran.hifz.title')}
        more={t('quran.hifz.memorised', { count: formatNumber(memorised, locale) })}
        onMore={() => nav.go({ name: 'memorisation' })}
        moreTestID="quran-hifz-more"
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {picks.map((entry) => {
          const names = surahNames(entry.surah);
          return (
            <View key={entry.surah} style={{ flex: 1 }}>
              <WhiteCard radius={18} padding={12} style={{ gap: 6, flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                  }}
                >
                  <Text variant="caption" strong numberOfLines={1}>
                    {names.simple}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {t(`memorisation.status.${entry.status}`)}
                  </Text>
                </View>
                <Text
                  variant="quran"
                  lang="ar"
                  align="center"
                  decorative
                  style={size(17, 'quran', 'quran')}
                >
                  {names.arabic}
                </Text>
                <PillCta
                  label={t('quran.hifz.read')}
                  accessibilityLabel={`${t('quran.hifz.read')}: ${names.simple}`}
                  height={30}
                  small
                  onPress={() => onOpen({ kind: 'surah', id: entry.surah })}
                  testID={`quran-hifz-${entry.surah}`}
                />
              </WhiteCard>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The latest update from the person's masjids under the prayer times, as drawn. Signed in
 * only; nothing when there is none.
 */
function LatestUpdate() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const feed = useUpdatesFeed(1);
  const update = feed.items[0];
  if (!update) return null;
  const when = formatShortDate(update.publishedAt, 'Asia/Karachi', locale);
  return (
    <Pressable
      role="button"
      aria-label={`${t('updates.title')}. ${l(update.title).text}`}
      onPress={() => nav.go({ name: 'updates' })}
      testID="prayer-latest-update"
      style={{ marginTop: 4 }}
    >
      <WhiteCard padding={14}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            marginBottom: 4,
          }}
        >
          <StatusLine label={t('updates.title')} />
          <Text variant="caption" color="textMuted">
            {when}
          </Text>
        </View>
        <Text variant="label" strong numberOfLines={2}>
          {l(update.title).text}
        </Text>
        <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }} numberOfLines={2}>
          {l(update.body).text}
        </Text>
      </WhiteCard>
    </Pressable>
  );
}

/**
 * The Quran & Prayer tab as drawn (D17): the green header with the title and the Quran / Waqt
 * switch, a lead card half on it, then the list. The reader has its own plain top bar.
 */
function AppQuranPrayerTab({ initialReader }: { initialReader?: ReaderTarget }) {
  const { t } = useI18n();
  const insets = useInsets();
  const offline = useOffline();
  const c = useTheme().colors;
  const view = useSavedView();
  const [reader, setReader] = useState<ReaderTarget | null>(initialReader ?? null);
  const lead = usePortionLead(setReader);
  const banner = offline ? (
    <Banner kind="offline" title={t('ui.offlineTitle')} testID="offline-banner" />
  ) : null;

  if (reader) {
    return (
      <Page testID="quran-screen">
        <View style={{ paddingTop: insets.top, backgroundColor: c.background }} />
        {banner}
        <QuranReaderScreen
          target={reader}
          onBack={() => setReader(null)}
          testID="content-tab-reader"
        />
      </Page>
    );
  }
  const section = view.state?.section ?? 'quran';
  const header = (
    <View>
      <View style={{ paddingTop: insets.top, backgroundColor: c.hero }} />
      {banner}
      <QuranHubHeader
        section={section}
        onSectionChange={(next) => view.update({ section: next })}
        actions={<ProfileButton />}
      />
    </View>
  );
  return (
    <Page testID="quran-screen">
      <View style={{ flex: 1 }} testID="content-tab">
        {!view.state ? (
          <>
            {header}
            <View style={{ padding: screenGutter }} testID="tab-loading">
              <Skeleton shape="text" lines={4} announce />
            </View>
          </>
        ) : section === 'prayer' ? (
          <PrayerTimesScreen
            header={header}
            footer={<LatestUpdate />}
            placeId={view.state.placeId}
            ready
            onPlaceChange={(placeId) => view.update({ placeId })}
            calendarView={view.state.calendarView}
            onCalendarViewChange={(calendarView) => view.update({ calendarView })}
          />
        ) : (
          <QuranIndexScreen
            header={header}
            lead={lead.card}
            extra={<HifzSection onOpen={setReader} />}
            {...(lead.tags ? { portionTags: lead.tags } : {})}
            onOpen={setReader}
          />
        )}
      </View>
    </Page>
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
