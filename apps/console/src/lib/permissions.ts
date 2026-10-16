import {
  ACTIONS,
  can,
  type Me,
  type Principal,
  type ResourceScope,
  type ScopeAction,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';

/**
 * The console hides what a person cannot do. This is a convenience only: the API checks every
 * request with the same scope matrix and is the authority. Both use `can` from @qc/contracts.
 */
export function principalFromMe(me: Me): Principal {
  return {
    userId: me.id,
    assignments: me.roles.map((r) => ({ role: r.role, cityId: r.cityId, venueId: r.venueId })),
  };
}

/** True when the person holds any role that may ever do the action, in some scope. */
export function canSomewhere(principal: Principal | null, action: ScopeAction): boolean {
  if (!principal) return false;
  const roles: readonly string[] = ACTIONS[action].roles;
  return principal.assignments.some((a) => roles.includes(a.role));
}

export type NavId =
  'sessions' | 'venues' | 'coordinators' | 'exports' | 'import' | 'audit' | 'settings';

export interface NavItem {
  id: NavId;
  path: string;
  labelKey: MessageKey;
  /** Shown when the person may do at least one of these somewhere. */
  anyOf: readonly ScopeAction[];
}

/** Every page of the console, in menu order, with the actions that unlock it. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'sessions',
    path: '/sessions',
    labelKey: 'console.nav.sessions',
    anyOf: ['session.list_admin'],
  },
  { id: 'venues', path: '/venues', labelKey: 'console.nav.venues', anyOf: ['venue.list_admin'] },
  {
    id: 'exports',
    path: '/exports',
    labelKey: 'console.nav.exports',
    anyOf: ['registration.export'],
  },
  {
    id: 'coordinators',
    path: '/coordinators',
    labelKey: 'console.nav.coordinators',
    anyOf: ['role.list'],
  },
  {
    id: 'import',
    path: '/import',
    labelKey: 'console.nav.import',
    anyOf: ['venue.create', 'role.assign_venue_coordinator'],
  },
  { id: 'audit', path: '/audit', labelKey: 'console.nav.audit', anyOf: ['audit.read'] },
  { id: 'settings', path: '/settings', labelKey: 'console.nav.settings', anyOf: ['settings.read'] },
];

export function visibleNav(principal: Principal | null): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((a) => canSomewhere(principal, a)));
}

export function isNavAllowed(principal: Principal | null, id: NavId): boolean {
  return visibleNav(principal).some((i) => i.id === id);
}

/** The roles a person may invite or assign, for the scope they pick. */
export function canAssignRole(
  principal: Principal | null,
  role: Me['roles'][number]['role'],
  scope: ResourceScope = {},
): boolean {
  const action: ScopeAction =
    role === 'national_admin'
      ? 'role.assign_national_admin'
      : role === 'city_coordinator'
        ? 'role.assign_city_coordinator'
        : 'role.assign_venue_coordinator';
  return can(principal, action, scope);
}
