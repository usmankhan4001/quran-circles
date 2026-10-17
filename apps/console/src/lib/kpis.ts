import type { AdminSession, AuditEntry, Invite, StaffRoleAssignment, Venue } from '@qc/contracts';

/**
 * The numbers on top of each table page, counted only from what the contract's list endpoints
 * already return for the rows on screen. No endpoint returns totals or reports yet, so a page that
 * has more rows to load says its numbers cover the loaded rows only. Numbers the drawings show
 * without a source in the contract (registrations this month, the share who turned up) are not
 * made up here; see docs/agents/status/console.md.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionStats {
  /** Sessions in the list (after the page's filters). */
  total: number;
  /** Sessions whose next meeting starts within the next seven days. */
  thisWeek: number;
  /** Sessions with a seat limit and every seat taken. */
  full: number;
  /** Sessions whose circle is waiting for a city lead's approval. */
  waitingApproval: number;
}

export function sessionStats(sessions: readonly AdminSession[], nowMs: number): SessionStats {
  let thisWeek = 0;
  let full = 0;
  let waitingApproval = 0;
  for (const s of sessions) {
    const next = s.nextOccurrence ? Date.parse(s.nextOccurrence.startsAt) : NaN;
    if (!Number.isNaN(next) && next >= nowMs && next < nowMs + WEEK_MS) thisWeek += 1;
    if (s.registration.full) full += 1;
    if (s.circleStatus === 'pending_approval') waitingApproval += 1;
  }
  return { total: sessions.length, thisWeek, full, waitingApproval };
}

export interface VenueStats {
  active: number;
  archived: number;
  womenSection: number;
  /** Active venues with no public contact number, which people cannot call. */
  noContact: number;
}

export function venueStats(venues: readonly Venue[]): VenueStats {
  const active = venues.filter((v) => v.status === 'active');
  return {
    active: active.length,
    archived: venues.length - active.length,
    womenSection: active.filter((v) => v.facilities.womenSection).length,
    noContact: active.filter((v) => !v.contactPhone).length,
  };
}

export interface CoordinatorStats {
  waiting: number;
  accepted: number;
  expired: number;
  /** People holding a role now, among the loaded rows. */
  activeRoles: number;
}

export function coordinatorStats(
  invites: readonly Invite[],
  people: readonly StaffRoleAssignment[],
): CoordinatorStats {
  return {
    waiting: invites.filter((i) => i.status === 'pending').length,
    accepted: invites.filter((i) => i.status === 'accepted').length,
    expired: invites.filter((i) => i.status === 'expired').length,
    activeRoles: people.filter((p) => p.revokedAt === null).length,
  };
}

export interface AuditStats {
  entries: number;
  /** Different named people who did something; system entries are not a person. */
  people: number;
  /** Registration exports: each one is a file with names and numbers. */
  exports: number;
}

export function auditStats(entries: readonly AuditEntry[]): AuditStats {
  const people = new Set(
    entries.map((e) => e.actorName).filter((n): n is string => typeof n === 'string' && n !== ''),
  );
  return {
    entries: entries.length,
    people: people.size,
    exports: entries.filter((e) => e.action.endsWith('.export')).length,
  };
}
