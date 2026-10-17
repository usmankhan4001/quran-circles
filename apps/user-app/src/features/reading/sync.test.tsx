import { describe, expect, it } from 'vitest';
import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { juzStart } from '@qc/content';
import type { ContentModules, ReadingMark } from '../content/modules';
import { SESSIONS, registrationFor } from '../../test/factories';
import { act, renderHookInApp, waitFor } from '../../test/harness';
import { configWith, mine } from '../../test/nextFeatures';
import { useReadingDaySync } from './sync';

/** A content package stand-in whose reader "saves a place" when the test says so. */
function fakeReader() {
  const listeners = new Set<(mark: ReadingMark) => void>();
  const content: ContentModules = {
    subscribeReading: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    content,
    listeners,
    save: (mark: ReadingMark) => act(async () => listeners.forEach((l) => l(mark))),
  };
}

const TODAY_MARK: ReadingMark = { surah: 18, ayah: 10, at: '2027-02-15T07:59:00Z' };

/** A registration whose session is today (Pakistan) at 20:00, reading para 5. */
function todayRegistration() {
  const session = SESSIONS.taraweeh;
  const occurrence = {
    ...session.nextOccurrence!,
    startsAt: '2027-02-15T15:00:00Z',
    endsAt: '2027-02-15T16:30:00Z',
    status: 'scheduled' as const,
    portion: { kind: 'para' as const, para: 5 },
  };
  return registrationFor({ ...session, nextOccurrence: occurrence });
}

const bodies = (calls: { body: unknown }[]) => calls.map((c) => c.body);

describe('useReadingDaySync', () => {
  it('records a reader day once when the reader saves a place today', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: { handlers: mine() },
    });
    await waitFor(() => expect(reader.listeners.size).toBe(1));
    await reader.save(TODAY_MARK);
    await reader.save({ ...TODAY_MARK, ayah: 11 });
    await waitFor(() =>
      expect(bodies(hook.world.http.callsTo('POST /v1/me/reading-days'))).toEqual([
        { source: 'reader' },
      ]),
    );
  });

  it('sends the date for a save from just before midnight yesterday, and ignores older ones', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: { handlers: mine() },
    });
    await waitFor(() => expect(reader.listeners.size).toBe(1));
    await reader.save({ surah: 1, ayah: 1, at: '2027-02-14T18:50:00Z' }); // 23:50 on the 14th
    await reader.save({ surah: 1, ayah: 2, at: '2027-02-10T10:00:00Z' }); // an old place from the account
    await waitFor(() =>
      expect(bodies(hook.world.http.callsTo('POST /v1/me/reading-days'))).toEqual([
        { source: 'reader', date: '2027-02-14' },
      ]),
    );
  });

  it("also records the portion source when the ayah is in today's session portion", async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: { handlers: mine({ registrations: [todayRegistration()] }) },
    });
    await waitFor(() => expect(reader.listeners.size).toBe(1));
    await waitFor(() =>
      expect(hook.world.http.callsTo('GET /v1/registrations/mine').length).toBe(1),
    );
    // Let the registrations reach the hook before the reader saves.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    const start = juzStart(5);
    await reader.save({ ...start, at: '2027-02-15T07:59:00Z' });
    await waitFor(() =>
      expect(bodies(hook.world.http.callsTo('POST /v1/me/reading-days'))).toEqual([
        { source: 'reader' },
        { source: 'portion' },
      ]),
    );
  });

  it('tries again on the next save after a failed call', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: { handlers: mine() },
    });
    await waitFor(() => expect(reader.listeners.size).toBe(1));
    hook.world.http.failNext('POST /v1/me/reading-days', 'service_unavailable');
    await reader.save(TODAY_MARK);
    await waitFor(() =>
      expect(hook.world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(1),
    );
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    await reader.save({ ...TODAY_MARK, ayah: 12 });
    await waitFor(() =>
      expect(hook.world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(2),
    );
  });

  it('does not retry a date the server refuses as out_of_range', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: {
        handlers: {
          ...mine(),
          'readingDays.record': (_c: unknown, id: string) =>
            new Response(
              JSON.stringify(
                makeApiError('validation_failed', id, {
                  issues: [{ path: 'date', code: 'out_of_range' }],
                }),
              ),
              {
                status: ERROR_CODES.validation_failed,
                headers: { 'content-type': 'application/json' },
              },
            ),
        },
      },
    });
    await waitFor(() => expect(reader.listeners.size).toBe(1));
    await reader.save(TODAY_MARK);
    await waitFor(() =>
      expect(hook.world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(1),
    );
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    await reader.save({ ...TODAY_MARK, ayah: 12 });
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(hook.world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(1);
  });

  it('does nothing with reading_days off', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      content: reader.content,
      mock: { handlers: { ...mine(), ...configWith(['read_along']) } },
    });
    await waitFor(() =>
      expect(hook.world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0),
    );
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(reader.listeners.size).toBe(0);
  });

  it('does nothing when signed out', async () => {
    const reader = fakeReader();
    const hook = await renderHookInApp(() => useReadingDaySync(), { content: reader.content });
    await waitFor(() =>
      expect(hook.world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0),
    );
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(reader.listeners.size).toBe(0);
  });

  it('does nothing without a content package', async () => {
    const hook = await renderHookInApp(() => useReadingDaySync(), {
      signedIn: true,
      mock: { handlers: mine() },
    });
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(hook.world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(0);
  });
});
