import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import {
  Button,
  EmptyState,
  ListItem,
  SegmentedControl,
  Skeleton,
  StarNumber,
  Text,
  TextField,
  screenGutter,
  spacing,
} from '@qc/ui';
import type { BookmarkEntry } from '../bookmarks/service';
import { JUZ_STARTS } from '../meta/juz';
import { searchSurahs } from '../meta/search';
import { getSurah, JUZ_COUNT, type SurahInfo } from '../meta/surahs';
import { ContinueReadingCard } from './ContinueReadingCard';
import { useContent } from './context';
import { surahName } from './format';
import { useBookmarks, useSavedSurahs } from './hooks';
import { useContentI18n, type ContentI18n } from './i18n';
import { targetForBookmark, type ReaderTarget } from './reader';
import { SavedMark } from './QuranText';
import { V1ImportBanner } from './V1ImportBanner';

type Tab = 'surahs' | 'juz' | 'bookmarks';

export interface QuranIndexScreenProps {
  /** Opens the reader. */
  onOpen: (target: ReaderTarget) => void;
  /** The tab shown first. */
  initialTab?: Tab;
  testID?: string;
}

type Item =
  | { type: 'surah'; key: string; surah: SurahInfo }
  | { type: 'juz'; key: string; juz: number }
  | { type: 'bookmark'; key: string; bookmark: BookmarkEntry };

/**
 * The Quran half of the Quran and Prayer tab: the continue card, search by surah name, and the
 * Surahs, Juz and Bookmarks lists.
 */
export function QuranIndexScreen({ onOpen, initialTab = 'surahs', testID }: QuranIndexScreenProps) {
  const i18n = useContentI18n();
  const { signedIn } = useContent();
  const bookmarks = useBookmarks();
  const saved = useSavedSurahs();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchSurahs(query), [query]);

  const items: Item[] = useMemo(() => {
    if (tab === 'surahs') {
      return results.map((r) => ({ type: 'surah', key: `s${r.surah.id}`, surah: r.surah }));
    }
    if (tab === 'juz') {
      return Array.from({ length: JUZ_COUNT }, (_, i) => ({
        type: 'juz' as const,
        key: `j${i + 1}`,
        juz: i + 1,
      }));
    }
    return bookmarks.items.map((bookmark) => ({
      type: 'bookmark' as const,
      key: `b${bookmark.id}`,
      bookmark,
    }));
  }, [tab, results, bookmarks.items]);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <V1ImportBanner />
      <ContinueReadingCard
        variant="tab"
        onOpen={({ surah, ayah }) => onOpen({ kind: 'surah', id: surah, ayah })}
      />
      <SegmentedControl<Tab>
        accessibilityLabel={i18n.t('quran.tab.label')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'surahs', label: i18n.t('quran.tab.surah') },
          { value: 'juz', label: i18n.t('quran.tab.juz') },
          { value: 'bookmarks', label: i18n.t('quran.tab.bookmarks') },
        ]}
        testID="quran-tabs"
      />
      {tab === 'surahs' ? (
        <TextField
          label={i18n.t('quran.search')}
          placeholder={i18n.t('quran.search.placeholder')}
          value={query}
          onChangeText={setQuery}
          testID="surah-search"
        />
      ) : null}
      {tab === 'bookmarks' && !signedIn ? (
        <Text color="textSecondary" variant="caption" testID="bookmarks-local-note">
          {i18n.t('quran.bookmarks.localOnly')}
        </Text>
      ) : null}
    </View>
  );

  let empty: ReactElement | null = null;
  if (tab === 'surahs' && items.length === 0) {
    empty = (
      <EmptyState
        title={i18n.t('quran.search.empty.title')}
        description={i18n.t('quran.search.empty.body')}
        testID="surah-search-empty"
      />
    );
  } else if (tab === 'bookmarks') {
    if (bookmarks.loading) {
      empty = (
        <View testID="bookmarks-loading">
          <Skeleton shape="text" lines={3} announce />
        </View>
      );
    } else if (items.length === 0) {
      empty = (
        <Text color="textSecondary" testID="bookmarks-empty">
          {i18n.t('quran.bookmarks.empty')}
        </Text>
      );
    }
  }

  return (
    <FlatList<Item>
      testID={testID}
      data={bookmarks.loading && tab === 'bookmarks' ? [] : items}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={header}
      ListEmptyComponent={empty ?? undefined}
      contentContainerStyle={{ paddingHorizontal: screenGutter, paddingBottom: spacing.xxl }}
      initialNumToRender={14}
      extraData={saved}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        if (item.type === 'surah')
          return (
            <SurahRow
              surah={item.surah}
              saved={saved.has(item.surah.id)}
              onOpen={onOpen}
              i18n={i18n}
            />
          );
        if (item.type === 'juz') return <JuzRow juz={item.juz} onOpen={onOpen} i18n={i18n} />;
        return (
          <BookmarkRow
            bookmark={item.bookmark}
            onOpen={onOpen}
            onRemove={() => void bookmarks.remove(item.bookmark.id)}
            i18n={i18n}
          />
        );
      }}
    />
  );
}

