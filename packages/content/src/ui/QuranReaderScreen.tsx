import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Share, View } from 'react-native';
import {
  Button,
  Card,
  ErrorState,
  Header,
  ListItem,
  Sheet,
  Skeleton,
  StarNumber,
  Switch,
  Text,
  TextField,
  screenGutter,
  spacing,
  useTheme,
} from '@qc/ui';
import { formatVerseKey } from '../meta/ayah';
import { searchSurahs } from '../meta/search';
import { ayahCountOf, getSurah, SURAH_COUNT } from '../meta/surahs';
import { ARABIC_ZOOM_STEPS, arabicZoom } from '../quran/prefs';
import type { QuranPassage } from '../quran/types';
import { QuranSourceError } from '../quran/types';
import { surahName } from './format';
import { useBookmarks, usePassage, useReaderPrefs } from './hooks';
import { useContentI18n, type ContentI18n } from './i18n';
import { usePositionTracker } from './positionTracker';
import { QuranTextCredit } from './QuranText';
import {
  buildRows,
  resolveJump,
  rowIndexFor,
  verseTranslation,
  type ReaderRow,
  type ReaderTarget,
} from './reader';

type SheetName = 'settings' | 'jump' | 'surahs' | null;

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
      if (list && rows.length > 0) {
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

  const title = headerTitle(i18n, shown, requested);
  const subtitle =
    shown?.kind === 'surah' ? i18n.tn('quran.surah.ayahs', ayahCountOf(shown.id)) : undefined;

  const zoom = arabicZoom(prefs.arabicZoomIndex);
  const baseQuran = theme.type('quran', 'quran');
  const arabicStyle = useMemo(
    () => ({
      fontSize: Math.round(baseQuran.fontSize * zoom),
      lineHeight: Math.round(baseQuran.lineHeight * zoom),
    }),
    [baseQuran.fontSize, baseQuran.lineHeight, zoom],
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

  const toolbar = (
    <View style={styles.toolbar}>
      <Button
        variant="secondary"
        label={i18n.t('quran.reader.jump')}
        onPress={() => setSheet('jump')}
        testID="reader-jump"
      />
      <Button
        variant="secondary"
        label={i18n.t('quran.reader.surahs')}
        onPress={() => setSheet('surahs')}
        testID="reader-surahs"
      />
      <Button
        variant="secondary"
        label={i18n.t('quran.reader.settings')}
        onPress={() => setSheet('settings')}
        testID="reader-settings"
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
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        testID="reader-list"
      />
    );
  }

  const results = useMemo(() => searchSurahs(surahQuery), [surahQuery]);

  return (
    <View style={styles.fill} testID={testID}>
      <Header
        title={title}
        {...(subtitle ? { subtitle } : {})}
        onBack={() => {
          tracker.flush();
          onBack();
        }}
      />
      <View style={styles.gutter}>{toolbar}</View>
      {notice}
      {body}

      <Sheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        title={i18n.t('quran.reader.settings')}
        testID="settings-sheet"
      >
        <View style={{ gap: spacing.lg }}>
          <Switch
            label={i18n.t('quran.translation.show')}
            value={prefs.showTranslation}
            onValueChange={setShowTranslation}
            testID="translation-switch"
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="label">{i18n.t('quran.textSize')}</Text>
            <Text color="textSecondary" testID="zoom-value">
              {i18n.t('quran.reader.sizeValue', {
                step: i18n.n(prefs.arabicZoomIndex + 1),
                total: i18n.n(ARABIC_ZOOM_STEPS.length),
              })}
            </Text>
            <Button
              variant="secondary"
              label={i18n.t('quran.reader.larger')}
              disabled={prefs.arabicZoomIndex >= ARABIC_ZOOM_STEPS.length - 1}
              onPress={() => setZoomIndex(prefs.arabicZoomIndex + 1)}
              testID="zoom-larger"
            />
            <Button
              variant="secondary"
              label={i18n.t('quran.reader.smaller')}
              disabled={prefs.arabicZoomIndex <= 0}
              onPress={() => setZoomIndex(prefs.arabicZoomIndex - 1)}
              testID="zoom-smaller"
            />
          </View>
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'jump'}
        onClose={() => {
          setSheet(null);
          setJumpError(null);
        }}
        title={i18n.t('quran.reader.jump')}
        testID="jump-sheet"
      >
        <View style={{ gap: spacing.md }}>
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
          <Button label={i18n.t('quran.reader.jump.go')} onPress={submitJump} testID="jump-go" />
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
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
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
        variant="secondary"
        label={i18n.t('quran.reader.previousSurah')}
        disabled={surah <= 1}
        onPress={() => onGo(surah - 1)}
        testID="reader-previous-surah"
      />
      <Button
        variant="secondary"
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
  return (
    <View style={{ paddingHorizontal: screenGutter, paddingVertical: spacing.md, gap: spacing.sm }}>
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
  const { surah, ayah } = row.verse;
  const translation = verseTranslation(row.verse, i18n.locale);
  const number = i18n.n(ayah);
  return (
    <View
      testID={`verse-${surah}-${ayah}`}
      style={{
        paddingHorizontal: screenGutter,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        borderStartWidth: highlighted ? 4 : 0,
        borderStartColor: theme.colors.accent,
        gap: spacing.sm,
      }}
    >
      <View accessible style={{ gap: spacing.sm }}>
        {/* As drawn (Q1): the ayah's number in the eight-point star beside its Arabic. The pair
            reads right to left in both app languages, so the star sits at the Arabic's start. */}
        <View
          style={{
            flexDirection: theme.direction === 'rtl' ? 'row' : 'row-reverse',
            alignItems: 'flex-start',
            gap: spacing.sm,
          }}
        >
          <StarNumber
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
            <Text lang={translation.lang} selectable testID={`translation-${surah}-${ayah}`}>
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
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}
      >
        <Button
          variant="tertiary"
          icon={bookmarked ? 'close' : 'plus'}
          label={bookmarked ? i18n.t('quran.bookmark.remove') : i18n.t('quran.bookmark.add')}
          accessibilityLabel={
            bookmarked
              ? i18n.t('quran.bookmark.removeLabel', { number })
              : i18n.t('quran.bookmark.addLabel', { number })
          }
          onPress={() => onToggleBookmark(surah, ayah)}
          testID={`bookmark-${surah}-${ayah}`}
        />
        <Button
          variant="tertiary"
          label={i18n.t('quran.share.action')}
          onPress={() => onShare(row)}
          testID={`share-${surah}-${ayah}`}
        />
      </View>
    </View>
  );
});
