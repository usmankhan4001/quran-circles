import { NavLink } from 'react-router';
import { can, type ResourceScope } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useI18n } from '../i18n';
import { canSomewhere } from '../lib/permissions';

/**
 * The pages of one session: who registered, and its posters. Each link shows only when the
 * person's roles reach the session (or, while the session is still loading, somewhere at all);
 * the API checks again.
 */
export function SessionTabs({
  sessionId,
  place,
}: {
  sessionId: string;
  /** The session's city and venue, when known. */
  place: ResourceScope | null;
}) {
  const { t } = useI18n();
  const { principal } = useSignedIn();
  const allowed = (action: 'registration.list' | 'poster.read') =>
    place ? can(principal, action, place) : canSomewhere(principal, action);
  const tabs = [
    {
      id: 'registrations',
      to: `/sessions/${sessionId}/registrations`,
      label: t('console.posters.tabs.registrations'),
      show: allowed('registration.list'),
    },
    {
      id: 'posters',
      to: `/sessions/${sessionId}/posters`,
      label: t('console.posters.tabs.posters'),
      show: allowed('poster.read'),
    },
  ].filter((tab) => tab.show);
  if (tabs.length < 2) return null;
  return (
    <nav className="session-tabs" aria-label={t('console.posters.tabs.label')}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <NavLink className="session-tab" to={tab.to} end>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
