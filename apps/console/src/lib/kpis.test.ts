import { describe, expect, it } from 'vitest';
import type { AdminSession, AuditEntry, Invite, StaffRoleAssignment } from '@qc/contracts';
import { sessions, venues } from '@qc/contracts/fixtures';
import { auditStats, coordinatorStats, sessionStats, venueStats } from './kpis';

const NOW = Date.parse('2027-02-15T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const base = sessions[0]!;

const session = (
  n: number,
  next: number | null,
  over: Partial<AdminSession> = {},
): AdminSession => ({
  ...base,
  id: `00000000-0000-4000-8000-0e00000000${String(n).padStart(2, '0')}`,
  circleStatus: null,
  nextOccurrence:
    next === null
      ? null
      : {
          id: `00000000-0000-4000-8000-0e10000000${String(n).padStart(2, '0')}`,
          sessionId: base.id,
          startsAt: new Date(next).toISOString(),
          endsAt: new Date(next + 3600_000).toISOString(),
          status: 'scheduled',
          portion: null,
          portionLabel: null,
          recapNote: null,
          recapLocale: null,
        },
  ...over,
});

describe('session numbers', () => {
  it('counts sessions meeting in the next seven days and those waiting, never seats', () => {
    const list = [
      session(1, NOW + DAY),
      session(2, NOW + 7 * DAY - 1),
      session(3, NOW + 7 * DAY), // a week away exactly: next week
      session(4, NOW - 1), // already started
      session(5, null),
      session(6, NOW + 2 * DAY, {
        registration: { enabled: true, capacity: 30, seatsTaken: 30, full: true },
      }),
      session(7, null, { circleStatus: 'pending_approval' }),
      session(8, null, { circleStatus: 'published' }),
    ];
    expect(sessionStats(list, NOW)).toEqual({
      total: 8,
      thisWeek: 3,
      waitingApproval: 1,
    });
  });

  it('is all zero for no sessions', () => {
    expect(sessionStats([], NOW)).toEqual({ total: 0, thisWeek: 0, waitingApproval: 0 });
  });
});

describe('venue numbers', () => {
  it('counts active venues, women’s sections and missing contact numbers, and archived apart', () => {
    const [a, b, c] = venues;
    const list = [
      {
        ...a!,
        status: 'active' as const,
        contactPhone: null,
        facilities: { ...a!.facilities, womenSection: false },
      },
      {
        ...b!,
        status: 'active' as const,
        contactPhone: '+923000000081',
        facilities: { ...b!.facilities, womenSection: true },
      },
      {
        ...c!,
        status: 'archived' as const,
        contactPhone: null,
        facilities: { ...c!.facilities, womenSection: true },
      },
    ];
    // The archived venue is counted apart, not in the active numbers.
    expect(venueStats(list)).toEqual({ active: 2, archived: 1, womenSection: 1, noContact: 1 });
  });
});

describe('coordinator numbers', () => {
  const invite = (n: number, status: Invite['status']): Invite => ({
    id: `00000000-0000-4000-8000-0e20000000${String(n).padStart(2, '0')}`,
    phone: `+9230000000${String(n).padStart(2, '0')}`,
    displayName: null,
    role: 'venue_coordinator',
    scopeType: 'venue',
    cityId: null,
    venueId: venues[0]!.id,
    status,
    createdAt: '2027-02-10T00:00:00Z',
    expiresAt: '2027-02-17T00:00:00Z',
  });
  const person = (n: number, revokedAt: string | null): StaffRoleAssignment => ({
    id: `00000000-0000-4000-8000-0e30000000${String(n).padStart(2, '0')}`,
    userId: `00000000-0000-4000-8000-0e40000000${String(n).padStart(2, '0')}`,
    userName: null,
    phone: `+9230000001${String(n).padStart(2, '0')}`,
    role: 'venue_coordinator',
    scopeType: 'venue',
    cityId: null,
    venueId: venues[0]!.id,
    scopeName: null,
    createdAt: '2027-02-01T00:00:00Z',
    revokedAt,
  });

  it('counts invites by status and the people who hold a role now', () => {
    const stats = coordinatorStats(
      [invite(1, 'pending'), invite(2, 'pending'), invite(3, 'accepted'), invite(4, 'expired')],
      [person(1, null), person(2, '2027-02-05T00:00:00Z'), person(3, null)],
    );
    expect(stats).toEqual({ waiting: 2, accepted: 1, expired: 1, activeRoles: 2 });
  });
});

describe('audit numbers', () => {
  const entry = (n: number, actorName: string | null, action: string): AuditEntry => ({
    id: `audit-${n}`,
    actorName,
    action,
    entityType: 'registration',
    entityId: null,
    scopeType: 'national',
    cityId: null,
    venueId: null,
    createdAt: '2027-02-10T00:00:00Z',
  });

  it('counts entries, named people and registration exports', () => {
    const stats = auditStats([
      entry(1, 'Test Person One', 'registration.export'),
      entry(2, 'Test Person One', 'venue.update'),
      entry(3, 'Test Person Two', 'registration.export'),
      entry(4, null, 'session.archive'),
      entry(5, '', 'exports.viewed'),
    ]);
    expect(stats).toEqual({ entries: 5, people: 2, exports: 2 });
  });
});
