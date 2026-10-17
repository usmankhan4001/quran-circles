import { View } from 'react-native';
import { Button, Card, EmptyState, Text, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { ScopeSwitcher } from '../../components/ScopeSwitcher';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate, formatInstantTime } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { canPostAnywhere } from './scopes';

/** The Updates tab: write a new one, and see what was posted in the working scope. */
export function UpdatesScreen() {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { filter, principal, active } = useWorkingScope();
  const query = useQuery(
    async () => (await api.adminUpdates.list({ query: { ...filter, limit: 20 } })).items,
    [filter.cityId, filter.venueId, active?.id],
  );
  return (
    <Screen title={t('admin.updates.title')} testID="updates">
      <ScopeSwitcher />
      {canPostAnywhere(principal) ? (
        <Button
          testID="updates-new"
          label={t('admin.postUpdate.title')}
          size="large"
          fullWidth
          onPress={() => nav.push(routes.postUpdate())}
        />
      ) : null}
      <QueryBoundary query={query} testID="updates-list">
        {(items) =>
          items.length === 0 ? (
            <EmptyState
              title={t('admin.updates.emptyTitle')}
              description={t('admin.updates.emptyBody')}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {items.map((u) => (
                <Card key={u.id} testID={`update-${u.id}`}>
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="label">{pickLocalized(u.title, locale)}</Text>
                    <Text variant="caption" color="textSecondary">
                      {formatInstantDate(u.publishedAt, locale)} ·{' '}
                      {formatInstantTime(u.publishedAt, locale)}
                      {u.authorName ? ` · ${u.authorName}` : ''}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {t.plural('admin.updates.recipients', u.recipients)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )
        }
      </QueryBoundary>
    </Screen>
  );
}
