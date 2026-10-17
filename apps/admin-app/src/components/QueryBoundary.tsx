import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorState, Skeleton, spacing } from '@qc/ui';
import type { QueryResult } from '../api/query';
import { isNotAvailable, isOffline, errorMessageKey } from '../api/errors';
import { useT } from '../appearance/AppearanceProvider';
import { NotAvailable } from './NotAvailable';

export interface QueryBoundaryProps<T> {
  query: QueryResult<T>;
  children: (data: T) => ReactNode;
  testID?: string;
  /**
   * For a single-record read: a `not_found` answer reads "not available to you" (the server says
   * the same for a record outside the person's scope), with no retry. Its id ends in `-not-available`.
   */
  notFoundIsNotAvailable?: boolean;
}

/**
 * Shows the loading skeleton, the error with a retry, or the loaded content. With a `testID`,
 * the loaded content sits in a view of that id and the other two states carry `-loading` and
 * `-error` ids.
 */
export function QueryBoundary<T>({
  query,
  children,
  testID,
  notFoundIsNotAvailable = false,
}: QueryBoundaryProps<T>) {
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
  if (notFoundIsNotAvailable && query.status === 'error' && isNotAvailable(query.error)) {
    return <NotAvailable testID={testID ? `${testID}-not-available` : undefined} />;
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
  return <View testID={testID}>{children(query.data)}</View>;
}
