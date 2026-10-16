import {
  can,
  scopeFilter,
  updatePostAction,
  type Localized,
  type Me,
  type Principal,
  type ResourceScope,
  type Role,
  type ScopeAction,
} from '@qc/contracts';

/**
 * The role-and-scope matrix lives in `@qc/contracts` and the server is the authority. The app
 * asks the same `can` so it can hide or disable what the person cannot do. A hidden button is a
 * courtesy, never the protection.
 */
export function principalOf(me: Me): Principal {
  return {
    userId: me.id,
    assignments: me.roles.map((r) => ({ role: r.role, cityId: r.cityId, venueId: r.venueId })),
  };
}

/** True when the person has any staff role at all. Anyone else may not use this app. */
export const isStaff = (me: Me): boolean => me.roles.length > 0;

/** One thing the person can act as: a role with its city or venue. */
export interface WorkingScope {
  /** The role assignment id. */
  id: string;
  role: Role;
  cityId: string | null;
  venueId: string | null;
  name: Localized | null;
}

export function workingScopesOf(me: Me): WorkingScope[] {
  return me.roles.map((r) => ({
    id: r.id,
    role: r.role,
    cityId: r.cityId,
    venueId: r.venueId,
    name: r.scopeName,
  }));
}

/** The scope to open with: the saved one if still held, else the narrowest (a venue), else the first. */
export function pickWorkingScope(scopes: readonly WorkingScope[], savedId?: string | null): WorkingScope | null {
  if (savedId) {
    const saved = scopes.find((s) => s.id === savedId);
    if (saved) return saved;
  }
  return (
    scopes.find((s) => s.role === 'venue_coordinator') ??
    scopes.find((s) => s.role === 'city_coordinator') ??
    scopes[0] ??
    null
  );
}

/** Query filters that narrow a list to the working scope. National scope adds none. */
export function listFilterOf(scope: WorkingScope | null): { cityId?: string; venueId?: string } {
  if (!scope) return {};
  if (scope.role === 'venue_coordinator' && scope.venueId) return { venueId: scope.venueId };
  if (scope.role === 'city_coordinator' && scope.cityId) return { cityId: scope.cityId };
  return {};
}

export interface SessionLike {
  venueId: string;
  cityId: string;
}

export const resourceOfSession = (s: SessionLike): ResourceScope => ({
  venueId: s.venueId,
  cityId: s.cityId,
});

/** What the person may do with one session. */
export interface SessionAbilities {
  seeRegistrants: boolean;
  markAttendance: boolean;
  changeSchedule: boolean;
  editOccurrence: boolean;
  postUpdate: boolean;
}

export function sessionAbilities(principal: Principal, s: SessionLike): SessionAbilities {
  const r = resourceOfSession(s);
  return {
    seeRegistrants: can(principal, 'registration.list', r),
    markAttendance: can(principal, 'attendance.mark', r),
    changeSchedule: can(principal, 'session.change_schedule', r),
    editOccurrence: can(principal, 'occurrence.update', r),
    postUpdate: can(principal, 'update.post_venue', r),
  };
}

/** Whether the person may do an action on a resource. Thin alias that keeps imports short. */
export const allowed = (principal: Principal, action: ScopeAction, resource?: ResourceScope): boolean =>
  can(principal, action, resource);

export { scopeFilter, updatePostAction };
