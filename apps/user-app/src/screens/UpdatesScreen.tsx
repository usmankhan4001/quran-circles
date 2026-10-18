import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, spacing } from '@qc/ui';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { UpdateItem } from '../components/UpdateItem';
import { useMarkRead, useUnreadCount, useUpdatesFeed } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';

const styles = StyleSheet.create({ stack: { gap: spacing.md } });

/** The full Updates feed. Opening an update marks it read; "Mark all as read" clears the badge. */
export function UpdatesScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();
  const feed = useUpdatesFeed(20);
  const unread = useUnreadCount();
  const markRead = useMarkRead();

  return (
    <ScreenFrame title={t('updates.title')} onBack={() => nav.back()} testID="updates-screen">
      {status !== 'signedIn' ? (
        <EmptyState
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
              <EmptyState title={t('updates.empty.title')} description={t('updates.empty.body')} />
            ) : (
              <View style={styles.stack}>
                {unread > 0 ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    label={t('updates.markAll')}
                    onPress={() => void markRead({ all: true })}
                    testID="mark-all-read"
                  />
                ) : null}
                <View style={styles.stack}>
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
                </View>
                {feed.hasMore ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    label={t('nearby.loadMore')}
                    loading={feed.loadingMore}
                    onPress={() => void feed.loadMore()}
                  />
                ) : null}
              </View>
            )
          }
        </QueryBoundary>
      )}
    </ScreenFrame>
  );
}
