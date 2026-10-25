import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor, type RoleKind } from '../../test/backend';
import { combos, renderScreen, settled } from '../../test/render';
import { routes } from '../../navigation/routes';
import { isToday } from '../../lib/time';
import { TodayScreen, nextOf } from './TodayScreen';
import { SessionScreen } from './SessionScreen';

const sessionRow = (id: string) => screen.queryByTestId(`session-${id}`);

describe.each(combos)('TodayScreen in $name', (combo) => {
  it('lists the sessions of the working scope and sets the layout direction', async () => {
    const { container } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('city') }),
      combo,
    });
    await settled('today-data');
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('TodayScreen scope', () => {
  it('shows a venue coordinator only their own venue', async () => {
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await settled('today-data');
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
    expect(sessionRow(ids.sessionCircle)).toBeTruthy();
    expect(sessionRow(ids.sessionWomen)).toBeNull();
    expect(sessionRow(ids.sessionLahore)).toBeNull();
  });

  it('shows a city coordinator the venues of their city, not another city', async () => {
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await settled('today-data');
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
    expect(sessionRow(ids.sessionWomen)).toBeTruthy();
    expect(sessionRow(ids.sessionLahore)).toBeNull();
  });

  it('shows a national admin every city', async () => {
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('admin') }),
    });
    await settled('today-data');
    expect(sessionRow(ids.sessionLahore)).toBeTruthy();
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
  });

  it('lets someone with two roles switch scope, and the list follows', async () => {
    const backend = createBackend({ me: meFor('multi') });
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    await settled('today-data');
    // Opens on the first venue; the other venue's session is not shown.
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
    expect(sessionRow(ids.sessionLahore)).toBeNull();
    fireEvent.click(screen.getByTestId('scope-switcher'));
    fireEvent.click(await screen.findByTestId(`scope-switcher-option-${backend.me.roles[1]!.id}`));
    await waitFor(() => expect(sessionRow(ids.sessionLahore)).toBeTruthy());
    expect(sessionRow(ids.sessionDora)).toBeNull();
    const lastList = backend.callsTo('adminSessions.list').at(-1)!;
    expect(lastList.query.venueId).toBe(backend.me.roles[1]!.venueId);
  });

  it('offers no choice to someone with one role', async () => {
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await settled('today-data');
    expect(screen.getByTestId('scope-single')).toBeTruthy();
    expect(screen.queryByTestId('scope-switcher')).toBeNull();
  });

  it('opens a session when tapped', async () => {
    const { nav } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await settled('today-data');
    fireEvent.click(screen.getByTestId(`session-${ids.sessionDora}`));
    expect(nav.pushed).toEqual([routes.session(ids.sessionDora)]);
  });

  it('offers to post an update', async () => {
    const { nav } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    fireEvent.click(await screen.findByTestId('today-post-update'));
    expect(nav.pushed).toEqual([routes.postUpdate()]);
  });

  it('shows an empty state when the scope has no sessions', async () => {
    const backend = createBackend({
      me: meFor('venue'),
      handlers: { 'adminSessions.list': () => ({ items: [], nextCursor: null }) },
    });
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByText('No sessions in your area yet')).toBeTruthy();
  });

  it('shows the offline state and recovers on retry', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.setOffline(true);
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    const retry = await screen.findByRole('button', { name: /try again/i });
    backend.setOffline(false);
    fireEvent.click(retry);
    await settled('today-data');
  });
});

