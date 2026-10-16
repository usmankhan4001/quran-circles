import { describe, expect, it } from 'vitest';
import type { OccurrenceWithSession } from '@qc/contracts';
import { SESSIONS, occurrencesOf, registrationFor } from '../../test/factories';
import { NOW } from '../../test/harness';
import { occurrenceAsSession } from './occurrence';
import { nextRegisteredOccurrence, pickLeadOccurrence, toInstant } from './useHome';

function item(session: (typeof SESSIONS)[keyof typeof SESSIONS], index = 0): OccurrenceWithSession {
  return { ...occurrencesOf(session)[index]!, session };
}

describe('toInstant', () => {
  it('is UTC without milliseconds', () => {
    expect(toInstant(new Date('2027-02-15T08:00:00.123Z'))).toBe('2027-02-15T08:00:00Z');
  });
});

describe('pickLeadOccurrence', () => {
  const list = [item(SESSIONS.circle), item(SESSIONS.taraweeh), item(SESSIONS.english)];

  it('leads with the program of the season when it has a session', () => {
    expect(pickLeadOccurrence(list, 'dora')?.session.id).toBe(SESSIONS.taraweeh.id);
    expect(pickLeadOccurrence(list, 'circles')?.session.id).toBe(SESSIONS.circle.id);
  });

  it('falls back to the soonest session of any program', () => {
    expect(pickLeadOccurrence([item(SESSIONS.circle)], 'dora')?.session.id).toBe(
      SESSIONS.circle.id,
    );
  });

  it('is nothing for an empty list', () => {
    expect(pickLeadOccurrence([], 'dora')).toBeUndefined();
  });
});

describe('nextRegisteredOccurrence', () => {
  it('finds the soonest session the person is confirmed for', () => {
    const found = nextRegisteredOccurrence(
      [registrationFor(SESSIONS.circle), registrationFor(SESSIONS.taraweeh)],
      NOW,
    );
    const soonest = [SESSIONS.circle, SESSIONS.taraweeh]
      .map((s) => s.nextOccurrence!.startsAt)
      .sort()[0];
    expect(found?.startsAt).toBe(soonest);
  });

  it('ignores waiting-list and cancelled registrations', () => {
    expect(
      nextRegisteredOccurrence(
        [
          registrationFor(SESSIONS.taraweeh, { status: 'waitlisted' }),
          registrationFor(SESSIONS.circle, { status: 'cancelled' }),
        ],
        NOW,
      ),
    ).toBeUndefined();
  });

  it('ignores a registration for a date that is not the next one', () => {
    expect(
      nextRegisteredOccurrence(
        [
          registrationFor(SESSIONS.taraweeh, {
            occurrenceId: '00000000-0000-4000-8000-ffffffffffff',
          }),
        ],
        NOW,
      ),
    ).toBeUndefined();
  });

  it('ignores sessions that have already started', () => {
    const later = new Date('2027-12-01T00:00:00Z');
    expect(nextRegisteredOccurrence([registrationFor(SESSIONS.taraweeh)], later)).toBeUndefined();
  });
});

describe('occurrenceAsSession', () => {
  it('shows a dated occurrence as the session’s next one', () => {
    const o = item(SESSIONS.taraweeh, 2);
    const session = occurrenceAsSession(o);
    expect(session.id).toBe(SESSIONS.taraweeh.id);
    expect(session.nextOccurrence?.id).toBe(o.id);
    expect(session.nextOccurrence).not.toHaveProperty('session');
  });
});
