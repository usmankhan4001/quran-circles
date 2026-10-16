import { Badge, ListItem, Text } from '@qc/ui';
import type { Update } from '@qc/contracts';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';

/** One line of the Updates feed: title, a short body, and a dot while it is unread. */
export function UpdateItem({ update, onPress }: { update: Update; onPress?: () => void }) {
  const { l, t } = useI18n();
  const title = l(update.title);
  const body = l(update.body);
  return (
    <ListItem
      title={title.text}
      subtitle={`${t(`updates.kind.${update.kind}`)} · ${body.text}`}
      chevron={Boolean(onPress)}
      onPress={onPress}
      divider
      accessibilityLabel={`${update.isRead ? '' : `${t('updates.unreadMarker')}, `}${title.text}`}
      trailing={update.isRead ? undefined : <Badge dot />}
      testID={`update-${update.id}`}
    />
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
