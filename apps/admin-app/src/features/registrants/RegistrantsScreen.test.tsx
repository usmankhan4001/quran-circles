import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor, registrantsFor } from '../../test/backend';
import { combos, renderScreen, settled, typeInto } from '../../test/render';
import { RegistrantsScreen } from './RegistrantsScreen';

const idOf = (sessionId: string, i: number) => registrantsFor(sessionId, i + 1)[i]!.id;

describe.each(combos)('RegistrantsScreen in $name', (combo) => {
  it('lists names, numbers, party sizes and sections of today for a city coordinator', async () => {
    const backend = createBackend({ me: meFor('city') });
    const { container } = renderScreen(
      <RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />,
      { backend, combo },
    );
    await settled('registrants-list');
    const first = await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
    expect(within(first).getByText(/Sample Guest One/)).toBeTruthy();
    // A number is shown to a coordinator, in Western digits, as a left-to-right run.
    expect(first.textContent).toMatch(/\+92 300 \d{7}/);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
    // The list asked for today's occurrence only.
    const call = backend.callsTo('registrations.forSession')[0]!;
    expect(call.query.occurrenceId).toBeTruthy();
  });
});

describe('RegistrantsScreen behaviour', () => {
  it('never calls the bulk export', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    await settled('registrants-list');
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
    expect(backend.callsTo('registrations.export')).toHaveLength(0);
    expect(screen.queryByText(/export/i)).toBeNull();
  });

  it('opens the dialler and WhatsApp with tel: and wa.me links', async () => {
    const onContact = vi.fn();
    renderScreen(
      <RegistrantsScreen
        sessionId={ids.sessionDora}
        now={FIXTURE_NOW}
        pollMs={0}
        onContact={onContact}
      />,
      { backend: createBackend({ me: meFor('venue') }) },
    );
    const id = idOf(ids.sessionDora, 0);
    fireEvent.click(await screen.findByTestId(`registrant-${id}-call`));
    expect(onContact).toHaveBeenLastCalledWith('call', expect.stringMatching(/^tel:\+92/));
    fireEvent.click(await screen.findByTestId(`registrant-${id}-whatsapp`));
    expect(onContact).toHaveBeenLastCalledWith(
      'whatsapp',
      expect.stringMatching(/^https:\/\/wa\.me\/92/),
    );
  });

  it('offers WhatsApp only to people who allowed it, and no buttons without a number', async () => {
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend: createBackend({ me: meFor('venue'), registrantCount: 8 }),
    });
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
    // Guest 2 did not allow WhatsApp; guest 6 has no number at all.
    expect(screen.queryByTestId(`registrant-${idOf(ids.sessionDora, 1)}-whatsapp`)).toBeNull();
    expect(screen.queryByTestId(`registrant-${idOf(ids.sessionDora, 5)}-call`)).toBeNull();
    expect(screen.getAllByText('No phone number').length).toBeGreaterThan(0);
  });

  it('narrows the loaded list by name without asking the server again', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    await settled('registrants-list');
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
    const before = backend.callsTo('registrations.forSession').length;
    typeInto('registrants-search', 'guest TWO');
    expect(screen.queryByTestId(`registrant-${idOf(ids.sessionDora, 0)}`)).toBeNull();
    expect(screen.getByTestId(`registrant-${idOf(ids.sessionDora, 1)}`)).toBeTruthy();
    typeInto('registrants-search', 'nobody');
    expect(screen.getByTestId('registrants-no-match').textContent).toBe(
      'No one matches your search.',
    );
    typeInto('registrants-search', '');
    expect(screen.getByTestId(`registrant-${idOf(ids.sessionDora, 0)}`)).toBeTruthy();
    expect(backend.callsTo('registrations.forSession')).toHaveLength(before);
  });

  it('shows the waiting list on its own tab', async () => {
    const backend = createBackend({ me: meFor('city'), registrantCount: 8 });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
    fireEvent.click(screen.getByRole('radio', { name: 'Waiting list' }));
    await waitFor(() =>
      expect(backend.callsTo('registrations.forSession').at(-1)?.query.status).toBe('waitlisted'),
    );
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 4)}`);
  });

  it('pages through a long list', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionWomen} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    const more = await screen.findByTestId('registrants-more');
    fireEvent.click(more);
    await waitFor(() =>
      expect(backend.callsTo('registrations.forSession').length).toBeGreaterThanOrEqual(2),
    );
    await waitFor(() => expect(screen.queryByTestId('registrants-more')).toBeNull());
  });

  it('shows an empty state with no registrants', async () => {
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend: createBackend({ me: meFor('city'), registrantCount: 0 }),
    });
    expect(await screen.findByText('No one has registered yet')).toBeTruthy();
  });

  it('shows a retryable error when the list cannot load', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('registrations.forSession', 'service_unavailable');
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    expect(await screen.findByText(/busy right now/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByTestId(`registrant-${idOf(ids.sessionDora, 0)}`);
  });

  it('keeps a venue coordinator out of another venue: no list, no request for it', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionLahore} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    expect(await screen.findByTestId('registrants-forbidden')).toBeTruthy();
    expect(screen.getByText(/do not have permission/i)).toBeTruthy();
    expect(backend.callsTo('registrations.forSession')).toHaveLength(0);
  });

  it('shows the server refusal when the app lets a request through that the server denies', async () => {
    // The hidden-button rule is a courtesy. If it ever missed, the server still says no and the
    // person sees the mapped message, not a crash.
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('registrations.forSession', 'forbidden', { times: 5 });
    renderScreen(<RegistrantsScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} pollMs={0} />, {
      backend,
    });
    expect(await screen.findByText(/do not have permission/i)).toBeTruthy();
  });
});
