import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Pressable, ScrollView, Share, View } from 'react-native';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  IconButton,
  ListItem,
  SegmentedControl,
  Sheet,
  Skeleton,
  Text,
  TextField,
  ThemeProvider,
  minTouchTarget,
  screenGutter,
  spacing,
  useTheme,
} from '@qc/ui';
import type { BookmarkEntry } from '../bookmarks/service';
import { formatVerseKey } from '../meta/ayah';
import { searchSurahs } from '../meta/search';
import { ayahCountOf, getSurah, JUZ_COUNT, SURAH_COUNT } from '../meta/surahs';
import { arabicZoom, type ReaderPrefs } from '../quran/prefs';
import type { QuranPassage } from '../quran/types';
import { QuranSourceError } from '../quran/types';
import { surahName } from './format';
import {
  useBookmarks,
  useMushafPageOf,
  usePassage,
  useReaderPrefs,
  useReadingPosition,
  useSavedSurahs,
} from './hooks';
import { useContentI18n, type ContentI18n } from './i18n';
import { MushafView } from './MushafView';
import { BarIcon } from './parts';
import { usePositionTracker } from './positionTracker';
import { QuranTextCredit } from './QuranText';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import {
  buildRows,
  resolveJump,
  rowIndexFor,
  verseTranslation,
  type ReaderRow,
  type ReaderTarget,
} from './reader';

type SheetName = 'settings' | 'surahs' | null;

export interface QuranReaderScreenProps {
  target: ReaderTarget;
  onBack: () => void;
  /** Called when the reader moves on to another surah or juz, so the app can keep its route in step. */
  onTargetChange?: (target: ReaderTarget) => void;
  /** Shares text. Defaults to the system share sheet. */
  onShare?: (message: string) => void;
  testID?: string;
}

const SCROLL_SETTLE_MS = 600;

function defaultShare(message: string) {
  void Share.share({ message }).catch(() => undefined);
}

/**
 * The reader, in the look the person chose for it. "Auto" follows the app; "Light" and "Night"
 * set the reader's own look (the app's high-contrast look is never overridden).
 */
export function QuranReaderScreen(props: QuranReaderScreenProps) {
  const theme = useTheme();
  const { prefs, update } = useReaderPrefs();
  const mode =
    theme.mode === 'highContrast' || prefs.theme === 'auto'
      ? theme.mode
      : prefs.theme === 'night'
        ? 'dark'
        : 'light';
  // Always wrapped, so changing the look keeps the same tree (the settings sheet stays open and
  // the place in the list is kept).
  return (
    <ThemeProvider
      mode={mode}
      locale={theme.locale}
      direction={theme.direction}
      textSize={theme.textSize}
      reduceMotion={theme.reduceMotion}
      style={{ flex: 1 }}
    >
      <ReaderBody {...props} prefs={prefs} update={update} />
    </ThemeProvider>
  );
}

/**
 * The reader: Arabic with a translation under each ayah (Urdu on an Urdu screen, English on an
 * English screen, both Maududi's) or the Arabic-only Mushaf page, a text size, quick moves
 * between surahs, and a mark on any ayah. The last place reached is saved as the reading position.
 *
 * Page turn: the previous/next surah buttons follow the screen's direction, as in the design
 * (`docs/design/screens/quran-and-prayer.md`, open question 2 is answered by the new design).
 */
