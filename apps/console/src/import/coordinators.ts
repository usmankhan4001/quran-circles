import {
  InviteBody,
  type City,
  type Invite,
  type Role,
  type StaffRoleAssignment,
  type Venue,
} from '@qc/contracts';
import type { CsvTable } from '../lib/csv';
import { canAssignRole } from '../lib/permissions';
import { maskPhone, normalizePhone } from '../lib/phone';
import { columnForPath, normalizeName, readTable, type ColumnSpec, type ReadRow } from './table';
import {
  buildReport,
  issue,
  type DryRunReport,
  type DryRunRow,
  type ImportActor,
  type ImportIssue,
} from './types';

export type CoordinatorBody = InviteBody;

export const COORDINATOR_COLUMNS: readonly ColumnSpec[] = [
  { name: 'phone', aliases: ['whatsapp', 'mobile', 'number'], required: true },
  { name: 'name', aliases: ['display_name'] },
  { name: 'role', required: true },
  { name: 'city', aliases: ['city_slug', 'city_name'] },
  { name: 'venue', aliases: ['venue_slug', 'venue_name', 'venue_id'] },
];

export const COORDINATOR_PATH_COLUMNS: Readonly<Record<string, string>> = {
  phone: 'phone',
  displayName: 'name',
  role: 'role',
  cityId: 'city',
  venueId: 'venue',
};

const ROLE_WORDS: Record<string, Role> = {
  national_admin: 'national_admin',
  nationaladmin: 'national_admin',
  admin: 'national_admin',
  city_coordinator: 'city_coordinator',
  citycoordinator: 'city_coordinator',
  city: 'city_coordinator',
  venue_coordinator: 'venue_coordinator',
  venuecoordinator: 'venue_coordinator',
  venue: 'venue_coordinator',
};

export interface CoordinatorContext extends ImportActor {
  cities: readonly City[];
  venues: readonly Venue[];
  /** Invites already sent, so a number is not invited twice. */
  invites: readonly Invite[];
  /** People who already hold a role. Past (revoked) assignments are ignored. */
  assignments: readonly StaffRoleAssignment[];
}

const sameText = (a: string, b: string): boolean => normalizeName(a) === normalizeName(b);

const cityMatches = (c: City, text: string) =>
  sameText(c.slug, text) ||
  sameText(c.name.en, text) ||
  (c.name.ur !== null && sameText(c.name.ur, text));

const venueMatches = (v: Venue, text: string) =>
  v.id === text ||
  sameText(v.slug, text) ||
  sameText(v.name.en, text) ||
  (v.name.ur !== null && sameText(v.name.ur, text));

/** A phone number shown as `+92 3•• •••• 567` in reports, so a shared report stays private. */

const scopeKey = (role: Role, cityId: string | null, venueId: string | null): string =>
  role === 'national_admin'
    ? 'national'
    : role === 'city_coordinator'
      ? `city:${cityId}`
      : `venue:${venueId}`;

export function validateCoordinators(
  table: CsvTable,
  ctx: CoordinatorContext,
): DryRunReport<CoordinatorBody> {
  const read = readTable(table, COORDINATOR_COLUMNS);
  const rows: DryRunRow<CoordinatorBody>[] = [];
  const firstByIdentity = new Map<string, number>();
  const firstByPhone = new Map<string, number>();

  const activeAssignments = ctx.assignments.filter((a) => !a.revokedAt);
  const pendingInvites = ctx.invites.filter((i) => i.status === 'pending');

  for (const row of read.rows) {
    const issues: ImportIssue[] = [];
    const bad = read.malformed.get(row.line);
    if (bad) issues.push(bad);
    const built = bad ? null : buildInvite(row, ctx, issues);

    let status: DryRunRow<CoordinatorBody>['status'] = issues.some((i) => i.severity === 'error')
      ? 'invalid'
      : 'valid';
    let label = row.get('name') || `#${row.line}`;

    if (built) {
      const { body, cityId, venueId } = built;
      label = `${row.get('name') || `#${row.line}`} (${maskPhone(body.phone)})`;
      const identity = `${body.phone}|${body.role}|${scopeKey(body.role, cityId, venueId)}`;
      const earlier = firstByIdentity.get(identity);
      const earlierPhone = firstByPhone.get(body.phone);
      if (status === 'valid' && earlier !== undefined) {
        issues.push(issue(row.line, 'phone', 'duplicate_in_file', { firstLine: earlier }));
        status = 'invalid';
      } else if (status === 'valid') {
        firstByIdentity.set(identity, row.line);
        if (earlierPhone !== undefined)
          issues.push(
            issue(row.line, 'phone', 'phone_repeated', { firstLine: earlierPhone }, 'warning'),
          );
        const key = scopeKey(body.role, cityId, venueId);
        if (
          activeAssignments.some(
            (a) =>
              a.phone === body.phone &&
              a.role === body.role &&
              scopeKey(a.role, a.cityId, a.venueId) === key,
          )
        ) {
          issues.push(issue(row.line, 'phone', 'already_assigned', undefined, 'warning'));
          status = 'duplicate';
        } else if (
          pendingInvites.some(
            (i) =>
              i.phone === body.phone &&
              i.role === body.role &&
              scopeKey(i.role, i.cityId, i.venueId) === key,
          )
        ) {
          issues.push(issue(row.line, 'phone', 'already_invited', undefined, 'warning'));
          status = 'duplicate';
        }
      }
      if (!firstByPhone.has(body.phone)) firstByPhone.set(body.phone, row.line);
    }
    rows.push({
      line: row.line,
      status,
      issues,
      label,
      ...(status !== 'invalid' && built ? { body: built.body } : {}),
    });
  }
  return buildReport('coordinators', read.fileIssues, rows);
}

