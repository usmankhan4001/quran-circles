import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Pressable, ScrollView, Share, View } from 'react-native';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  IconButton,
  ListItem,
  Sheet,
  Skeleton,
  Text,
  TextField,
  minTouchTarget,
  screenGutter,
  spacing,
  useTheme,
} from '@qc/ui';
import { formatVerseKey } from '../meta/ayah';
import { juzOf } from '../meta/juz';
import { searchSurahs } from '../meta/search';
import { ayahCountOf, getSurah, JUZ_COUNT, SURAH_COUNT } from '../meta/surahs';
import { ARABIC_ZOOM_STEPS, arabicZoom } from '../quran/prefs';
import type { QuranPassage } from '../quran/types';
import { QuranSourceError } from '../quran/types';
import { surahName } from './format';
import {
  useBookmarks,
  usePassage,
  useReaderPrefs,
  useReadingPosition,
  useSavedSurahs,
} from './hooks';
import { useContentI18n, type ContentI18n } from './i18n';
import { usePositionTracker } from './positionTracker';
import { QuranTextCredit } from './QuranText';
import { useArtSize } from './art';
import { BarIcon, Medallion, WhiteCard } from './parts';
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
 * The reader: Arabic with a translation under each ayah (Urdu on an Urdu screen, English on an
 * English screen, both Maududi's), a text size, a jump to an ayah,
 * and quick moves between surahs. The last place reached is saved as the reading position.
 *
 * Page turn: the previous/next surah buttons follow the Quran's right-to-left order in both
 * app languages (docs/design/screens/quran-and-prayer.md, open question 2).
 */
export function QuranReaderScreen({
  target,
  onBack,
  onTargetChange,
  onShare = defaultShare,
  testID,
}: QuranReaderScreenProps) {
  const i18n = useContentI18n();
  const theme = useTheme();
  const bookmarks = useBookmarks();
  const { prefs, setShowTranslation, setZoomIndex } = useReaderPrefs();
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
  const jumpTo = useCallback(
    (surah: number, ayah: number) => {
      setSheet(null);
      tracker.saveNow({ surah, ayah });
      setRequested({ kind: 'surah', id: surah, ayah });
    },
    [tracker],
  );
  // The jump chips: the surah's start, the person's last place in it, and its end.
  const milestones = (surah: number) => {
    const ref = (ayah: number) => `${i18n.n(surah)}:${i18n.n(ayah)}`;
    const last = ayahCountOf(surah);
    const list = [
      { key: 'start', ayah: 1, label: i18n.t('quran.reader.milestone.start', { ref: ref(1) }) },
    ];
    if (position && position.surah === surah && position.ayah > 1 && position.ayah < last) {
      list.push({
        key: 'mark',
        ayah: position.ayah,
        label: i18n.t('quran.reader.milestone.mark', { ref: ref(position.ayah) }),
      });
    }
    list.push({
      key: 'end',
      ayah: last,
      label: i18n.t('quran.reader.milestone.end', { ref: ref(last) }),
    });
    return list;
  };

  const title = headerTitle(i18n, shown, requested);
  const subtitle =
    shown?.kind === 'surah' ? i18n.tn('quran.surah.ayahs', ayahCountOf(shown.id)) : undefined;

  // The artboard sets the Arabic at 21 px; the reader's own size steps scale it from there.
  const zoom = arabicZoom(prefs.arabicZoomIndex);
  const size = useArtSize();
  const base = size(21, 'quran', 'quran');
  const arabicStyle = useMemo(
    () => ({
      fontSize: Math.round((base.fontSize ?? 21) * zoom),
      lineHeight: Math.round((base.lineHeight ?? 40) * zoom),
    }),
    [base.fontSize, base.lineHeight, zoom],
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
          highlighted={highlight === item.key}
          onToggleBookmark={toggleBookmark}
          onShare={share}
        />
      ),
    [arabicStyle, i18n, prefs.showTranslation, bookmarks, highlight, toggleBookmark, share],
  );

  // As drawn: back on the start; search, the day/night look and the settings on the end.
  const topBar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      }}
    >
      <BarIcon
        icon="chevron-back"
        accessibilityLabel={theme.t('ui.back')}
        onPress={() => {
          tracker.flush();
          onBack();
        }}
        testID="reader-back"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <BarIcon
          icon="search"
          accessibilityLabel={i18n.t('quran.reader.surahs')}
          onPress={() => setSheet('surahs')}
          testID="reader-surahs"
        />
        {/* Drawn, not built yet: the reader has no look of its own apart from the app's. */}
        <BarIcon
          icon="sun"
          accessibilityLabel={i18n.t('quran.reader.theme')}
          disabled
          testID="reader-theme"
        />
        <BarIcon
          icon="sliders"
          accessibilityLabel={i18n.t('quran.reader.settings')}
          onPress={() => setSheet('settings')}
          testID="reader-settings"
        />
      </View>
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

  const surahShown =
    (shown?.kind ?? requested.kind) === 'surah' ? (shown?.id ?? requested.id) : null;
  const juzTag =
    surahShown !== null
      ? i18n.t('quran.juz.title', { number: i18n.n(juzOf({ surah: surahShown, ayah: 1 })) })
      : null;

  const subheader = (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 10,
      }}
    >
      <Text
        variant="title2"
        heading={1}
        style={[size(15.5, 'title2'), { fontWeight: '800' }]}
        testID="reader-title"
      >
        {title}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {juzTag ? <SmallTag label={juzTag} tone="green" /> : null}
        {subtitle ? <SmallTag label={subtitle} /> : null}
      </View>
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

  let body: ReactElement;
  if (!shown && state.status === 'error') {
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
        extraData={`${prefs.showTranslation}-${prefs.arabicZoomIndex}-${bookmarks.items.length}-${highlight ?? ''}`}
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
        ListHeaderComponent={subheader}
        contentContainerStyle={{ paddingBottom: 170 }}
        testID="reader-list"
      />
    );
  }

  const results = useMemo(() => searchSurahs(surahQuery), [surahQuery]);

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID={testID}>
      {topBar}
      {strip}
      {notice}
      {shown ? null : subheader}
      {body}
      <ReciterPill i18n={i18n} />

      <Sheet
        visible={sheet === 'settings'}
        onClose={() => {
          setSheet(null);
          setJumpError(null);
        }}
        title={i18n.t('quran.reader.settings')}
        testID="settings-sheet"
      >
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              <Text strong style={size(12, 'label')}>
                {i18n.t('quran.textSize')}
              </Text>
              <Text color="textSuccess" strong style={size(11.5, 'caption')} testID="zoom-value">
                {i18n.t('quran.reader.sizeValue', {
                  step: i18n.n(prefs.arabicZoomIndex + 1),
                  total: i18n.n(ARABIC_ZOOM_STEPS.length),
                })}
              </Text>
            </View>
            <ZoomStepper index={prefs.arabicZoomIndex} onChange={setZoomIndex} i18n={i18n} />
          </View>
          <View style={{ gap: 8 }}>
            <Text strong style={size(12, 'label')}>
              {i18n.t('quran.reader.translation')}
            </Text>
            <View
              role="radiogroup"
              aria-label={i18n.t('quran.reader.translation')}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <ChoicePill
                label={i18n.t('quran.reader.withTranslation')}
                chosen={prefs.showTranslation}
                onPress={() => setShowTranslation(true)}
                testID="translation-on"
              />
              <ChoicePill
                label={i18n.t('quran.reader.arabicOnly')}
                chosen={!prefs.showTranslation}
                onPress={() => setShowTranslation(false)}
                testID="translation-off"
              />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text strong style={size(12, 'label')}>
              {i18n.t('quran.reader.jump')}
            </Text>
            {shown?.kind === 'surah' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {milestones(shown.id).map((m, i) => (
                  <MilestoneChip
                    key={m.key}
                    label={m.label}
                    dark={i === 0}
                    onPress={() => jumpTo(shown.id, m.ayah)}
                    testID={`milestone-${m.key}`}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={i18n.t('quran.reader.jump.label')}
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
          </View>
          {shown?.kind === 'surah' ? (
            <OfflineRow surah={shown.id} saved={savedSurahs.has(shown.id)} i18n={i18n} />
          ) : null}
          <Button
            size="large"
            fullWidth
            label={i18n.t('quran.reader.done')}
            onPress={() => setSheet(null)}
            testID="settings-done"
          />
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'surahs'}
        onClose={() => setSheet(null)}
        title={i18n.t('quran.reader.surahs')}
        testID="surahs-sheet"
      >
        <View style={{ gap: spacing.sm }}>
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

function headerTitle(
  i18n: ContentI18n,
  shown: QuranPassage | null,
  requested: ReaderTarget,
): string {
  const kind = shown?.kind ?? requested.kind;
  const id = shown?.id ?? requested.id;
  if (kind === 'juz') return i18n.t('quran.juz.title', { number: i18n.n(id) });
  const info = getSurah(id);
  return i18n.t('quran.surah.title', { name: info ? surahName(i18n, info) : i18n.n(id) });
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
        <Text variant="caption" color="textSecondary" testID="reader-stale-note">
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
  // The Quran turns right to left: "previous" on the right, "next" on the left, in both languages.
  return (
    <View
      style={{
        flexDirection: rtl ? 'row' : 'row-reverse',
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
  const size = useArtSize();
  const max = kind === 'surah' ? SURAH_COUNT : JUZ_COUNT;
  const from = Math.max(1, Math.min(id - 3, max - 4));
  const ids = Array.from({ length: Math.min(5, max) }, (_, i) => from + i);
  const label = (n: number) => {
    if (kind === 'juz') return i18n.t('quran.juz.title', { number: i18n.n(n) });
    const info = getSurah(n);
    return info ? surahName(i18n, info) : i18n.n(n);
  };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.hairline }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="tablist"
        aria-label={i18n.t(kind === 'surah' ? 'quran.reader.surahStrip' : 'quran.reader.juzStrip')}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }}
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
                minHeight: minTouchTarget - 8,
                justifyContent: 'center',
                borderBottomWidth: 2,
                borderBottomColor: chosen ? c.progress : 'transparent',
              }}
            >
              <Text strong color={chosen ? 'textSuccess' : 'textMuted'} style={size(13, 'label')}>
                {label(n)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A small grey tag in the surah subheader, such as the ayah count. */
function SmallTag({ label, tone = 'grey' }: { label: string; tone?: 'grey' | 'green' }) {
  const c = useTheme().colors;
  const size = useArtSize();
  return (
    <View
      style={{
        backgroundColor: tone === 'green' ? c.accentSubtle : c.surfaceMuted,
        borderRadius: 6,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Text
        variant="caption"
        color={tone === 'green' ? 'textOnAccentSubtle' : 'textSecondary'}
        strong
        style={size(10.5, 'caption')}
      >
        {label}
      </Text>
    </View>
  );
}

/** A− and A+ with a dot for each size step, the steps so far in green (as drawn). */
function ZoomStepper({
  index,
  onChange,
  i18n,
}: {
  index: number;
  onChange: (index: number) => void;
  i18n: ContentI18n;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const size = useArtSize();
  const last = ARABIC_ZOOM_STEPS.length - 1;
  const step = (label: string, a11y: string, next: number, off: boolean, testID: string) => (
    <Pressable
      role="button"
      aria-label={a11y}
      aria-disabled={off}
      disabled={off}
      onPress={() => onChange(next)}
      hitSlop={7}
      testID={testID}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.surfaceMuted : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.45 : 1,
      })}
    >
      <Text strong lang="en" style={size(13, 'label')}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: c.background,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      {step('A−', i18n.t('quran.reader.smaller'), index - 1, index <= 0, 'zoom-smaller')}
      <View
        aria-hidden
        style={{
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 8,
        }}
      >
        {ARABIC_ZOOM_STEPS.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 12 : 8,
              height: i === index ? 12 : 8,
              borderRadius: 6,
              backgroundColor: i <= index ? c.progress : c.border,
            }}
          />
        ))}
      </View>
      {step('A+', i18n.t('quran.reader.larger'), index + 1, index >= last, 'zoom-larger')}
    </View>
  );
}

