import type { Role } from './enums';

/**
 * The role-and-scope matrix. It is the one source for the API, the apps and the tests.
 * The generated table is `packages/contracts/SCOPES.md` (run `pnpm --filter @qc/contracts gen`).
 *
 * How to read it:
 * - An actor is `public` (no sign-in), `attendee` (any signed-in person) or one of the three roles.
 * - A role assignment carries a scope: national_admin is national, city_coordinator has a city,
 *   venue_coordinator has a venue.
 * - Every staff action has a `level`: the kind of resource scope it is checked against.
 *   `national`: only national scope qualifies. `city`: national, or a city coordinator of that city.
 *   `venue`: national, a city coordinator of the venue's city, or the venue's own coordinator.
 *   `any`: the person holds any qualifying role; the data returned is filtered by `scopeFilter`.
 * - Staff are also attendees: they can register, follow and so on for themselves.
 * - A revoked assignment never counts.
 */

export type Actor = 'public' | 'attendee' | Role;

export type ActionLevel = 'public' | 'self' | 'any' | 'national' | 'city' | 'venue';

interface ActionDef {
  description: string;
  level: ActionLevel;
  /** Staff roles that may do this. Empty for public and self actions. */
  roles: readonly Role[];
}

const ALL_STAFF = ['national_admin', 'city_coordinator', 'venue_coordinator'] as const;
const CITY_UP = ['national_admin', 'city_coordinator'] as const;
const NATIONAL = ['national_admin'] as const;

const pub = (description: string): ActionDef => ({ description, level: 'public', roles: [] });
const self = (description: string): ActionDef => ({ description, level: 'self', roles: [] });
const staff = (description: string, level: ActionLevel, roles: readonly Role[]): ActionDef => ({
  description,
  level,
  roles,
});

