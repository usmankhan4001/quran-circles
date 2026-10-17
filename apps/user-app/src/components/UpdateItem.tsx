import { StyleSheet, View } from 'react-native';
import { Badge, Card, Tag, Text, spacing } from '@qc/ui';
import type { Update } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stack: { gap: spacing.xs },
});

/**
 * One card of the Updates feed (B): what kind it is, the title, a short body, and a dot while
 * it is unread. A card with a session behind it opens that session.
 */
export function UpdateItem({ update, onPress }: { update: Update; onPress?: () => void }) {
  const { l, t } = useI18n();
  const title = l(update.title);
  const body = l(update.body);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${update.isRead ? '' : `${t('updates.unreadMarker')}, `}${title.text}`}
      testID={`update-${update.id}`}
    >
      <View style={styles.stack}>
        <View style={styles.head}>
          <Tag label={t(`updates.kind.${update.kind}`)} kind="neutral" />
          {update.isRead ? null : <Badge dot />}
        </View>
        <Text variant="label" lang={title.lang}>
          {title.text}
        </Text>
        <Text variant="body" color="textSecondary" lang={body.lang}>
          {body.text}
        </Text>
      </View>
    </Card>
  );
}

export function UpdateBody({ update }: { update: Update }) {
  const { l } = useI18n();
  const body = l(update.body);
  return (
    <View>
      <Text variant="body" lang={body.lang}>
        {body.text}
      </Text>
    </View>
  );
}
