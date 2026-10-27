import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ErrorState, IconButton, Skeleton, Text, screenGutter, spacing, useTheme } from '@qc/ui';
import { getSurah } from '../meta/surahs';
import { splitBismillah } from '../quran/bismillah';
import { MUSHAF_PAGE_COUNT, type MushafAyah } from '../quran/pages';
import { QuranSourceError } from '../quran/types';
import { arabicIndic, surahName } from './format';
import { useMushafPage } from './hooks';
import { useContentI18n } from './i18n';
import { QuranTextCredit } from './QuranText';

export interface MushafViewProps {
  /** The page to show, or null while the page of the starting ayah is being looked up. */
  page: number | null;
  onPageChange: (page: number) => void;
  /** Set when the page of the starting ayah could not be looked up; shown with a retry. */
  lookupError?: Error | null;
  onRetryLookup?: () => void;
  /** An ayah to colour, such as the one asked for or the last mark. */
  highlight?: { surah: number; ayah: number } | null;
  /** The size multiplier of the Arabic (the reader's own text size). */
  zoom: number;
  testID?: string;
}

interface Block {
  key: string;
  /** The surah that starts here, shown as a banner with its opening formula. */
  starts: { surah: number; bismillah: string | null } | null;
  ayahs: { ayah: MushafAyah; text: string }[];
}

/** Groups a page's ayahs into runs; a new run (and a banner) begins at every surah's first ayah. */
function blocksOf(ayahs: readonly MushafAyah[]): Block[] {
  const blocks: Block[] = [];
  for (const ayah of ayahs) {
    const split = splitBismillah(ayah);
    if (ayah.ayah === 1) {
      blocks.push({
        key: `s${ayah.surah}`,
        starts: { surah: ayah.surah, bismillah: split.bismillah },
        ayahs: [],
      });
    }
    let block = blocks[blocks.length - 1];
    if (!block) {
      block = { key: `p${ayah.surah}:${ayah.ayah}`, starts: null, ayahs: [] };
      blocks.push(block);
    }
    block.ayahs.push({ ayah, text: split.text });
  }
  return blocks;
}

/**
 * The Arabic-only Mushaf page: one printed page at a time inside a hairline frame, a banner where
 * a surah begins, the ayahs running on with their end marks, the page number below, and a pager.
 * Colour never says anything alone: the highlighted ayah is also named in the label under the text.
 */
