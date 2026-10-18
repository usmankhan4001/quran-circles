import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor, registrantsFor } from '../../test/backend';
import { combos, renderScreen, RTL_UR, typeInto } from '../../test/render';
import { AttendanceScreen } from './AttendanceScreen';

const open = async (
  options: { me?: 'venue' | 'city' | 'admin'; sessionId?: string; count?: number } = {},
) => {
  const backend = createBackend({
    me: meFor(options.me ?? 'venue'),
    registrantCount: options.count,
  });
  const sessionId = options.sessionId ?? ids.sessionDora;
  const occ = backend.state.occurrences.find((o) => o.sessionId === sessionId)!;
  const view = renderScreen(
    <AttendanceScreen sessionId={sessionId} occurrenceId={occ.id} now={FIXTURE_NOW} />,
    { backend },
  );
  return { occ, ...view };
};
const putBody = (backend: ReturnType<typeof createBackend>) =>
  backend.callsTo('adminAttendance.put')[0]?.body as Record<string, unknown>;
const registrant = (i: number) => registrantsFor(ids.sessionDora, i + 1)[i]!;

describe.each(combos)('AttendanceScreen in $name', (combo) => {
  it('shows the headcount first and the tick list under it', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const occ = backend.state.occurrences.find((o) => o.sessionId === ids.sessionDora)!;
    const { container } = renderScreen(
      <AttendanceScreen sessionId={ids.sessionDora} occurrenceId={occ.id} now={FIXTURE_NOW} />,
      { backend, combo },
    );
    await screen.findByTestId('attendance-form');
    expect(screen.getByTestId('attendance-headcount')).toBeTruthy();
    await screen.findByTestId(`attendance-tick-${registrant(0).id}`);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('AttendanceScreen', () => {
  it('saves a bare headcount with no names', async () => {
    const { backend, occ } = await open();
    await screen.findByTestId('attendance-form');
    typeInto('attendance-headcount-input', '25');
    fireEvent.click(screen.getByTestId('attendance-save'));
    expect(await screen.findByTestId('attendance-saved')).toBeTruthy();
    expect(putBody(backend)).toEqual({ headcount: 25, entries: [] });
    expect(backend.callsTo('adminAttendance.put')[0]!.path).toContain(occ.id);
  });

  it('counts a tick by the size of the party and saves who came', async () => {
    const { backend } = await open();
    await screen.findByTestId('attendance-form');
    const one = await screen.findByTestId(`attendance-tick-${registrant(0).id}`);
    const three = await screen.findByTestId(`attendance-tick-${registrant(2).id}`);
    fireEvent.click(one); // party of 1
    fireEvent.click(three); // party of 3
    expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe('4');
    fireEvent.click(screen.getByTestId('attendance-save'));
    await screen.findByTestId('attendance-saved');
    expect(putBody(backend)).toEqual({
      headcount: 4,
      entries: [
        { registrationId: registrant(0).id, name: null, count: 1 },
        { registrationId: registrant(2).id, name: null, count: 3 },
      ],
    });
  });

  it('ticks everyone loaded and clears them again', async () => {
    const { backend } = await open({ count: 5 });
    await screen.findByTestId('attendance-form');
    await screen.findByTestId(`attendance-tick-${registrant(0).id}`);
    fireEvent.click(screen.getByTestId('attendance-tick-all'));
    expect(
      screen.getByTestId(`attendance-tick-${registrant(0).id}`).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByTestId('attendance-ticked-count').textContent).toMatch(
      /^([1-9]\d*) \/ \1 checked in$/,
    );
    const total = backend.state.registrants
      .get(ids.sessionDora)!
      .filter((r) => r.status === 'confirmed')
      .reduce((sum, r) => sum + r.partySize, 0);
    expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe(
      String(total),
    );
    fireEvent.click(screen.getByTestId('attendance-clear'));
    expect(screen.getByTestId('attendance-ticked-count').textContent).toMatch(
      /^0 \/ [1-9]\d* checked in$/,
    );
    expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe('0');
  });

  it('adds a drop-in with a name and raises the headcount', async () => {
    const { backend } = await open();
    await screen.findByTestId('attendance-form');
    typeInto('attendance-new-name', 'Sample Visitor');
    fireEvent.click(screen.getByTestId('attendance-add'));
    expect(screen.getByText(/Sample Visitor/)).toBeTruthy();
    expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe('1');
    fireEvent.click(screen.getByTestId('attendance-save'));
    await screen.findByTestId('attendance-saved');
    expect(putBody(backend)).toEqual({
      headcount: 1,
      entries: [{ registrationId: null, name: 'Sample Visitor', count: 1 }],
    });
  });

  it('refuses a headcount lower than the people ticked', async () => {
    const { backend } = await open();
    const three = await screen.findByTestId(`attendance-tick-${registrant(2).id}`);
    fireEvent.click(three);
    typeInto('attendance-headcount-input', '1');
    fireEvent.click(screen.getByTestId('attendance-save'));
    expect((await screen.findByTestId('attendance-error')).textContent).toBe(
      'The headcount is lower than the people you ticked.',
    );
    expect(backend.callsTo('adminAttendance.put')).toHaveLength(0);
  });

  it('loads and shows attendance that was marked before', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const occ = backend.state.occurrences.find((o) => o.sessionId === ids.sessionDora)!;
    backend.state.attendance.set(occ.id, {
      headcount: 9,
      entries: [{ registrationId: registrant(0).id, name: null, count: 1 }],
      markedAt: '2027-02-14T20:00:00Z',
    });
    renderScreen(
      <AttendanceScreen sessionId={ids.sessionDora} occurrenceId={occ.id} now={FIXTURE_NOW} />,
      {
        backend,
      },
    );
    await waitFor(() =>
      expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe(
        '9',
      ),
    );
  });

  it('shows an empty state when no one registered, and still takes a headcount', async () => {
    const { backend } = await open({ count: 0 });
    expect(await screen.findByText('No one is registered')).toBeTruthy();
    typeInto('attendance-headcount-input', '7');
    fireEvent.click(screen.getByTestId('attendance-save'));
    await screen.findByTestId('attendance-saved');
    expect(putBody(backend)).toEqual({ headcount: 7, entries: [] });
  });

  it('shows the mapped error when saving fails and keeps the numbers', async () => {
    const { backend } = await open();
    backend.failWith('adminAttendance.put', 'service_unavailable');
    await screen.findByTestId('attendance-form');
    typeInto('attendance-headcount-input', '12');
    fireEvent.click(screen.getByTestId('attendance-save'));
    expect(await screen.findByText(/busy right now/)).toBeTruthy();
    expect((screen.getByTestId('attendance-headcount-input') as HTMLInputElement).value).toBe('12');
    expect(screen.queryByTestId('attendance-saved')).toBeNull();
  });

  it('is closed to a venue coordinator on another venue: not available, nothing loaded', async () => {
    const { backend } = await open({ sessionId: ids.sessionLahore });
    expect(await screen.findByTestId('attendance-not-available')).toBeTruthy();
    expect(screen.getByText(/not available to you/)).toBeTruthy();
    expect(backend.callsTo('adminAttendance.get')).toHaveLength(0);
    expect(backend.callsTo('adminAttendance.put')).toHaveLength(0);
  });

  it('the stand-in server itself refuses attendance on another venue, as the real one must', async () => {
    const backend = createBackend({ me: meFor('venue') });
    // Ask for an occurrence of the Lahore session directly: the guard of the backend refuses.
    const lahore = backend.state.occurrences.find((o) => o.sessionId === ids.sessionLahore)!;
    const res = await backend.fetch(
      `http://mock.test/v1/admin/occurrences/${lahore.id}/attendance`,
      {
        headers: { authorization: 'Bearer mock-staff' },
      },
    );
    expect(res.status).toBe(403);
  });

  it('is open to a city coordinator for the venues of their city', async () => {
    await open({ me: 'city', sessionId: ids.sessionWomen });
    await screen.findByTestId('attendance-form');
  });
});

describe('AttendanceScreen tick list', () => {
  it('shows the count from the start, "Mark everyone" beside it, and clear only after a tick', async () => {
    await open({ count: 4 });
    await screen.findByTestId(`attendance-tick-${registrant(0).id}`);
    const list = screen.getByTestId('attendance-tick-list');
    const confirmed = registrantsFor(ids.sessionDora, 4).filter((r) => r.status === 'confirmed');
    expect(within(list).getByTestId('attendance-ticked-count').textContent).toBe(
      `0 / ${confirmed.length} checked in`,
    );
    expect(within(list).getByTestId('attendance-tick-all')).toBeTruthy();
    expect(within(list).queryByTestId('attendance-clear')).toBeNull();
    fireEvent.click(screen.getByTestId(`attendance-tick-${registrant(0).id}`));
    expect(within(list).getByTestId('attendance-ticked-count').textContent).toBe(
      `1 / ${confirmed.length} checked in`,
    );
    expect(within(list).getAllByRole('checkbox')).toHaveLength(confirmed.length);
    fireEvent.click(within(list).getByTestId('attendance-clear'));
    expect(within(list).queryByTestId('attendance-clear')).toBeNull();
  });

  it('says the date is not available, with no retry, when the session does not list it', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(
      <AttendanceScreen
        sessionId={ids.sessionDora}
        occurrenceId="00000000-0000-4000-8000-0d0000000001"
        now={FIXTURE_NOW}
      />,
      { backend },
    );
    expect(await screen.findByTestId('attendance-occurrence-not-available')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
    expect(backend.callsTo('adminAttendance.get')).toHaveLength(0);
  });

  it('shows the date in the header with the Urdu time kept left to right', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const occ = backend.state.occurrences.find((o) => o.sessionId === ids.sessionDora)!;
    renderScreen(
      <AttendanceScreen sessionId={ids.sessionDora} occurrenceId={occ.id} now={FIXTURE_NOW} />,
      { backend, combo: RTL_UR },
    );
    await screen.findByTestId('attendance-form');
    const hero = screen.getByTestId('attendance-hero');
    // The Urdu part of the day, then the figures in an isolate (A-09): "رات ⁨9:00⁩".
    expect(hero.textContent).toMatch(/[\u0600-\u06ff]+ \u2068\d{1,2}:\d\d\u2069/);
  });
});
