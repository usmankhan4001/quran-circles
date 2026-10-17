import {
  ACTIONS,
  can,
  featureOn,
  type FeatureFlagKey,
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
  | 'sessions'
  | 'venues'
  | 'coordinators'
  | 'exports'
  | 'import'
  | 'audit'
  | 'dailyAyahs'
  | 'settings';

export interface NavItem {
  id: NavId;
  path: string;
  labelKey: MessageKey;
  /** Shown when the person may do at least one of these somewhere. */
  anyOf: readonly ScopeAction[];
  /** A feature flag that must be on as well (rc.4 features ship behind a flag). */
  flag?: FeatureFlagKey;
}

/** Flags as `GET /v1/config` answers them. Missing means off. */
export type NavFlags = Partial<Record<FeatureFlagKey, boolean>>;

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
  {
    id: 'dailyAyahs',
    path: '/ayah-of-the-day',
    labelKey: 'console.nav.dailyAyahs',
    anyOf: ['daily_ayah.manage'],
    flag: 'ayah_of_the_day',
  },
  { id: 'settings', path: '/settings', labelKey: 'console.nav.settings', anyOf: ['settings.read'] },
];

/** True when the person's roles unlock the page, whatever its feature flag says. */
export function roleAllowsNav(principal: Principal | null, item: NavItem): boolean {
  return item.anyOf.some((a) => canSomewhere(principal, a));
}

/**
 * The menu: pages the roles unlock and whose feature flag (if any) is on. Without flags, every
 * flagged page is left out, because a missing flag is off.
 */
export function visibleNav(principal: Principal | null, flags: NavFlags = {}): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      roleAllowsNav(principal, item) && (item.flag === undefined || featureOn(flags, item.flag)),
  );
}

export function isNavAllowed(
  principal: Principal | null,
  id: NavId,
  flags: NavFlags = {},
): boolean {
  return visibleNav(principal, flags).some((i) => i.id === id);
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