function ReaderBody({
  target,
  onBack,
  onTargetChange,
  onShare = defaultShare,
  testID,
  prefs,
  update,
}: QuranReaderScreenProps & { prefs: ReaderPrefs; update: (patch: Partial<ReaderPrefs>) => void }) {
  const i18n = useContentI18n();
  const theme = useTheme();
  const bookmarks = useBookmarks();
  const tracker = usePositionTracker();
  const [requested, setRequested] = useState<ReaderTarget>(target);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [jumpText, setJumpText] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [surahQuery, setSurahQuery] = useState('');
  const listRef = useRef<FlatList<ReaderRow>>(null);

  // A new target from the app (a deep link, an opened bookmark) replaces the current request.
  const firstTarget = useRef(target);
  useEffect(() => {
    if (firstTarget.current === target) return;
    firstTarget.current = target;
    setRequested(target);
  }, [target]);

  const state = usePassage({ kind: requested.kind, id: requested.id });
  const shown: QuranPassage | null = state.status === 'ready' ? state.passage : state.previous;
  const rows = useMemo(() => (shown ? buildRows(shown) : []), [shown]);

  // Scroll to the asked-for ayah once its passage is on screen.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const { passage } = state;
    if (passage.kind !== requested.kind || passage.id !== requested.id) return;
    tracker.setTracking(false);
    const index = rowIndexFor(rows, requested);
    const move = setTimeout(() => {
      const list = listRef.current;
      // From the top of a passage, keep the surah heading above the first ayah in view.
      const fromTop = index === 0 || (requested.ayah ?? 1) <= 1;
      if (list && rows.length > 0 && fromTop) {
        list.scrollToOffset({ offset: 0, animated: false });
      } else if (list && rows.length > 0) {
        try {
          list.scrollToIndex({ index, animated: false });
        } catch {
          list.scrollToOffset({ offset: 0, animated: false });
        }
      }
      settleTimer.current = setTimeout(() => tracker.setTracking(true), SCROLL_SETTLE_MS);
    }, 0);
    return () => {
      clearTimeout(move);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // `tracker` is left out on purpose: its methods only read refs.
  }, [state.status === 'ready' ? state.passage : null, requested]);

  const go = useCallback(
    (next: ReaderTarget) => {
      setRequested(next);
      onTargetChange?.(next);
    },
    [onTargetChange],
  );

  const toggleBookmark = useCallback(
    (surah: number, ayah: number) => {
      void bookmarks.toggleAyah({ surah, ayah });
    },
    [bookmarks],
  );

  const share = useCallback(
    (row: Extract<ReaderRow, { type: 'verse' }>) => {
      const key = formatVerseKey({ surah: row.verse.surah, ayah: row.verse.ayah });
      const parts = [i18n.t('quran.share.title', { key }), row.verse.arabic];
      const translation = verseTranslation(row.verse, i18n.locale).text;
      if (translation) parts.push(translation);
      onShare(parts.join('\n'));
    },
    [i18n, onShare],
  );

  const submitJump = useCallback(() => {
    if (!shown) return;
    const result = resolveJump(jumpText, shown);
    if (!result.ok) {
      setJumpError(
        shown.kind === 'surah'
          ? i18n.t('quran.reader.jump.invalid', { max: i18n.n(ayahCountOf(shown.id)) })
          : i18n.t('quran.reader.jump.invalidJuz'),
      );
      return;
    }
    setJumpError(null);
    setJumpText('');
    setSheet(null);
    tracker.saveNow({ surah: result.surah, ayah: result.ayah });
    setRequested(
      shown.kind === 'surah'
        ? { kind: 'surah', id: shown.id, ayah: result.ayah }
        : { kind: 'juz', id: shown.id, ayah: result.ayah, surah: result.surah },
    );
  }, [i18n, jumpText, shown, tracker]);

  const savedSurahs = useSavedSurahs();
  const { position } = useReadingPosition();

  // The most recent mark on an ayah ("My last mark").
  const lastMark = useMemo(() => latestAyahMark(bookmarks.items), [bookmarks.items]);

  const title = headerTitle(i18n, shown, requested);
  const surahShown =
    (shown?.kind ?? requested.kind) === 'surah' ? (shown?.id ?? requested.id) : null;
  const subtitle =
    shown?.kind === 'surah' ? i18n.tn('quran.surah.ayahs', ayahCountOf(shown.id)) : undefined;
  const savedOffline = surahShown !== null && savedSurahs.has(surahShown);

  // The Arabic at the kit's Quran size, scaled by the reader's own size steps.
  const zoom = arabicZoom(prefs.arabicZoomIndex);
  const baseArabic = theme.type('quran', 'quran');
  const arabicStyle = useMemo(
    () => ({
      fontSize: Math.round(baseArabic.fontSize * zoom),
      lineHeight: Math.round(baseArabic.lineHeight * zoom),
    }),
    [baseArabic.fontSize, baseArabic.lineHeight, zoom],
  );

  const highlight =
    shown &&
    requested.ayah !== undefined &&
    shown.kind === requested.kind &&
    shown.id === requested.id
      ? `${requested.kind === 'surah' ? requested.id : (requested.surah ?? '')}:${requested.ayah}`
      : null;

  const renderItem = useCallback(
    ({ item }: { item: ReaderRow }) =>
      item.type === 'heading' ? (
        <HeadingRow row={item} arabicStyle={arabicStyle} i18n={i18n} />
      ) : (
        <VerseRow
          row={item}
          i18n={i18n}
          arabicStyle={arabicStyle}
          showTranslation={prefs.showTranslation}
          bookmarked={bookmarks.isBookmarked({ surah: item.verse.surah, ayah: item.verse.ayah })}
          lastMark={lastMark === item.key}
          highlighted={highlight === item.key}
          onToggleBookmark={toggleBookmark}
          onShare={share}
        />
      ),
    [
      arabicStyle,
      i18n,
      prefs.showTranslation,
      bookmarks,
      lastMark,
      highlight,
      toggleBookmark,
      share,
    ],
  );

  const topBar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        minHeight: 56,
      }}
    >
      <BarIcon
        icon="caret-left"
        accessibilityLabel={theme.t('ui.back')}
        onPress={() => {
          tracker.flush();
          onBack();
        }}
        testID="reader-back"
      />
      <Pressable
        role="button"
        aria-label={`${i18n.t('quran.reader.surahs')}. ${title}`}
        onPress={() => setSheet('surahs')}
        testID="reader-surahs"
        style={{ flex: 1, minHeight: minTouchTarget, justifyContent: 'center' }}
      >
        <Text variant="title3" heading={1} numberOfLines={1} decorative testID="reader-title">
          {title}
        </Text>
        {subtitle ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="caption" color="textMuted" decorative>
              {subtitle}
            </Text>
            {savedOffline ? (
              <View role="img" aria-label={i18n.t('quran.offline.saved')} testID="reader-offline">
                <Icon name="cloud-check" size={16} color={theme.colors.textMuted} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      <BarIcon
        icon="sliders-horizontal"
        accessibilityLabel={i18n.t('quran.reader.settings')}
        onPress={() => setSheet('settings')}
        testID="reader-settings"
      />
    </View>
  );

  const current = shown ?? null;
  const stripKind = current?.kind ?? requested.kind;
  const stripId = current?.id ?? requested.id;
  const strip = (
    <TabStrip
      kind={stripKind}
      id={stripId}
      onGo={(id) => go({ kind: stripKind, id })}
      i18n={i18n}
    />
  );

  // "English/Urdu translation" and "Arabic only" are two ways to read: the first is the ayah-by-
  // ayah page with the translation, the second the Mushaf page (or the ayahs with no translation
  // when that is what the settings ask for).
  const readingMode = prefs.layout === 'ayah' && prefs.showTranslation ? 'translation' : 'arabic';
  const modeSwitch = (
    <View style={{ paddingHorizontal: screenGutter, paddingVertical: spacing.sm }}>
      <SegmentedControl<'translation' | 'arabic'>
        accessibilityLabel={i18n.t('quran.reader.translation')}
        value={readingMode}
        onChange={(next) => {
          if (next === 'translation') update({ layout: 'ayah', showTranslation: true });
          else if (readingMode === 'translation') update({ layout: 'mushaf' });
        }}
        options={[
          { value: 'translation', label: i18n.t('quran.reader.withTranslation') },
          { value: 'arabic', label: i18n.t('quran.reader.arabicOnly') },
        ]}
        testID="reader-mode"
      />
    </View>
  );

  const notice = noticeFor(state, shown, i18n, theme.t('ui.retry'));

  // The pager (a surah only), then the credit for the Arabic text shown above it.
  const footer = shown ? (
    <View style={{ gap: spacing.lg }}>
      {shown.kind === 'surah' ? (
        <SurahPager
          surah={shown.id}
          onGo={(id) => go({ kind: 'surah', id })}
          i18n={i18n}
          rtl={theme.direction === 'rtl'}
        />
      ) : null}
      <View style={styles.gutter}>
        <QuranTextCredit testID="reader-text-credit" />
      </View>
    </View>
  ) : null;

  // The Mushaf page: it opens on the page of the ayah asked for, else of the last place read in
  // this surah, else of the passage's first ayah; then the pager turns pages from there.
  const anchor = anchorOf(requested, shown, position);
  const lookup = useMushafPageOf(anchor.surah, anchor.ayah, prefs.layout === 'mushaf');
  const anchorPage = lookup.page;
  const [mushafPage, setMushafPage] = useState<number | null>(null);
  useEffect(() => {
    if (anchorPage !== null) setMushafPage(anchorPage);
  }, [anchorPage]);
  const markHighlight = useMemo(() => {
    if (requested.ayah !== undefined) {
      return {
        surah: requested.kind === 'surah' ? requested.id : (requested.surah ?? anchor.surah),
        ayah: requested.ayah,
      };
    }
    return lastMark ? parseKey(lastMark) : null;
  }, [requested, anchor.surah, lastMark]);

  let body: ReactElement;
  if (prefs.layout === 'mushaf') {
    body = (
      <MushafView
        page={mushafPage}
        onPageChange={setMushafPage}
        lookupError={lookup.error}
        onRetryLookup={lookup.reload}
        highlight={markHighlight}
        zoom={zoom}
        testID="reader-mushaf"
      />
    );
  } else if (!shown && state.status === 'error') {
    body = (
      <View style={styles.pad}>
        <ErrorState
          kind={isOffline(state.error) ? 'offline' : 'generic'}
          {...(isOffline(state.error)
            ? { description: i18n.t('quran.reader.offlineUncached') }
            : {})}
          onRetry={state.reload}
          testID="reader-error"
        />
      </View>
    );
  } else if (!shown) {
    body = (
      <View style={styles.pad} aria-label={i18n.t('quran.reader.loading')} testID="reader-loading">
        <Skeleton shape="text" lines={6} announce />
      </View>
    );
  } else {
    body = (
      <FlatList<ReaderRow>
        key={`${shown.kind}-${shown.id}`}
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        extraData={`${prefs.showTranslation}-${prefs.arabicZoomIndex}-${bookmarks.items.length}-${highlight ?? ''}-${lastMark ?? ''}`}
        initialNumToRender={Math.min(rows.length, Math.max(12, rowIndexFor(rows, requested) + 8))}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
          setTimeout(
            () => listRef.current?.scrollToIndex({ index: info.index, animated: false }),
            100,
          );
        }}
        onViewableItemsChanged={tracker.onViewableItemsChanged}
        viewabilityConfig={tracker.viewabilityConfig}
        ListFooterComponent={footer ?? undefined}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        testID="reader-list"
      />
    );
  }

  const results = useMemo(() => searchSurahs(surahQuery), [surahQuery]);
  const autoLook = theme.mode === 'dark' ? 'night' : 'light';

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID={testID}>
      {topBar}
      {strip}
      {notice}
      {modeSwitch}
      {body}

      <ReaderSettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        prefs={prefs}
        onChange={update}
        autoLook={autoLook}
      />

      <Sheet
        visible={sheet === 'surahs'}
        onClose={() => {
          setSheet(null);
          setJumpError(null);
        }}
        title={i18n.t('quran.reader.surahs')}
        testID="surahs-sheet"
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={i18n.t('quran.reader.jump')}
                value={jumpText}
                onChangeText={(text) => {
                  setJumpText(text);
                  setJumpError(null);
                }}
                keyboardType={shown?.kind === 'juz' ? 'numbers-and-punctuation' : 'number-pad'}
                contentDirection="ltr"
                {...(jumpError ? { error: jumpError } : {})}
                onSubmitEditing={submitJump}
                testID="jump-input"
              />
            </View>
            <Button
              variant="outline"
              label={i18n.t('quran.reader.jump.go')}
              onPress={submitJump}
              testID="jump-go"
            />
          </View>
          <TextField
            label={i18n.t('quran.search')}
            placeholder={i18n.t('quran.search.placeholder')}
            value={surahQuery}
            onChangeText={setSurahQuery}
            testID="reader-surah-search"
          />
          {results.map(({ surah }) => (
            <ListItem
              key={surah.id}
              testID={`reader-surah-${surah.id}`}
              title={surah.nameSimple}
              subtitle={surah.nameEnglish}
              leading={
                <Text color="textSecondary" decorative>
                  {i18n.n(surah.id)}
                </Text>
              }
              chevron={false}
              divider
              onPress={() => {
                setSheet(null);
                setSurahQuery('');
                go({ kind: 'surah', id: surah.id });
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = {
  fill: { flex: 1 },
  pad: { padding: screenGutter },
  gutter: { paddingHorizontal: screenGutter },
} as const;

function isOffline(error: unknown): boolean {
  return error instanceof QuranSourceError && error.code === 'offline';
}

function parseKey(key: string): { surah: number; ayah: number } | null {
  const [surah, ayah] = key.split(':').map(Number);
  return surah && ayah ? { surah, ayah } : null;
}

/** The key (`surah:ayah`) of the ayah marked most recently, or null. */
export function latestAyahMark(items: readonly BookmarkEntry[]): string | null {
  let best: BookmarkEntry | null = null;
  for (const b of items) {
    if (b.kind !== 'ayah' || b.surah === null || b.ayah === null) continue;
    if (!best || b.createdAt > best.createdAt) best = b;
  }
  return best ? `${best.surah}:${best.ayah}` : null;
}

/** The ayah the Mushaf page opens on. */
function anchorOf(
  requested: ReaderTarget,
  shown: QuranPassage | null,
  position: { surah: number; ayah: number } | null,
): { surah: number; ayah: number } {
  if (requested.ayah !== undefined) {
    return {
      surah: requested.kind === 'surah' ? requested.id : (requested.surah ?? 1),
      ayah: requested.ayah,
    };
  }
  if (requested.kind === 'surah') {
    if (position && position.surah === requested.id) return position;
    return { surah: requested.id, ayah: 1 };
  }
  const first = shown?.kind === 'juz' && shown.id === requested.id ? shown.verses[0] : undefined;
  return first ? { surah: first.surah, ayah: first.ayah } : { surah: 1, ayah: 1 };
}

function headerTitle(
  i18n: ContentI18n,
  shown: QuranPassage | null,
  requested: ReaderTarget,
): string {
  const kind = shown?.kind ?? requested.kind;
  const id = shown?.id ?? requested.id;
  if (kind === 'juz') return i18n.t('quran.juz.title', { number: i18n.n(id) });
  const info = getSurah(id);
  return info ? surahName(i18n, info) : i18n.n(id);
}

function noticeFor(
  state: ReturnType<typeof usePassage>,
  shown: QuranPassage | null,
  i18n: ContentI18n,
  retryLabel: string,
): ReactElement | null {
  if (state.status === 'error' && shown) {
    return (
      <View style={styles.gutter}>
        <Card variant="outlined" testID="reader-error-notice">
          <Text color="textDanger">
            {isOffline(state.error)
              ? i18n.t('quran.reader.offlineUncached')
              : i18n.t('quran.offline.unavailable')}
          </Text>
          <View style={{ height: spacing.sm }} />
          <View style={{ alignItems: 'flex-start' }}>
            <Button variant="secondary" label={retryLabel} onPress={state.reload} />
          </View>
        </Card>
      </View>
    );
  }
  if (shown?.stale && state.status === 'ready') {
    return (
      <View style={styles.gutter}>
        <Text variant="caption" color="textMuted" testID="reader-stale-note">
          {i18n.t('quran.reader.staleNote')}
        </Text>
      </View>
    );
  }
  return null;
}

function SurahPager({
  surah,
  onGo,
  i18n,
  rtl,
}: {
  surah: number;
  onGo: (id: number) => void;
  i18n: ContentI18n;
  rtl: boolean;
}) {
  // Previous at the start of the line, next at the end, in either direction.
  return (
    <View
      style={{
        flexDirection: rtl ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        paddingHorizontal: screenGutter,
        paddingTop: spacing.lg,
        gap: spacing.sm,
        flexWrap: 'wrap',
      }}
    >
      <Button
        variant="outline"
        label={i18n.t('quran.reader.previousSurah')}
        disabled={surah <= 1}
        onPress={() => onGo(surah - 1)}
        testID="reader-previous-surah"
      />
      <Button
        variant="outline"
        label={i18n.t('quran.reader.nextSurah')}
        disabled={surah >= SURAH_COUNT}
        onPress={() => onGo(surah + 1)}
        testID="reader-next-surah"
      />
    </View>
  );
}

interface ZoomStyle {
  fontSize: number;
  lineHeight: number;
}

/** The horizontal strip of nearby surahs (or juz) with the open one underlined in green. */
function TabStrip({
  kind,
  id,
  onGo,
  i18n,
}: {
  kind: 'surah' | 'juz';
  id: number;
  onGo: (id: number) => void;
  i18n: ContentI18n;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const max = kind === 'surah' ? SURAH_COUNT : JUZ_COUNT;
  const from = Math.max(1, Math.min(id - 3, max - 4));
  const ids = Array.from({ length: Math.min(5, max) }, (_, i) => from + i);
  const label = (n: number) => {
    if (kind === 'juz') return i18n.t('quran.juz.title', { number: i18n.n(n) });
    const info = getSurah(n);
    return `${i18n.n(n)} ${info ? surahName(i18n, info) : ''}`.trim();
  };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.hairline }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="tablist"
        aria-label={i18n.t(kind === 'surah' ? 'quran.reader.surahStrip' : 'quran.reader.juzStrip')}
        contentContainerStyle={{ paddingHorizontal: screenGutter, gap: spacing.lg + 2 }}
        testID="reader-strip"
      >
        {ids.map((n) => {
          const chosen = n === id;
          return (
            <Pressable
              key={n}
              role="tab"
              aria-selected={chosen}
              onPress={() => {
                if (!chosen) onGo(n);
              }}
              testID={`reader-strip-${n}`}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                borderBottomWidth: 2,
                marginBottom: -1,
                borderBottomColor: chosen ? c.accent : 'transparent',
              }}
            >
              <Text variant="caption" strong={chosen} color={chosen ? 'text' : 'textMuted'}>
                {label(n)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The opening formula of a surah, or the name of a surah that starts inside a juz. */
const HeadingRow = memo(function HeadingRow({
  row,
  arabicStyle,
  i18n,
}: {
  row: Extract<ReaderRow, { type: 'heading' }>;
  arabicStyle: ZoomStyle;
  i18n: ContentI18n;
}) {
  const c = useTheme().colors;
  const info = row.surah !== null ? getSurah(row.surah) : undefined;
  return (
    <View
      style={{
        marginHorizontal: screenGutter,
        paddingVertical: spacing.lg,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: c.hairline,
      }}
    >
      {info ? (
        <Text variant="title3" heading={2} align="center">
          {i18n.t('quran.surah.title', { name: surahName(i18n, info) })}
        </Text>
      ) : null}
      {row.bismillah ? (
        <Text variant="quran" lang="ar" align="center" style={arabicStyle} testID="bismillah">
          {row.bismillah}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * One ayah: the Arabic, the translation under it, and a line with "Ayah N", the mark and share.
 * The ayah marked last carries a green pill above it.
 */
const VerseRow = memo(function VerseRow({
  row,
  i18n,
  arabicStyle,
  showTranslation,
  bookmarked,
  lastMark,
  highlighted,
  onToggleBookmark,
  onShare,
}: {
  row: Extract<ReaderRow, { type: 'verse' }>;
  i18n: ContentI18n;
  arabicStyle: ZoomStyle;
  showTranslation: boolean;
  bookmarked: boolean;
  lastMark: boolean;
  highlighted: boolean;
  onToggleBookmark: (surah: number, ayah: number) => void;
  onShare: (row: Extract<ReaderRow, { type: 'verse' }>) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const { surah, ayah } = row.verse;
  const translation = verseTranslation(row.verse, i18n.locale);
  const number = i18n.n(ayah);
  return (
    <View
      testID={`verse-${surah}-${ayah}`}
      style={{
        marginHorizontal: screenGutter,
        paddingVertical: spacing.lg + 2,
        gap: spacing.sm + 2,
        borderBottomWidth: highlighted ? 2 : 1,
        borderBottomColor: highlighted ? c.accent : c.hairline,
      }}
    >
      {lastMark ? (
        <View
          testID={`last-mark-${surah}-${ayah}`}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: c.accentSubtle,
          }}
        >
          <Icon name="bookmark-simple" weight="fill" size={14} color={c.textOnAccentSubtle} />
          <Text variant="caption" color="textOnAccentSubtle">
            {i18n.t('quran.lastMark', { ref: `${i18n.n(surah)}:${number}` })}
          </Text>
        </View>
      ) : null}
      <View accessible style={{ gap: spacing.sm + 2 }}>
        <Text
          variant="quran"
          lang="ar"
          style={arabicStyle}
          selectable
          testID={`arabic-${surah}-${ayah}`}
        >
          {row.text}
        </Text>
        {showTranslation ? (
          translation.text ? (
            <Text
              variant="body"
              lang={translation.lang}
              selectable
              testID={`translation-${surah}-${ayah}`}
            >
              {translation.text}
            </Text>
          ) : (
            <Text color="textMuted" variant="caption">
              {i18n.t('quran.reader.translationMissing')}
            </Text>
          )
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="caption" color="textMuted" testID={`ayah-number-${surah}-${ayah}`}>
          {i18n.t('quran.ayah.number', { number })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            role="button"
            aria-label={
              bookmarked
                ? i18n.t('quran.bookmark.removeLabel', { number })
                : i18n.t('quran.bookmark.addLabel', { number })
            }
            aria-pressed={bookmarked}
            onPress={() => onToggleBookmark(surah, ayah)}
            testID={`bookmark-${surah}-${ayah}`}
            style={{
              width: minTouchTarget,
              height: minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="bookmark-simple"
              weight={bookmarked ? 'fill' : 'regular'}
              size={22}
              color={bookmarked ? c.accent : c.textMuted}
            />
          </Pressable>
          <IconButton
            icon="share-network"
            accessibilityLabel={i18n.t('quran.share.action')}
            onPress={() => onShare(row)}
            testID={`share-${surah}-${ayah}`}
          />
        </View>
      </View>
    </View>
  );
});
