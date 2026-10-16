import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor } from '../../test/backend';
import { combos, renderScreen, settled } from '../../test/render';
import { routes } from '../../navigation/routes';
import { TodayScreen } from './TodayScreen';
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

  it('shows the seats of a session with a capacity', async () => {
    renderScreen(<SessionScreen sessionId={ids.sessionWomen} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await settled('session-data');
    expect(await screen.findByText(/40 of 40 seats taken/)).toBeTruthy();
  });

  it("hides every coordinator action on a session outside the person's scope", async () => {
    renderScreen(<SessionScreen sessionId={ids.sessionLahore} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await settled('session-data');
    expect(screen.queryByTestId('session-registrants')).toBeNull();
    expect(screen.queryByTestId('session-change-time')).toBeNull();
    expect(screen.queryByTestId('session-post-update')).toBeNull();
    expect(screen.queryAllByTestId(/-attendance$/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/-edit$/)).toHaveLength(0);
    within(screen.getByTestId('session')).getByText(/Johar Town Dora/);
  });
});
