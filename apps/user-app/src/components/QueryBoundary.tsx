import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorState, Skeleton, Text, spacing } from '@qc/ui';
import { errorMessageKey } from '../core/errors';
import { useI18n } from '../i18n/I18nProvider';
import type { QueryResult } from '../data/useQuery';

export interface QueryBoundaryProps<T> {
  query: Pick<QueryResult<T>, 'status' | 'data' | 'error' | 'offline' | 'refetch' | 'fetching'>;
  /** Draws the data. Not called while loading or on an error with nothing saved. */
  children: (data: T) => ReactNode;
  /** What shows while the first load runs. Default: three lines. */
  loading?: ReactNode;
}

/**
 * The three states every server-backed screen shares: loading, an error with Try again, and
 * the data. When the server cannot be reached but a saved copy exists, the copy shows with a
 * note; the offline banner at the top of the screen says the same in one line.
 */
export function QueryBoundary<T>({ query, children, loading }: QueryBoundaryProps<T>) {
  const { t } = useI18n();
  if (query.status === 'loading' || query.status === 'idle') {
    return <View testID="loading">{loading ?? <Skeleton shape="text" lines={3} announce />}</View>;
  }
  if (query.status === 'error' || query.data === undefined) {
    const code = query.error?.code ?? 'unknown';
    return (
      <ErrorState
        kind={code === 'network_error' ? 'offline' : 'generic'}
        description={t(errorMessageKey(code))}
        onRetry={() => void query.refetch()}
        retrying={query.fetching}
      />
    );
  }
  return (
    <>
      {query.offline ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Text variant="caption" color="textSecondary" testID="saved-copy-note">
            {t('offline.savedCopy')}
          </Text>
        </View>
      ) : null}
      {children(query.data)}
    </>
  );
}