export const ACTIONS = {
  // Public: no sign-in
  'auth.request_code': pub('Ask for a sign-in code'),
  'auth.verify_code': pub('Verify a sign-in code'),
  'auth.refresh': pub('Exchange a refresh token for new tokens'),
  'config.read': pub('Read app configuration, season mode and feature flags'),
  'places.read': pub('Browse provinces, cities and areas'),
  'venues.read': pub('Browse and read published venues'),
  'sessions.read': pub('Browse and read published sessions and occurrences'),
  'content.read': pub('Read published About, FAQ and help pages'),
  'community.read': pub('Read the national number of people who read today'),
  'daily_ayah.read': pub('Read the ayah of the day'),

  // Attendee: any signed-in person, on their own data
  'auth.sign_out': self('Sign out'),
  'me.read': self('Read own account and profile'),
  'me.update': self('Edit own profile'),
  'me.delete': self('Delete own account and personal data'),
  'registration.create': self('Register for a session'),
  'registration.read_own': self('List own registrations'),
  'registration.cancel_own': self('Cancel own registration'),
  'consent.manage': self('Read and change own consents'),
  'follow.manage': self('Follow venues and circles, and set alerts'),
  'device.manage': self('Register and remove own push devices'),
  'bookmark.manage': self('Manage own bookmarks and reading position'),
  'circle_request.manage': self('Request a circle near me, and cancel the request'),
  'updates.read_feed': self('Read the Updates feed and mark items read'),
  'reading.manage': self('Record and read own days read'),
  'memorisation.manage': self('Read and change own memorisation tracker'),

  // Registrations and attendance
  'registration.list': staff(
    'See registrants of a session, with their numbers',
    'venue',
    ALL_STAFF,
  ),
  'registration.export': staff('Export the registrants of a session', 'venue', ALL_STAFF),
  'attendance.read': staff('Read attendance of an occurrence', 'venue', ALL_STAFF),
  'attendance.mark': staff('Mark attendance of an occurrence', 'venue', ALL_STAFF),

  // Venues, circles and sessions
  'venue.list_admin': staff('List venues in scope, including drafts', 'any', ALL_STAFF),
  'venue.create': staff('Create a venue in a city', 'city', CITY_UP),
  'venue.update': staff('Edit a venue, its contact number and facilities', 'venue', ALL_STAFF),
  'venue.archive': staff('Archive a venue', 'city', CITY_UP),
  'circle.list_admin': staff('List circles in scope, including pending ones', 'any', ALL_STAFF),
  'circle.create': staff(
    'Create a circle (venue coordinators create it pending)',
    'venue',
    ALL_STAFF,
  ),
  'circle.update': staff('Edit a circle', 'venue', ALL_STAFF),
  'circle.approve': staff('Approve or reject a pending circle', 'city', CITY_UP),
  'session.list_admin': staff('List sessions in scope, including drafts', 'any', ALL_STAFF),
  'session.create': staff('Create a session at a venue', 'venue', ALL_STAFF),
  'session.update': staff('Edit session details', 'venue', ALL_STAFF),
  'session.change_schedule': staff('Change a session time or day', 'venue', ALL_STAFF),
  'occurrence.update': staff(
    'Set portion, recap, cancel or move one occurrence',
    'venue',
    ALL_STAFF,
  ),

  // Updates and messaging
  'update.post_national': staff('Post an update to everyone', 'national', NATIONAL),
  'update.post_city': staff('Post an update to a city', 'city', CITY_UP),
  'update.post_venue': staff('Post an update to a venue', 'venue', ALL_STAFF),
  'update.list_admin': staff('List updates posted in scope', 'any', ALL_STAFF),
  'template.read': staff('Read approved message templates', 'any', ALL_STAFF),
  // A national pick is checked with no place, so only national admins pass; a venue or circle
  // pick is checked at its venue (`dailyAyahResource`).
  'daily_ayah.manage': staff(
    'Set the ayah of the day: national picks, or picks for venues and circles',
    'venue',
    ALL_STAFF,
  ),

  // Posters (rc.5): checked at the session's venue. "Admins and coordinators in scope can make
  // posters" (product decision).
  'poster.create': staff(
    'Make or regenerate a poster for a session at a venue',
    'venue',
    ALL_STAFF,
  ),
  'poster.read': staff("List a session's posters and download their files", 'venue', ALL_STAFF),

  // People and roles
  'role.list': staff('List role assignments and invites in scope', 'any', CITY_UP),
  'role.assign_national_admin': staff('Invite or assign a national admin', 'national', NATIONAL),
  'role.assign_city_coordinator': staff('Invite or assign a city coordinator', 'city', NATIONAL),
  'role.assign_venue_coordinator': staff(
    'Invite, assign or hand over a venue coordinator',
    'venue',
    CITY_UP,
  ),

  // Oversight
  'audit.read': staff('Read the audit log in scope', 'any', CITY_UP),
  'settings.read': staff('Read platform settings', 'national', NATIONAL),
  'settings.update': staff(
    'Change platform settings such as the Hijri offset',
    'national',
    NATIONAL,
  ),
} as const satisfies Record<string, ActionDef>;

export type ScopeAction = keyof typeof ACTIONS;
export const SCOPE_ACTIONS = Object.keys(ACTIONS) as ScopeAction[];

export interface ScopedRole {
  role: Role;
  /** Set for city_coordinator. */
  cityId?: string | null;
  /** Set for venue_coordinator. */
  venueId?: string | null;
}

/** Who is acting. Revoked assignments must be left out by the caller. */
export interface Principal {
  userId?: string | null;
  assignments: readonly ScopedRole[];
}

/** What is being acted on. A venue-level resource must carry both its venue and its city. */
export interface ResourceScope {
  cityId?: string | null;
  venueId?: string | null;
  /** For self actions: the person who owns the data. */
  ownerUserId?: string | null;
}

const assignmentCovers = (a: ScopedRole, level: ActionLevel, r: ResourceScope): boolean => {
  if (a.role === 'national_admin') return true;
  if (level === 'national') return false;
  if (a.role === 'city_coordinator') {
    return !!a.cityId && (level === 'city' || level === 'venue') && a.cityId === r.cityId;
  }
  // venue_coordinator
  return level === 'venue' && !!a.venueId && a.venueId === r.venueId;
};

/**
 * The single authorisation decision. Handlers call this through the scope engine and never check
 * roles by hand. An action unknown to the matrix is denied.
 */