/**
 * A surah as drawn (Q1): its number in the eight-point star, the name and verse count, the
 * Arabic name in the Quran font at the row end, and a mark when it is saved on this phone.
 */
function SurahRow({
  surah,
  saved,
  onOpen,
  i18n,
}: {
  surah: SurahInfo;
  saved: boolean;
  onOpen: (target: ReaderTarget) => void;
  i18n: ContentI18n;
}) {
  const count = i18n.tn('quran.surah.ayahs', surah.ayahCount);
  const subtitle = `${surah.nameEnglish} · ${count}`;
  const label = [`${i18n.n(surah.id)}. ${surah.nameSimple}. ${subtitle}`];
  if (saved) label.push(i18n.t('quran.offline.saved'));
  return (
    <ListItem
      testID={`surah-row-${surah.id}`}
      title={surah.nameSimple}
      subtitle={subtitle}
      accessibilityLabel={label.join('. ')}
      leading={<StarNumber value={surah.id} testID={`surah-number-${surah.id}`} />}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text
            variant="quran"
            lang="ar"
            color="textAccent"
            decorative
            testID={`surah-arabic-${surah.id}`}
          >
            {surah.nameArabic}
          </Text>
          {saved ? <SavedMark testID={`surah-saved-${surah.id}`} /> : null}
        </View>
      }
      chevron={false}
      divider
      onPress={() => onOpen({ kind: 'surah', id: surah.id })}
    />
  );
}

function JuzRow({
  juz,
  onOpen,
  i18n,
}: {
  juz: number;
  onOpen: (target: ReaderTarget) => void;
  i18n: ContentI18n;
}) {
  const start = JUZ_STARTS[juz - 1];
  const info = start ? getSurah(start.surah) : undefined;
  const title = i18n.t('quran.juz.title', { number: i18n.n(juz) });
  const subtitle =
    start && info
      ? i18n.t('quran.juz.starts', { surah: surahName(i18n, info), ayah: i18n.n(start.ayah) })
      : undefined;
  return (
    <ListItem
      testID={`juz-row-${juz}`}
      title={title}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      leading={<StarNumber value={juz} testID={`juz-number-${juz}`} />}
      {...(subtitle ? { subtitle } : {})}
      divider
      onPress={() => onOpen({ kind: 'juz', id: juz })}
    />
  );
}

function bookmarkTitle(i18n: ContentI18n, b: BookmarkEntry): string {
  if (b.kind === 'ayah' && b.surah !== null && b.ayah !== null) {
    const info = getSurah(b.surah);
    return i18n.t('quran.ayahRef', {
      surah: info ? surahName(i18n, info) : i18n.n(b.surah),
      ayah: i18n.n(b.ayah),
    });
  }
  if (b.kind === 'surah' && b.surah !== null) {
    const info = getSurah(b.surah);
    return i18n.t('quran.surah.title', { name: info ? surahName(i18n, info) : i18n.n(b.surah) });
  }
  return i18n.t('quran.juz.title', { number: i18n.n(b.para ?? 0) });
}

function BookmarkRow({
  bookmark,
  onOpen,
  onRemove,
  i18n,
}: {
  bookmark: BookmarkEntry;
  onOpen: (target: ReaderTarget) => void;
  onRemove: () => void;
  i18n: ContentI18n;
}) {
  const title = bookmarkTitle(i18n, bookmark);
  const target = targetForBookmark(bookmark);
  return (
    <View testID={`bookmark-row-${bookmark.id}`}>
      <ListItem
        title={title}
        {...(bookmark.note ? { subtitle: bookmark.note } : {})}
        {...(target ? { onPress: () => onOpen(target) } : {})}
      />
      <View style={{ alignItems: 'flex-start', paddingBottom: spacing.sm }}>
        <Button
          variant="tertiary"
          label={i18n.t('quran.bookmark.remove')}
          accessibilityLabel={i18n.t('quran.bookmark.removeItem', { place: title })}
          onPress={onRemove}
          testID={`bookmark-remove-${bookmark.id}`}
        />
      </View>
    </View>
  );
}
