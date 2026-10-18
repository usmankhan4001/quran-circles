import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Skeleton, Text, spacing, useTheme } from '@qc/ui';
import { useCommunityToday } from '../features/reading/hooks';
import { useI18n } from '../i18n/I18nProvider';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xxs },
});

/**
 * Read together today (feature 1, community): one national number, people who read today and
 * pages read together. No city, venue or circle numbers exist, so nothing is ever compared. The
 * card stays away when the number cannot be had; it is a nice extra, not something to retry.
 */
function CommunityTodayCardContent() {
  const { t } = useI18n();
  const c = useTheme().colors;
  const { query, enabled } = useCommunityToday();
  if (!enabled) return null;
  if (query.status === 'error' && !query.data) return null;
  const data = query.data;
  return (
    <Card variant="flat" testID="home-community">
      <View style={styles.row}>
        <Icon name="people" size={28} color={c.textAccent} />
        <View style={styles.grow}>
          <Text variant="eyebrow" color="textSecondary">
            {t('communityToday.title')}
          </Text>
          {data ? (
            <>
              <Text variant="title3" testID="community-readers">
                {t('communityToday.readers', { count: data.readersToday })}
              </Text>
              <Text variant="body" color="textSecondary" testID="community-pages">
                {t('communityToday.pages', { count: data.pagesTogether })}
              </Text>
            </>
          ) : (
            <Skeleton shape="text" lines={2} announce />
          )}
        </View>
      </View>
    </Card>
  );
}

/** It takes no props, so it draws again when its own data changes, not each time Home does. */
export const CommunityTodayCard = memo(CommunityTodayCardContent);
