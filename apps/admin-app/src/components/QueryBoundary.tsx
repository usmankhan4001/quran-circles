import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorState, Skeleton, spacing } from '@qc/ui';
import type { QueryResult } from '../api/query';
import { isOffline, errorMessageKey } from '../api/errors';
import { useT } from '../appearance/AppearanceProvider';

export interface QueryBoundaryProps<T> {
  query: QueryResult<T>;
  children: (data: T) => ReactNode;
  testID?: string;
}

/** Shows the loading skeleton, the error with a retry, or the loaded content. */
export function QueryBoundary<T>({ query, children, testID }: QueryBoundaryProps<T>) {
  const { t } = useT();
  if (query.status === 'loading') {
    return (
      <View testID={testID ? `${testID}-loading` : 'loading'} style={{ gap: spacing.md }}>
        <Skeleton announce shape="block" height={72} />
        <Skeleton shape="block" height={72} />
        <Skeleton shape="block" height={72} />
      </View>
    );
  }
  if (query.status === 'error' || query.data === undefined) {
    const offline = isOffline(query.error);
    return (
      <ErrorState
        testID={testID ? `${testID}-error` : 'error'}
        kind={offline ? 'offline' : 'generic'}
        title={offline ? undefined : t('ui.errorTitle')}
        description={offline ? undefined : t(errorMessageKey(query.error))}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }
  return <>{children(query.data)}</>;
}
