import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, IconButton, spacing } from '@qc/ui';
import { Page } from '../components/Page';
import { QueryBoundary } from '../components/QueryBoundary';
import { UpdateItem } from '../components/UpdateItem';
import { useMarkRead, useUnreadCount, useUpdatesFeed } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';

const styles = StyleSheet.create({ more: { paddingTop: spacing.lg } });

/** The full Updates feed. Opening an update marks it read; "Mark all as read" clears the badge. */
export function UpdatesScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();
  const feed = useUpdatesFeed(20);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const signedIn = status === 'signedIn';

  return (
    <Page
      barTitle={t('updates.title')}
      onBack={() => nav.back()}
      trailing={
        signedIn && unread > 0 ? (
          <IconButton
            icon="check"
            accessibilityLabel={t('updates.markAll')}
            onPress={() => void markRead({ all: true })}
            testID="mark-all-read"
          />
        ) : undefined
      }
      testID="updates-screen"
    >
      {!signedIn ? (
        <EmptyState
          icon="bell"
          title={t('updates.signedOut.title')}
          description={t('updates.signedOut.body')}
          action={{
            label: t('updates.signedOut.action'),
            onPress: () => nav.go({ name: 'signIn', returnTo: { name: 'updates' } }),
          }}
        />
      ) : (
        <QueryBoundary query={feed}>
          {() =>
            feed.items.length === 0 ? (
              <EmptyState
                icon="bell"
                title={t('updates.empty.title')}
                description={t('updates.empty.body')}
              />
            ) : (
              <View>
                {feed.items.map((update) => (
                  <UpdateItem
                    key={update.id}
                    update={update}
                    onPress={() => {
                      if (!update.isRead) void markRead({ updateIds: [update.id] });
                      if (update.sessionId)
                        nav.go({ name: 'session', sessionId: update.sessionId });
                    }}
                  />
                ))}
                {feed.hasMore ? (
                  <View style={styles.more}>
                    <Button
                      variant="secondary"
                      fullWidth
                      label={t('nearby.loadMore')}
                      loading={feed.loadingMore}
                      onPress={() => void feed.loadMore()}
                    />
                  </View>
                ) : null}
              </View>
            )
          }
        </QueryBoundary>
      )}
    </Page>
  );
}