describe('SessionScreen', () => {
  it('gives a venue coordinator every action on their own session', async () => {
    const { nav } = renderScreen(<SessionScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await settled('session-data');
    fireEvent.click(await screen.findByTestId('session-registrants'));
    fireEvent.click(screen.getByTestId('session-change-time'));
    fireEvent.click(screen.getByTestId('session-post-update'));
    expect(nav.pushed[0]).toMatch(/^\/session\/.+\/registrants\?occurrenceId=/);
    expect(nav.pushed[1]).toBe(routes.schedule(ids.sessionDora));
    expect(nav.pushed[2]).toBe(routes.postUpdate(ids.sessionDora));
  });

  it('lists the coming dates with attendance and portion shortcuts', async () => {
    const { nav } = renderScreen(<SessionScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await settled('session-dates');
    const first = (await screen.findAllByTestId(/^occurrence-[0-9a-f-]+-attendance$/))[0]!;
    fireEvent.click(first);
    expect(nav.pushed.at(-1)).toMatch(/\/occurrence\/.+\/attendance$/);
    const edit = screen.getAllByTestId(/^occurrence-[0-9a-f-]+-edit$/)[0]!;
    fireEvent.click(edit);
    expect(nav.pushed.at(-1)).toMatch(/\/occurrence\/[^/]+$/);
  });

  it('shows no seat count, even for a session with an old seat limit', async () => {
    renderScreen(<SessionScreen sessionId={ids.sessionWomen} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await settled('session-data');
    expect(await screen.findByTestId('session-registrants')).toBeTruthy();
    expect(screen.queryByText(/seat/i)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it("says a session outside the person's scope is not available, with no actions", async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<SessionScreen sessionId={ids.sessionLahore} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('session-data-not-available')).toBeTruthy();
    within(screen.getByTestId('session')).getByText(/not available to you/);
    expect(screen.queryByTestId('session-registrants')).toBeNull();
    expect(screen.queryByTestId('session-change-time')).toBeNull();
    expect(screen.queryByTestId('session-post-update')).toBeNull();
    expect(screen.queryAllByTestId(/-attendance$/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/-edit$/)).toHaveLength(0);
    expect(screen.queryByText(/Johar Town Dora/)).toBeNull();
    // No retry button: trying again cannot help.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('reads the session with adminSessions.get, drafts included', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.state.sessions.find((s) => s.id === ids.sessionCircle)!.status = 'draft';
    renderScreen(<SessionScreen sessionId={ids.sessionCircle} now={FIXTURE_NOW} />, { backend });
    await settled('session-data');
    expect(await screen.findByText('Draft')).toBeTruthy();
    expect(backend.callsTo('adminSessions.get')).toHaveLength(1);
    expect(backend.callsTo('sessions.get')).toHaveLength(0);
    expect(backend.callsTo('adminSessions.list')).toHaveLength(0);
  });

  it('shows a retryable error when the read fails for another reason', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminSessions.get', 'service_unavailable');
    renderScreen(<SessionScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />, { backend });
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    await screen.findByTestId('session-registrants');
  });
});

describe.each(combos)('SessionScreen in $name', (combo) => {
  it('shows the session with the right direction', async () => {
    const { container } = renderScreen(
      <SessionScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />,
      { backend: createBackend({ me: meFor('venue') }), combo },
    );
    await settled('session-data');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });

  it('shows not available with the right direction', async () => {
    const { container } = renderScreen(
      <SessionScreen sessionId={ids.sessionLahore} now={FIXTURE_NOW} />,
      { backend: createBackend({ me: meFor('venue') }), combo },
    );
    await settled('session-data-not-available');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

/** The session Today should put in the big card for a backend: the earliest coming date in scope. */
function expectedNext(backend: ReturnType<typeof createBackend>, venueId?: string) {
  const inScope = backend.state.sessions.filter((s) => !venueId || s.venueId === venueId);
  return nextOf(inScope)!;
}

describe('nextOf', () => {
  const base = createBackend().state.sessions;
  it('picks the session whose next date comes first', () => {
    const sorted = [...base]
      .filter((s) => s.nextOccurrence)
      .sort((a, b) => a.nextOccurrence!.startsAt.localeCompare(b.nextOccurrence!.startsAt));
    expect(nextOf(base)?.id).toBe(sorted[0]!.id);
    expect(nextOf([...base].reverse())?.id).toBe(sorted[0]!.id);
  });

  it('skips sessions with no coming date or a cancelled one, and can find none', () => {
    const [a, b] = base.filter((s) => s.nextOccurrence);
    const none = { ...a!, nextOccurrence: null };
    const cancelled = {
      ...a!,
      nextOccurrence: { ...a!.nextOccurrence!, status: 'cancelled' as const },
    };
    expect(nextOf([none, b!])?.id).toBe(b!.id);
    expect(nextOf([cancelled, b!])?.id).toBe(b!.id);
    expect(nextOf([none])).toBeNull();
    expect(nextOf([])).toBeNull();
  });
});

describe('TodayScreen next session card', () => {
  it('puts the next session in the big card with its time, people coming, its two buttons and the tiles', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const next = expectedNext(backend, ids.venueAlNoor);
    const { nav } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    const card = await screen.findByTestId('today-next');
    expect(within(card).getByTestId(`session-${next.id}`)).toBeTruthy();
    expect(within(card).getByText(next.title.en)).toBeTruthy();
    expect(within(card).getByTestId('today-next-time').textContent).toMatch(/\d:\d\d/);
    if (next.registration.seatsTaken !== null) {
      expect(within(card).getByTestId('today-next-coming').textContent).toBe(
        String(next.registration.seatsTaken),
      );
    }
    // The big card is not repeated in the list below it.
    expect(screen.getAllByTestId(`session-${next.id}`)).toHaveLength(1);

    // D17: "Log attendance" and "Registrants" on the card; attendance, portion, post and the QR
    // poster as tiles under it.
    fireEvent.click(screen.getByTestId('today-action-registrants'));
    fireEvent.click(screen.getByTestId('today-action-attendance'));
    fireEvent.click(screen.getByTestId('today-tile-attendance'));
    fireEvent.click(screen.getByTestId('today-action-portion'));
    fireEvent.click(screen.getByTestId('today-action-post'));
    fireEvent.click(screen.getByTestId('today-action-posters'));
    const occ = next.nextOccurrence!;
    expect(nav.pushed).toEqual([
      routes.registrants(next.id, isToday(occ.startsAt, FIXTURE_NOW) ? occ.id : undefined),
      routes.attendance(next.id, occ.id),
      routes.attendance(next.id, occ.id),
      routes.occurrence(next.id, occ.id),
      routes.postUpdate(next.id),
      routes.posters(next.id),
    ]);
  });

  it('opens the session when the top of the card is tapped', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const next = expectedNext(backend, ids.venueAlNoor);
    const { nav } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    fireEvent.click(await screen.findByTestId(`session-${next.id}`));
    expect(nav.pushed).toEqual([routes.session(next.id)]);
  });

  it("opens today's registrants for today's date only when the next session is today", async () => {
    const backend = createBackend({ me: meFor('venue') });
    const next = expectedNext(backend, ids.venueAlNoor);
    // A day before the next date: the card says the date and registrants opens without a date.
    const dayBefore = new Date(Date.parse(next.nextOccurrence!.startsAt) - 24 * 3600_000);
    const first = renderScreen(<TodayScreen now={dayBefore} />, { backend });
    await screen.findByTestId('today-next');
    expect(screen.getByText('Next session')).toBeTruthy();
    fireEvent.click(screen.getByTestId('today-action-registrants'));
    expect(first.nav.pushed).toEqual([routes.registrants(next.id)]);
    first.unmount();

    const now = new Date(next.nextOccurrence!.startsAt);
    const { nav } = renderScreen(<TodayScreen now={now} />, { backend });
    const card = await screen.findByTestId('today-next');
    expect(within(card).getByText('Today')).toBeTruthy();
    fireEvent.click(screen.getByTestId('today-action-registrants'));
    expect(nav.pushed).toEqual([routes.registrants(next.id, next.nextOccurrence!.id)]);
  });

  it('shows the portion being read when the next date has one', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const next = expectedNext(backend, ids.venueAlNoor);
    const s = backend.state.sessions.find((x) => x.id === next.id)!;
    s.nextOccurrence = { ...s.nextOccurrence!, portionLabel: 'Sample portion 1 to 31' };
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    expect((await screen.findByTestId('today-next-portion')).textContent).toBe(
      'Sample portion 1 to 31',
    );
  });

  it('shows no big card when no session has a coming date, and lists them all', async () => {
    const backend = createBackend({ me: meFor('venue') });
    for (const s of backend.state.sessions) s.nextOccurrence = null;
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    await settled('today-data');
    expect(screen.queryByTestId('today-next')).toBeNull();
    expect(screen.queryByTestId('today-actions')).toBeNull();
    expect(sessionRow(ids.sessionDora)).toBeTruthy();
    expect(screen.getByText('Your sessions')).toBeTruthy();
  });

  it.each<RoleKind>(['venue', 'city', 'admin', 'multi'])(
    'gives a %s every quick action on a session in scope',
    async (kind) => {
      const backend = createBackend({ me: meFor(kind) });
      renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
      await screen.findByTestId('today-next');
      for (const id of ['registrants', 'attendance', 'portion', 'post', 'posters']) {
        expect(screen.getByTestId(`today-action-${id}`)).toBeTruthy();
      }
    },
  );

  it('puts only sessions of the working scope in the big card', async () => {
    const backend = createBackend({ me: meFor('venue') });
    // The Lahore session is made the soonest of all; a venue coordinator in Rawalpindi never sees it.
    const lahore = backend.state.sessions.find((s) => s.id === ids.sessionLahore)!;
    lahore.nextOccurrence = { ...lahore.nextOccurrence!, startsAt: '2027-02-15T08:30:00Z' };
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    const card = await screen.findByTestId('today-next');
    expect(within(card).queryByTestId(`session-${ids.sessionLahore}`)).toBeNull();
    expect(screen.queryByTestId(`session-${ids.sessionLahore}`)).toBeNull();
  });
});

describe.each(combos)('TodayScreen next session card in $name', (combo) => {
  it('shows the card and its actions, with the Urdu time kept left to right', async () => {
    const { container } = renderScreen(<TodayScreen now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await screen.findByTestId('today-next');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(4);
    const time = screen.getByTestId('today-next-time').textContent ?? '';
    // Urdu: the part of the day, then the figures in an isolate (A-09): "رات ⁨9:00⁩".
    if (combo.locale === 'ur') expect(time).toMatch(/^[\u0600-\u06ff]+ \u2068\d{1,2}:\d\d\u2069$/);
    else expect(time).not.toMatch(/[\u2066-\u2069\u200e]/);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});
