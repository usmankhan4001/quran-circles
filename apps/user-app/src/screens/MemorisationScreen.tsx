import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  ListItem,
  Select,
  Sheet,
  Skeleton,
  Text,
  formatNumber,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import {
  MEMORISATION_STATUSES,
  pakistanDate,
  type Locale,
  type MemorisationEntry,
  type MemorisationStatus,
} from '@qc/contracts';
import { Medallion, WhiteCard, useArtSize } from '@qc/content/screens';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { errorMessageKey } from '../core/errors';
import { formatLocalDate } from '../core/format';
import { useClearSurah, useMarkSurah, useMemorisation } from '../features/memorisation/hooks';
import {
  SURAH_NUMBERS,
  countByStatus,
  reviseThisWeek,
  surahNames,
} from '../features/memorisation/logic';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  gap: { gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  sheet: { gap: spacing.md },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 1 },
});

/** "1. Al-Fatihah", with the number in the screen's digits. */
function surahTitle(surah: number, locale: Locale): string {
  return `${formatNumber(surah, locale)}. ${surahNames(surah).simple}`;
}

function revisedLine(entry: MemorisationEntry, t: TFunction, locale: Locale): string {
  return entry.lastRevisedAt
    ? t('memorisation.lastRevised', {
        date: formatLocalDate(pakistanDate(entry.lastRevisedAt), locale),
      })
    : t('memorisation.neverRevised');
}