interface BuiltInvite {
  body: CoordinatorBody;
  cityId: string | null;
  venueId: string | null;
}

function buildInvite(
  row: ReadRow,
  ctx: CoordinatorContext,
  issues: ImportIssue[],
): BuiltInvite | null {
  const line = row.line;
  const phoneText = row.get('phone');
  const roleText = row.get('role');

  let e164: string | null = null;
  if (!phoneText) issues.push(issue(line, 'phone', 'required', { column: 'phone' }));
  else {
    const phone = normalizePhone(phoneText, { mobileOnly: true });
    if (phone.ok) e164 = phone.e164;
    else
      issues.push(
        issue(line, 'phone', phone.issue === 'not_mobile' ? 'phone_not_mobile' : 'invalid_phone', {
          column: 'phone',
        }),
      );
  }

  let role: Role | null = null;
  if (!roleText) issues.push(issue(line, 'role', 'required', { column: 'role' }));
  else {
    role =
      ROLE_WORDS[
        roleText
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_')
      ] ?? null;
    if (!role) issues.push(issue(line, 'role', 'unknown_role', { column: 'role' }));
  }

  let cityId: string | null = null;
  let venueId: string | null = null;
  const cityText = row.get('city');
  const venueText = row.get('venue');

  if (role === 'city_coordinator') {
    if (!cityText) issues.push(issue(line, 'city', 'required', { column: 'city' }));
    else {
      const city = ctx.cities.find((c) => cityMatches(c, cityText));
      if (!city) issues.push(issue(line, 'city', 'unknown_city', { column: 'city' }));
      else cityId = city.id;
    }
  } else if (role === 'venue_coordinator') {
    if (!venueText) issues.push(issue(line, 'venue', 'required', { column: 'venue' }));
    else {
      // A city column narrows the search when two cities have a venue of the same name.
      const city = cityText ? ctx.cities.find((c) => cityMatches(c, cityText)) : undefined;
      if (cityText && !city) issues.push(issue(line, 'city', 'unknown_city', { column: 'city' }));
      const found = ctx.venues.filter(
        (v) => venueMatches(v, venueText) && (!city || v.cityId === city.id),
      );
      if (found.length === 0)
        issues.push(issue(line, 'venue', 'unknown_venue', { column: 'venue' }));
      else if (found.length > 1)
        issues.push(issue(line, 'venue', 'ambiguous_venue', { column: 'venue' }));
      else {
        venueId = (found[0] as Venue).id;
        cityId = (found[0] as Venue).cityId;
      }
    }
  }

  if (role && (role === 'national_admin' || cityId || venueId)) {
    const scope =
      role === 'venue_coordinator'
        ? { cityId, venueId }
        : role === 'city_coordinator'
          ? { cityId }
          : {};
    if (!canAssignRole(ctx.principal, role, scope))
      issues.push(issue(line, 'role', 'out_of_scope', { column: 'role' }));
  }

  if (issues.some((i) => i.severity === 'error') || !e164 || !role) return null;

  const name = row.get('name');
  const parsed = InviteBody.safeParse({
    role,
    phone: e164,
    ...(name ? { displayName: name } : {}),
    ...(role === 'city_coordinator' ? { cityId } : {}),
    ...(role === 'venue_coordinator' ? { venueId } : {}),
  });
  if (!parsed.success) {
    for (const zodIssue of parsed.error.issues) {
      const column = columnForPath(COORDINATOR_PATH_COLUMNS, zodIssue.path);
      issues.push(issue(line, column, 'invalid_value', { column: column ?? 'row' }));
    }
    return null;
  }
  return { body: parsed.data, cityId, venueId };
}
