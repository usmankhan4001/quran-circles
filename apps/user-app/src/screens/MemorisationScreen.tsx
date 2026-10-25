import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  Icon,
  ListItem,
  SectionHeader,
  Select,
  Sheet,
  Skeleton,
  Tag,
  Text,
  formatNumber,
  minTouchTarget,
  spacing,
  useTheme,
  type TagKind,
} from '@qc/ui';
import {
  MEMORISATION_STATUSES,
  pakistanDate,
  type Locale,
  type MemorisationEntry,
  type MemorisationStatus,
} from '@qc/contracts';
import { useArtSize } from '@qc/content/screens';
import { Page } from '../components/Page';
import { QueryBoundary } from '../components/QueryBoundary';
import { errorMessageKey } from '../core/errors';
import { formatLocalDate } from '../core/format';
import { useClearSurah, useMarkSurah, useMemorisation } from '../features/memorisation/hooks';
import { SURAH_NUMBERS, reviseThisWeek, surahNames } from '../features/memorisation/logic';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  block: { gap: spacing.xs },
  sheet: { gap: spacing.md },
  private: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  arabic: { width: 56, alignItems: 'center' },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing.xxs },
  done: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

const STATUS_TAG: Record<MemorisationStatus, TagKind> = {
  memorised: 'ok',
  revising: 'gilt',
  learning: 'neutral',
};

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
        icon="brain"
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
        icon="brain"
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
    <Page barTitle={t('memorisation.title')} onBack={() => nav.back()} testID="memorisation-screen">
      {body}
    </Page>
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
  const c = useTheme().colors;
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
      <View style={styles.private}>
        <Icon name="shield-check" size={16} color={c.textMuted} />
        <Text variant="caption" color="textMuted">
          {t('memorisation.private')}
        </Text>
      </View>

      <View style={styles.block} testID="memorisation-revise">
        <SectionHeader
          title={t('memorisation.revise.title')}
          trailing={
            due.length > 0 ? (
              <Text variant="caption" color="textSecondary">
                {formatNumber(due.length, locale)}
              </Text>
            ) : undefined
          }
        />
        <Text variant="caption" color="textSecondary">
          {t('memorisation.revise.note', { count: reviseAfterDays })}
        </Text>
        {due.length === 0 ? (
          <Text variant="body" testID="memorisation-revise-empty">
            {t('memorisation.revise.empty')}
          </Text>
        ) : (
          <View>
            {due.map((entry, i) => (
              <SurahRow
                key={entry.surah}
                entry={entry}
                subtitle={revisedLine(entry, t, locale)}
                last={i === due.length - 1}
                lead="arabic"
                trailing={
                  <Pressable
                    role="button"
                    aria-label={t('memorisation.markRevisedFor', {
                      surah: surahNames(entry.surah).simple,
                    })}
                    aria-disabled={mark.running}
                    disabled={mark.running}
                    onPress={() => void markRevised(entry.surah)}
                    testID={`revise-${entry.surah}`}
                    style={({ pressed }) => [
                      styles.done,
                      {
                        borderColor: c.borderStrong,
                        backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                      },
                    ]}
                  >
                    <Icon name="check" size={20} color={c.textAccent} />
                  </Pressable>
                }
                testID={`due-${entry.surah}`}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.block} testID="memorisation-list">
        <SectionHeader title={t('memorisation.list.title')} />
        {items.length === 0 ? (
          <Text variant="body" color="textSecondary" testID="memorisation-empty">
            {t('memorisation.list.empty')}
          </Text>
        ) : (
          <View>
            {items.map((entry, i) => (
              <SurahRow
                key={entry.surah}
                entry={entry}
                subtitle={revisedLine(entry, t, locale)}
                last={i === items.length - 1}
                lead="number"
                trailing={
                  <Tag
                    kind={STATUS_TAG[entry.status]}
                    label={t(`memorisation.status.${entry.status}`)}
                  />
                }
                accessibilityLabel={`${surahNames(entry.surah).simple}, ${t(`memorisation.status.${entry.status}`)}, ${revisedLine(entry, t, locale)}`}
                onPress={() => setOpen(entry.surah)}
                testID={`surah-${entry.surah}`}
              />
            ))}
          </View>
        )}
      </View>

      <Select<string>
        label={t('memorisation.add.label')}
        placeholder={t('memorisation.add.placeholder')}
        value={undefined}
        options={SURAH_NUMBERS.map((n) => ({ value: `${n}`, label: surahTitle(n, locale) }))}
        onChange={(value) => setOpen(Number(value))}
        testID="memorisation-add"
      />

      <SurahSheet
        surah={open}
        entry={items.find((e) => e.surah === open)}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

/**
 * A surah as a flat row: its number in a ring, or its Arabic name, then the English name and a
 * line under it, and what sits at the end (a tick to mark it revised, or its status). A row
 * that can be pressed opens the sheet.
 */
function SurahRow({
  entry,
  subtitle,
  last,
  lead,
  trailing,
  accessibilityLabel,
  onPress,
  testID,
}: {
  entry: MemorisationEntry;
  subtitle: string;
  last: boolean;
  lead: 'arabic' | 'number';
  trailing: ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
  testID: string;
}) {
  const { locale } = useI18n();
  const c = useTheme().colors;
  const size = useArtSize();
  const names = surahNames(entry.surah);
  const body = (
    <>
      {lead === 'arabic' ? (
        <View style={styles.arabic}>
          <Text variant="quran" lang="ar" decorative style={size(22, 'quran', 'quran')}>
            {names.arabic}
          </Text>
        </View>
      ) : (
        <View style={[styles.number, { borderColor: c.borderStrong }]}>
          <Text variant="caption" color="textSecondary" decorative>
            {formatNumber(entry.surah, locale)}
          </Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text variant="label" numberOfLines={1}>
          {names.simple}
        </Text>
        <Text variant="caption" color="textSecondary">
          {subtitle}
        </Text>
      </View>
    </>
  );
  const border = { borderBottomColor: last ? 'transparent' : c.hairline };
  if (!onPress) {
    return (
      <View style={[styles.row, border]} testID={testID}>
        {body}
        {trailing}
      </View>
    );
  }
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? `${names.simple}, ${subtitle}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        border,
        { backgroundColor: pressed ? c.surfaceMuted : 'transparent' },
      ]}
    >
      {body}
      {trailing}
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