/** A jump chip of the settings sheet; the first is charcoal, as drawn. */
function MilestoneChip({
  label,
  dark,
  onPress,
  testID,
}: {
  label: string;
  dark: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = useTheme().colors;
  const size = useArtSize();
  return (
    <Pressable
      role="button"
      onPress={onPress}
      hitSlop={6}
      testID={testID}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: dark ? c.cta : c.background,
        borderWidth: 1,
        borderColor: dark ? c.cta : c.border,
      }}
    >
      <Text strong color={dark ? 'textOnCta' : 'textSecondary'} style={size(11.5, 'label')}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Whether the open surah is kept on this phone for reading offline. */
function OfflineRow({ surah, saved, i18n }: { surah: number; saved: boolean; i18n: ContentI18n }) {
  const c = useTheme().colors;
  const size = useArtSize();
  const info = getSurah(surah);
  return (
    <View
      testID="reader-offline"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: c.background,
        borderWidth: 1,
        borderColor: c.hairline,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        <Icon name="check-circle" size={18} color={saved ? c.progress : c.textMuted} />
        <View style={{ flexShrink: 1 }}>
          <Text strong style={size(12.5, 'label')}>
            {saved ? i18n.t('quran.offline.saved') : i18n.t('quran.reader.offlineNot')}
          </Text>
          {saved ? (
            <Text variant="caption" color="textSecondary" style={size(11, 'caption')}>
              {i18n.t('quran.reader.offlineDetail', {
                surah: info ? surahName(i18n, info) : i18n.n(surah),
              })}
            </Text>
          ) : null}
        </View>
      </View>
      {saved ? (
        <Text color="textSuccess" strong style={size(11, 'caption')}>
          {i18n.t('quran.reader.offlineState')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The floating reciter pill, as drawn. Recitation is not built yet, so it is shown switched off
 * and says so.
 */
function ReciterPill({ i18n }: { i18n: ContentI18n }) {
  const theme = useTheme();
  const c = theme.colors;
  const size = useArtSize();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 28, end: 28, bottom: 96 }}>
      <View
        role="button"
        aria-disabled
        aria-label={i18n.t('quran.reader.play')}
        testID="reader-reciter"
        style={{
          height: 50,
          borderRadius: 999,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.hairline,
          boxShadow: theme.mode === 'light' ? '0px 12px 32px rgba(17, 24, 39, 0.14)' : undefined,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <Icon name="chevron-up" size={13} color={c.textSecondary} />
          <Text strong color="textSecondary" style={size(12.5, 'label')} numberOfLines={1}>
            {i18n.t('quran.reader.reciter')}
          </Text>
        </View>
        <Icon name="play" size={22} color={c.textMuted} />
      </View>
    </View>
  );
}

/** One of the translation choices: a pill, the chosen one an emerald tint with a green edge. */
function ChoicePill({
  label,
  chosen,
  onPress,
  testID,
}: {
  label: string;
  chosen: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = useTheme().colors;
  const size = useArtSize();
  return (
    <Pressable
      role="radio"
      aria-checked={chosen}
      onPress={onPress}
      testID={testID}
      style={{
        flex: 1,
        minHeight: minTouchTarget - 8,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: chosen ? c.accentSubtle : c.background,
        borderWidth: chosen ? 1.5 : 1,
        borderColor: chosen ? c.progress : c.border,
      }}
    >
      <Text
        strong
        align="center"
        color={chosen ? 'textOnAccentSubtle' : 'textSecondary'}
        style={size(12, 'label')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const HeadingRow = memo(function HeadingRow({
  row,
  arabicStyle,
  i18n,
}: {
  row: Extract<ReaderRow, { type: 'heading' }>;
  arabicStyle: ZoomStyle;
  i18n: ContentI18n;
}) {
  const info = row.surah !== null ? getSurah(row.surah) : undefined;
  const size = useArtSize();
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 6 }}>
      <WhiteCard padding={16} style={{ gap: spacing.sm }}>
        {info ? (
          <Text variant="title3" heading={2} align="center" style={size(15, 'title3')}>
            {i18n.t('quran.surah.title', { name: surahName(i18n, info) })}
          </Text>
        ) : null}
        {row.bismillah ? (
          <Text variant="quran" lang="ar" align="center" style={arabicStyle} testID="bismillah">
            {row.bismillah}
          </Text>
        ) : null}
      </WhiteCard>
    </View>
  );
});

const VerseRow = memo(function VerseRow({
  row,
  i18n,
  arabicStyle,
  showTranslation,
  bookmarked,
  highlighted,
  onToggleBookmark,
  onShare,
}: {
  row: Extract<ReaderRow, { type: 'verse' }>;
  i18n: ContentI18n;
  arabicStyle: ZoomStyle;
  showTranslation: boolean;
  bookmarked: boolean;
  highlighted: boolean;
  onToggleBookmark: (surah: number, ayah: number) => void;
  onShare: (row: Extract<ReaderRow, { type: 'verse' }>) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const size = useArtSize();
  const { surah, ayah } = row.verse;
  const translation = verseTranslation(row.verse, i18n.locale);
  const number = i18n.n(ayah);
  return (
    <View testID={`verse-${surah}-${ayah}`} style={{ paddingHorizontal: 20, paddingVertical: 6 }}>
      <WhiteCard
        testID={`verse-card-${surah}-${ayah}`}
        padding={0}
        outlined={highlighted}
        style={{ paddingVertical: 16, paddingHorizontal: 18 }}
      >
        <View accessible style={{ gap: 6 }}>
          {/* As drawn: the ayah's number in the eight-point star at the Arabic's start (its
              right), in both app languages. */}
          <View
            style={{
              flexDirection: theme.direction === 'rtl' ? 'row' : 'row-reverse',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <Medallion
              value={ayah}
              accessibilityLabel={i18n.t('quran.ayah.number', { number })}
              testID={`ayah-number-${surah}-${ayah}`}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="quran"
                lang="ar"
                style={arabicStyle}
                selectable
                testID={`arabic-${surah}-${ayah}`}
              >
                {row.text}
              </Text>
            </View>
          </View>
          {showTranslation ? (
            translation.text ? (
              <Text
                lang={translation.lang}
                color="textSecondary"
                selectable
                style={size(12.5, 'body')}
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
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
          }}
        >
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
              minHeight: minTouchTarget,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 6,
            }}
          >
            <Icon name="check-circle" size={16} color={bookmarked ? c.progress : c.textMuted} />
            <Text strong style={size(11.5, 'label')}>
              {bookmarked ? i18n.t('quran.bookmark.marked') : i18n.t('quran.bookmark.mark')}
            </Text>
          </Pressable>
          <IconButton
            icon="share"
            accessibilityLabel={i18n.t('quran.share.action')}
            onPress={() => onShare(row)}
            testID={`share-${surah}-${ayah}`}
          />
        </View>
      </WhiteCard>
    </View>
  );
});
