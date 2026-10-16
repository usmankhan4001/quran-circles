import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW } from '@qc/contracts/fixtures';
import { SESSIONS, occurrencesOf, registrationFor } from '../../test/factories';
import { DEFAULT_LEAD_MINUTES, HORIZON_DAYS, MAX_SCHEDULED, planReminders } from './plan';

const NOW = new Date(FIXTURE_NOW);
const session = SESSIONS.taraweeh;
const occurrences = { [session.id]: occurrencesOf(session) };

describe('planReminders', () => {
  it('plans a reminder before each coming occurrence of a session with reminders on', () => {
    const plan = planReminders({
      registrations: [registrationFor(session)],
      occurrences,
      optedIn: new Set([session.id]),
      now: NOW,
    });
    expect(plan.length).toBeGreaterThan(1);
    for (const item of plan) {
      expect(Date.parse(item.startsAt) - item.fireAt.getTime()).toBe(DEFAULT_LEAD_MINUTES * 60_000);
      expect(item.fireAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(item.id).toBe(`${session.id}:${item.occurrenceId}`);
    }
    const times = plan.map((p) => p.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('plans nothing for a session the person did not switch reminders on for', () => {
    expect(
      planReminders({
        registrations: [registrationFor(session)],
        occurrences,
        optedIn: new Set(),
        now: NOW,
      }),
    ).toEqual([]);
  });

  it('skips waiting-list and cancelled registrations', () => {
    for (const status of ['waitlisted', 'cancelled'] as const) {
      expect(
        planReminders({
          registrations: [registrationFor(session, { status })],
          occurrences,
          optedIn: new Set([session.id]),
          now: NOW,
        }),
      ).toEqual([]);
    }
  });

  it('plans only the date a person registered for', () => {
    const target = occurrences[session.id]![3]!;
    const plan = planReminders({
      registrations: [registrationFor(session, { occurrenceId: target.id })],
      occurrences,
      optedIn: new Set([session.id]),
      now: NOW,
    });
    expect(plan.map((p) => p.occurrenceId)).toEqual([target.id]);
  });

  it('skips cancelled occurrences, past ones and ones beyond the horizon', () => {
    const [first, ...rest] = occurrences[session.id]!;
    const farAway = { ...first!, id: 'far', startsAt: '2027-12-01T16:00:00Z' };
    const past = { ...first!, id: 'past', startsAt: '2027-02-15T08:30:00Z' };
    const cancelled = { ...first!, id: 'cancelled', status: 'cancelled' as const };
    const plan = planReminders({
      registrations: [registrationFor(session)],
      occurrences: { [session.id]: [farAway, past, cancelled, ...rest.slice(0, 1)] },
      optedIn: new Set([session.id]),
      now: NOW,
    });
    expect(plan.map((p) => p.occurrenceId)).not.toContain('far');
    expect(plan.map((p) => p.occurrenceId)).not.toContain('past');
    expect(plan.map((p) => p.occurrenceId)).not.toContain('cancelled');
    expect(plan).toHaveLength(1);
    expect(HORIZON_DAYS).toBe(14);
  });

  it('never plans more than the phone allows', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      ...occurrences[session.id]![0]!,
      id: `occ-${i}`,
      startsAt: new Date(NOW.getTime() + (i + 2) * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    }));
    const plan = planReminders({
      registrations: [registrationFor(session)],
      occurrences: { [session.id]: many },
      optedIn: new Set([session.id]),
      now: NOW,
      horizonDays: 30,
    });
    expect(plan).toHaveLength(MAX_SCHEDULED);
    expect(plan[0]!.occurrenceId).toBe('occ-0');
  });
});
