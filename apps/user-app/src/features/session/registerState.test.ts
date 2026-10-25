import { describe, expect, it } from 'vitest';
import { SESSIONS, registrationFor } from '../../test/factories';
import { registerState } from './registerState';

describe('registerState', () => {
  it('is open for a session with room', () => {
    expect(registerState(SESSIONS.taraweeh, [])).toEqual({ kind: 'open' });
    expect(registerState(SESSIONS.taraweeh, undefined)).toEqual({ kind: 'open' });
  });

  it('offers Join even when an old seat limit says the session is full', () => {
    expect(registerState(SESSIONS.womenFull, [])).toEqual({ kind: 'open' });
  });

  it('says so when no registration is needed', () => {
    const open = {
      ...SESSIONS.taraweeh,
      registration: { ...SESSIONS.taraweeh.registration, enabled: false },
    };
    expect(registerState(open, [])).toEqual({ kind: 'notNeeded' });
  });

  it('shows the person their own registration, confirmed or waiting', () => {
    for (const status of ['confirmed', 'waitlisted'] as const) {
      const mine = registrationFor(SESSIONS.taraweeh, { status });
      expect(registerState(SESSIONS.taraweeh, [mine])).toEqual({
        kind: 'registered',
        registration: mine,
      });
    }
  });

  it('lets a person register again after cancelling', () => {
    const cancelled = registrationFor(SESSIONS.taraweeh, { status: 'cancelled' });
    expect(registerState(SESSIONS.taraweeh, [cancelled])).toEqual({ kind: 'open' });
  });

  it('ignores registrations for other sessions', () => {
    const other = registrationFor(SESSIONS.circle);
    expect(registerState(SESSIONS.taraweeh, [other])).toEqual({ kind: 'open' });
  });

  it('a cancelled session cannot be registered for', () => {
    const cancelled = { ...SESSIONS.taraweeh, status: 'cancelled' as const };
    expect(registerState(cancelled, [])).toEqual({ kind: 'cancelled' });
  });
});