export function can(
  principal: Principal | null,
  action: ScopeAction,
  resource: ResourceScope = {},
): boolean {
  const def: ActionDef | undefined = ACTIONS[action];
  if (!def) return false;
  switch (def.level) {
    case 'public':
      return true;
    case 'self':
      if (!principal?.userId) return false;
      return resource.ownerUserId == null || resource.ownerUserId === principal.userId;
    case 'any':
      return !!principal && principal.assignments.some((a) => def.roles.includes(a.role));
    default:
      return (
        !!principal &&
        principal.assignments.some(
          (a) => def.roles.includes(a.role) && assignmentCovers(a, def.level, resource),
        )
      );
  }
}

/** For list endpoints: the rows a person may see for an `any` action. */
export interface ScopeFilter {
  national: boolean;
  cityIds: string[];
  venueIds: string[];
}

export function scopeFilter(principal: Principal | null, action: ScopeAction): ScopeFilter {
  const filter: ScopeFilter = { national: false, cityIds: [], venueIds: [] };
  const def: ActionDef | undefined = ACTIONS[action];
  if (!principal || !def) return filter;
  for (const a of principal.assignments) {
    if (!def.roles.includes(a.role)) continue;
    if (a.role === 'national_admin') filter.national = true;
    else if (a.role === 'city_coordinator' && a.cityId) filter.cityIds.push(a.cityId);
    else if (a.role === 'venue_coordinator' && a.venueId) filter.venueIds.push(a.venueId);
  }
  return filter;
}

/** Which action guards assigning a role (also used for invites and handover). */
export const roleAssignAction = (role: Role): ScopeAction =>
  role === 'national_admin'
    ? 'role.assign_national_admin'
    : role === 'city_coordinator'
      ? 'role.assign_city_coordinator'
      : 'role.assign_venue_coordinator';

/** Which action guards posting an update to a scope. */
export const updatePostAction = (scopeType: 'national' | 'city' | 'venue'): ScopeAction =>
  scopeType === 'national'
    ? 'update.post_national'
    : scopeType === 'city'
      ? 'update.post_city'
      : 'update.post_venue';

/**
 * The resource to check `daily_ayah.manage` against for a pick's scope. A national pick has no
 * place, so only a national admin is allowed; a venue pick is checked at the venue; a circle pick
 * at the circle's venue (pass that venue and its city).
 */
export const dailyAyahResource = (
  scopeType: 'national' | 'venue' | 'circle',
  place: { cityId: string; venueId: string } | null,
): ResourceScope =>
  scopeType === 'national' || !place ? {} : { cityId: place.cityId, venueId: place.venueId };

const cell = (def: ActionDef, actor: Actor): string => {
  if (def.level === 'public') return 'yes';
  if (def.level === 'self') return actor === 'public' ? '—' : 'own data';
  if (actor === 'public' || actor === 'attendee') return '—';
  if (!def.roles.includes(actor)) return '—';
  if (actor === 'national_admin') return 'everywhere';
  if (def.level === 'any') return actor === 'city_coordinator' ? 'own city' : 'own venue';
  if (actor === 'city_coordinator') return def.level === 'city' ? 'own city' : 'venues in own city';
  return 'own venue';
};

/** The matrix as a markdown table. `SCOPES.md` is this output and a test keeps it in sync. */
export function scopeMatrixMarkdown(): string {
  const actors: Actor[] = [
    'public',
    'attendee',
    'venue_coordinator',
    'city_coordinator',
    'national_admin',
  ];
  const header = ['Action', 'What it does', 'Checked against', ...actors];
  const lines = [
    '# Role and scope matrix',
    '',
    'Generated from `src/scopes.ts` by `pnpm --filter @qc/contracts gen`. Do not edit by hand.',
    '',
    'Staff are also attendees. A revoked assignment never counts. `own data` means the signed-in person on their own records only.',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (const action of SCOPE_ACTIONS) {
    const def = ACTIONS[action] as ActionDef;
    const row = [`\`${action}\``, def.description, def.level, ...actors.map((a) => cell(def, a))];
    lines.push(`| ${row.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}