export function MushafView({
  page,
  onPageChange,
  lookupError,
  onRetryLookup,
  highlight,
  zoom,
  testID,
}: MushafViewProps) {
  const i18n = useContentI18n();
  const theme = useTheme();
  const c = theme.colors;
  const state = useMushafPage(page);
  const shown = state.status === 'ready' ? state.page : state.previous;
  const blocks = useMemo(() => (shown ? blocksOf(shown.ayahs) : []), [shown]);
  const arabic = {
    // Larger than the board's 27px: the face is small on a phone, and line height is the room the
    // stacked marks need.
    fontSize: Math.round(31 * theme.scale * zoom),
    lineHeight: Math.round(31 * theme.scale * zoom * 2.2),
  };

  const first = shown?.ayahs[0];
  const firstInfo = first ? getSurah(first.surah) : undefined;
  const turn = (to: number) => onPageChange(Math.min(MUSHAF_PAGE_COUNT, Math.max(1, to)));
  const current = shown?.page ?? page ?? 1;

  // The page itself failed to load, or the page of the starting ayah could not be found.
  const failure =
    state.status === 'error' && !shown ? state.error : page === null ? lookupError : null;
  let body;
  if (failure) {
    const offline = failure instanceof QuranSourceError && failure.code === 'offline';
    body = (
      <View style={{ padding: screenGutter }}>
        <ErrorState
          kind={offline ? 'offline' : 'generic'}
          {...(offline ? { description: i18n.t('quran.reader.offlineUncached') } : {})}
          onRetry={
            state.status === 'error' && !shown ? state.reload : (onRetryLookup ?? state.reload)
          }
          testID="mushaf-error"
        />
      </View>
    );
  } else if (!shown) {
    body = (
      <View
        style={{ padding: screenGutter }}
        testID="mushaf-loading"
        aria-label={i18n.t('quran.reader.loading')}
      >
        <Skeleton shape="text" lines={8} announce />
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} testID="mushaf-scroll">
        <View
          aria-label={firstInfo ? surahName(i18n, firstInfo) : undefined}
          style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.xs,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.md + 2,
            borderWidth: 1,
            borderColor: c.hairline,
            borderRadius: 16,
            gap: spacing.md,
          }}
          testID="mushaf-page"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="textMuted">
              {shown.juz ? i18n.t('quran.juz.title', { number: i18n.n(shown.juz) }) : ''}
            </Text>
            <Text variant="caption" color="textMuted">
              {firstInfo ? surahName(i18n, firstInfo) : ''}
            </Text>
          </View>
          {blocks.map((block) => (
            <View key={block.key} style={{ gap: spacing.md }}>
              {block.starts ? (
                <SurahBanner
                  surah={block.starts.surah}
                  bismillah={block.starts.bismillah}
                  arabic={arabic}
                />
              ) : null}
              <Text
                variant="quran"
                lang="ar"
                align="start"
                style={arabic}
                testID={`mushaf-text-${block.key}`}
              >
                {block.ayahs.map(({ ayah, text }) => {
                  const marked =
                    highlight && highlight.surah === ayah.surah && highlight.ayah === ayah.ayah;
                  return (
                    <Text
                      key={`${ayah.surah}:${ayah.ayah}`}
                      testID={`mushaf-ayah-${ayah.surah}-${ayah.ayah}`}
                      style={marked ? { backgroundColor: c.accentSubtle } : undefined}
                    >
                      {text}{' '}
                      <Text style={{ color: c.textAccent, fontSize: arabic.fontSize * 0.62 }}>
                        {'\u200F﴿'}
                        {arabicIndic(ayah.ayah)}
                        {'﴾\u200F'}
                      </Text>{' '}
                    </Text>
                  );
                })}
              </Text>
            </View>
          ))}
          <Text variant="caption" color="textMuted" align="center" lang="en" direction="ltr">
            {arabicIndic(shown.page)}
          </Text>
        </View>
        <View style={{ paddingHorizontal: screenGutter, paddingTop: spacing.md }}>
          <QuranTextCredit testID="reader-text-credit" />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {body}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <IconButton
          icon="caret-left"
          accessibilityLabel={i18n.t('quran.mushaf.previous')}
          disabled={current <= 1}
          onPress={() => turn(current - 1)}
          testID="mushaf-previous"
        />
        <Text variant="caption" color="textMuted" testID="mushaf-page-count">
          {i18n.t('quran.mushaf.pageOf', {
            page: i18n.n(current),
            total: i18n.n(MUSHAF_PAGE_COUNT),
          })}
        </Text>
        <IconButton
          icon="caret-right"
          accessibilityLabel={i18n.t('quran.mushaf.next')}
          disabled={current >= MUSHAF_PAGE_COUNT}
          onPress={() => turn(current + 1)}
          testID="mushaf-next"
        />
      </View>
    </View>
  );
}

/** Where a surah begins: its name in a band, then its opening formula. */
function SurahBanner({
  surah,
  bismillah,
  arabic,
}: {
  surah: number;
  bismillah: string | null;
  arabic: { fontSize: number; lineHeight: number };
}) {
  const c = useTheme().colors;
  const info = getSurah(surah);
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surfaceMuted,
        }}
        testID={`mushaf-banner-${surah}`}
      >
        <Text variant="quran" lang="ar" align="center" style={arabic}>
          {info ? info.nameArabic : ''}
        </Text>
      </View>
      {bismillah ? (
        <Text variant="quran" lang="ar" align="center" style={arabic}>
          {bismillah}
        </Text>
      ) : null}
    </View>
  );
}