/** Counts by mark, on the glass of the green header (as the numbers on My Journey). */
function MemorisationSummary({ items }: { items: readonly MemorisationEntry[] }) {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const counts = countByStatus(items);
  return (
    <View style={styles.stats} testID="memorisation-summary">
      {MEMORISATION_STATUSES.map((status) => {
        const label = t(`memorisation.status.${status}`);
        return (
          // Read as text ("2, Memorised"), as on My Journey: no name on a plain `div`.
          <View
            key={status}
            accessible
            style={[
              styles.stat,
              {
                backgroundColor: c.heroGlass,
                borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.heroGlass,
              },
            ]}
            testID={`memorisation-stat-${status}`}
          >
            <Text variant="title1" color="textOnHero">
              {formatNumber(counts[status], locale)}
            </Text>
            <Text variant="caption" color="textOnHero" align="center">
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The memorisation tracker (feature 3): each surah can be learning, memorised or revising, or
 * left unmarked. "Revise this week" lists memorised surahs not marked revised within the
 * person's setting (`needsRevision`); nothing reminds them. Private to the person.
 */
export function MemorisationScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();
  const tracker = useMemorisation();
  const items = tracker.data?.items;

  let body;
  if (status !== 'signedIn') {
    body = (
      <EmptyState
        title={t('memorisation.title')}
        description={t('memorisation.signedOut')}
        action={{
          label: t('memorisation.signIn'),
          onPress: () => nav.go({ name: 'signIn', returnTo: { name: 'memorisation' } }),
        }}
        testID="memorisation-signed-out"
      />
    );
  } else if (!tracker.settled) {
    body = (
      <View testID="loading">
        <Skeleton shape="text" lines={3} announce />
      </View>
    );
  } else if (!tracker.enabled) {
    body = (
      <EmptyState
        title={t('memorisation.title')}
        description={t('memorisation.off')}
        testID="memorisation-off"
      />
    );
  } else {
    body = (
      <QueryBoundary query={tracker.query}>
        {() => (
          <MemorisationContent items={items ?? []} reviseAfterDays={tracker.reviseAfterDays} />
        )}
      </QueryBoundary>
    );
  }

  return (
    <ScreenFrame
      title={t('memorisation.title')}
      onBack={() => nav.back()}
      {...(items && tracker.enabled ? { hero: <MemorisationSummary items={items} /> } : {})}
      testID="memorisation-screen"
    >
      {body}
    </ScreenFrame>
  );
}

function MemorisationContent({
  items,
  reviseAfterDays,
}: {
  items: readonly MemorisationEntry[];
  reviseAfterDays: number;
}) {
  const { t, locale } = useI18n();
  const { now } = useServices();
  const toast = useToast();
  const mark = useMarkSurah();
  const [open, setOpen] = useState<number | null>(null);
  const due = reviseThisWeek(items, now(), reviseAfterDays);

  const markRevised = async (surah: number) => {
    const done = await mark.run(surah, { status: 'memorised', markRevised: true });
    if (done) toast.show(t('memorisation.revised.done'), 'success');
    else toast.show(t('memorisation.error'), 'warning');
  };

  return (
    <View style={styles.stack}>
      <Section title={t('memorisation.revise.title')} testID="memorisation-revise">
        <Text variant="body" color="textSecondary">
          {t('memorisation.revise.note', { count: reviseAfterDays })}
        </Text>
        {due.length === 0 ? (
          <Text variant="body" testID="memorisation-revise-empty">
            {t('memorisation.revise.empty')}
          </Text>
        ) : (
          <View style={styles.rows}>
            {due.map((entry) => (
              <SurahCard
                key={entry.surah}
                entry={entry}
                subtitle={revisedLine(entry, t, locale)}
                trailing={
                  <Button
                    variant="outline"
                    label={t('memorisation.markRevised')}
                    accessibilityLabel={t('memorisation.markRevisedFor', {
                      surah: surahNames(entry.surah).simple,
                    })}
                    disabled={mark.running}
                    onPress={() => void markRevised(entry.surah)}
                    testID={`revise-${entry.surah}`}
                  />
                }
                testID={`due-${entry.surah}`}
              />
            ))}
          </View>
        )}
      </Section>

      <Section title={t('memorisation.list.title')} testID="memorisation-list">
        <Select<string>
          label={t('memorisation.add.label')}
          placeholder={t('memorisation.add.placeholder')}
          value={undefined}
          options={SURAH_NUMBERS.map((n) => ({ value: `${n}`, label: surahTitle(n, locale) }))}
          onChange={(value) => setOpen(Number(value))}
          testID="memorisation-add"
        />
        {items.length === 0 ? (
          <Text variant="body" color="textSecondary" testID="memorisation-empty">
            {t('memorisation.list.empty')}
          </Text>
        ) : (
          <View style={styles.rows}>
            {items.map((entry) => (
              <SurahCard
                key={entry.surah}
                entry={entry}
                subtitle={`${t(`memorisation.status.${entry.status}`)}${t('schedule.separator')}${revisedLine(entry, t, locale)}`}
                onPress={() => setOpen(entry.surah)}
                testID={`surah-${entry.surah}`}
              />
            ))}
          </View>
        )}
        <Text variant="caption" color="textSecondary">
          {t('memorisation.private')}
        </Text>
      </Section>

      <SurahSheet
        surah={open}
        entry={items.find((e) => e.surah === open)}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

/**
 * A surah as the Quran list draws it (D17): a white card with the star medallion, the name and
 * a line under it, and the Arabic name at the end. Opens the sheet when it can be pressed.
 */
function SurahCard({
  entry,
  subtitle,
  trailing,
  onPress,
  testID,
}: {
  entry: MemorisationEntry;
  subtitle: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID: string;
}) {
  const size = useArtSize();
  const names = surahNames(entry.surah);
  const card = (
    <WhiteCard radius={15} padding={12}>
      <View style={styles.row}>
        <Medallion value={entry.surah} />
        <View style={styles.rowText}>
          <Text variant="label" strong numberOfLines={1}>
            {names.simple}
          </Text>
          <Text variant="caption" color="textSecondary">
            {subtitle}
          </Text>
        </View>
        {trailing ?? (
          <Text variant="quran" lang="ar" decorative style={size(17, 'quran', 'quran')}>
            {names.arabic}
          </Text>
        )}
      </View>
    </WhiteCard>
  );
  if (!onPress) return <View testID={testID}>{card}</View>;
  return (
    <Pressable
      role="button"
      aria-label={`${names.simple}, ${subtitle}`}
      onPress={onPress}
      testID={testID}
    >
      {card}
    </Pressable>
  );
}

/** Mark one surah: a status, "mark revised", or clear the mark. */
function SurahSheet({
  surah,
  entry,
  onClose,
}: {
  surah: number | null;
  entry: MemorisationEntry | undefined;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const mark = useMarkSurah();
  const clear = useClearSurah();
  const busy = mark.running || clear.running;
  const error = mark.error ?? clear.error;

  const close = () => {
    mark.clearError();
    clear.clearError();
    onClose();
  };
  const choose = async (status: MemorisationStatus) => {
    if (surah === null) return;
    if (await mark.run(surah, { status })) {
      toast.show(t('memorisation.saved'), 'success');
      close();
    }
  };

  return (
    <Sheet
      visible={surah !== null}
      onClose={close}
      title={surah !== null ? surahTitle(surah, locale) : t('memorisation.title')}
      testID="memorisation-sheet"
    >
      <View style={styles.sheet}>
        {surah !== null ? (
          <Text variant="quran" lang="ar" align="center">
            {surahNames(surah).arabic}
          </Text>
        ) : null}
        <View role="radiogroup" aria-label={t('memorisation.title')}>
          {MEMORISATION_STATUSES.map((status) => (
            <ListItem
              key={status}
              role="radio"
              checked={entry?.status === status}
              title={t(`memorisation.status.${status}`)}
              chevron={false}
              disabled={busy}
              divider
              onPress={() => void choose(status)}
              testID={`status-${status}`}
            />
          ))}
        </View>
        {entry ? (
          <>
            <Button
              variant="secondary"
              fullWidth
              label={t('memorisation.markRevised')}
              disabled={busy}
              onPress={async () => {
                if (surah === null) return;
                if (await mark.run(surah, { status: entry.status, markRevised: true })) {
                  toast.show(t('memorisation.revised.done'), 'success');
                  close();
                }
              }}
              testID="sheet-revised"
            />
            <Button
              variant="tertiary"
              fullWidth
              label={t('memorisation.clear')}
              disabled={busy}
              onPress={async () => {
                if (surah === null) return;
                if (await clear.run(surah)) {
                  toast.show(t('memorisation.saved'), 'success');
                  close();
                }
              }}
              testID="sheet-clear"
            />
          </>
        ) : null}
        {error ? (
          <Text variant="caption" color="textDanger" testID="memorisation-sheet-error">
            {t(errorMessageKey(error.code))}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
