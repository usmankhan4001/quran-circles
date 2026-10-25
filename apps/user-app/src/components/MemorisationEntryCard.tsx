import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, spacing, useTheme } from '@qc/ui';
import { useMemorisation } from '../features/memorisation/hooks';
import { reviseThisWeek } from '../features/memorisation/logic';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';
import { IconTile } from './IconTile';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  grow: { flex: 1, gap: spacing.xxs },
});

/**
 * My Journey's way into the memorisation tracker, with how many surahs to revise this week: one
 * flat row between two hairlines, as drawn.
 */
export function MemorisationEntryCard() {
  const { t } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { now } = useServices();
  const tracker = useMemorisation();
  if (!tracker.enabled) return null;
  const items = tracker.data?.items;
  const due = items ? reviseThisWeek(items, now(), tracker.reviseAfterDays).length : 0;
  const summary = !items
    ? null
    : items.length === 0
      ? t('memorisation.summary.start')
      : due > 0
        ? t('memorisation.summary.due', { count: due })
        : t('memorisation.revise.empty');
  return (
    <Pressable
      role="button"
      aria-label={summary ? `${t('memorisation.title')}, ${summary}` : t('memorisation.title')}
      onPress={() => nav.go({ name: 'memorisation' })}
      testID="journey-memorisation"
      style={({ pressed }) => [
        styles.row,
        { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceMuted : 'transparent' },
      ]}
    >
      <IconTile icon="brain" tone="fill" />
      <View style={styles.grow}>
        <Text variant="label" decorative>
          {t('memorisation.title')}
        </Text>
        {summary ? (
          <Text variant="caption" color="textSecondary" testID="journey-memorisation-summary">
            {summary}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}
