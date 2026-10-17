import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, spacing, useTheme } from '@qc/ui';
import { useMemorisation } from '../features/memorisation/hooks';
import { reviseThisWeek } from '../features/memorisation/logic';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xxs },
});

/** My Journey's way into the memorisation tracker, with how many surahs to revise this week. */
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
    <Card
      onPress={() => nav.go({ name: 'memorisation' })}
      accessibilityLabel={
        summary ? `${t('memorisation.title')}, ${summary}` : t('memorisation.title')
      }
      testID="journey-memorisation"
    >
      <View style={styles.row}>
        <Icon name="book" size={28} color={c.textAccent} />
        <View style={styles.grow}>
          <Text variant="title3">{t('memorisation.title')}</Text>
          {summary ? (
            <Text variant="body" color="textSecondary" testID="journey-memorisation-summary">
              {summary}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-forward" size={20} color={c.textSecondary} />
      </View>
    </Card>
  );
}
