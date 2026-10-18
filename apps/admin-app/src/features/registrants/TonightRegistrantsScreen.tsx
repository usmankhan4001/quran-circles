import { EmptyState } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { isToday } from '../../lib/time';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { TODAY_LIMIT } from '../home/earlyToday';
import { nextOf } from '../home/TodayScreen';
import { RegistrantsScreen } from './RegistrantsScreen';

/**
 * The Registrants tab (D17 dock): the registrants of the next session in the working scope, on
 * its date when that is today. With no coming session it says so.
 */
export function TonightRegistrantsScreen({ now = new Date() }: { now?: Date }) {
  const { t } = useT();
  const api = useApi();
  const { filter, active } = useWorkingScope();
  const query = useQuery(async () => {
    const page = await api.adminSessions.list({ query: { ...filter, limit: TODAY_LIMIT } });
    return nextOf(page.items);
  }, [filter.cityId, filter.venueId, active?.id]);

  if (query.status === 'success' && query.data) {
    const s = query.data;
    const occ = s.nextOccurrence;
    return (
      <RegistrantsScreen
        key={s.id}
        sessionId={s.id}
        occurrenceId={occ && isToday(occ.startsAt, now) ? occ.id : undefined}
        now={now}
        asTab
      />
    );
  }
  return (
    <Screen title={t('admin.registrants.title')} variant="plain" testID="tonight">
      <QueryBoundary query={query} testID="tonight-data">
        {() => (
          <EmptyState title={t('admin.home.emptyTitle')} description={t('admin.home.noDates')} />
        )}
      </QueryBoundary>
    </Screen>
  );
}
