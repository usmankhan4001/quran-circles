import type { Invite } from '@qc/contracts';
import type { StaffRoleAssignment } from '../api/types';
import { useDirectory } from '../api/directory';
import { useI18n } from '../i18n';

/** A readable name for where a role applies: "All of Pakistan", a city, or a venue. */
export function useScopeLabel() {
  const { t, localized } = useI18n();
  const dir = useDirectory();
  return (
    scope: Pick<Invite | StaffRoleAssignment, 'scopeType' | 'cityId' | 'venueId'> & {
      scopeName?: StaffRoleAssignment['scopeName'];
    },
  ): string => {
    if (scope.scopeType === 'national') return t('console.scope.national');
    const named = scope.scopeName ? localized(scope.scopeName) : '';
    if (named) return named;
    return scope.scopeType === 'city' ? dir.cityName(scope.cityId) : dir.venueName(scope.venueId);
  };
}
