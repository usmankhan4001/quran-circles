import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor } from '../../test/backend';
import { combos, renderScreen, typeInto } from '../../test/render';
import { routes } from '../../navigation/routes';
import { OccurrenceScreen } from './OccurrenceScreen';

const firstOccurrence = (backend: ReturnType<typeof createBackend>, sessionId: string) =>
  backend.state.occurrences.find((o) => o.sessionId === sessionId)!;

const open = async (
  options: { me?: 'venue' | 'city' | 'admin'; sessionId?: string; now?: Date } = {},
) => {
  const backend = createBackend({ me: meFor(options.me ?? 'venue') });
  const sessionId = options.sessionId ?? ids.sessionDora;
  const occ = firstOccurrence(backend, sessionId);
  const view = renderScreen(
    <OccurrenceScreen
      sessionId={sessionId}
      occurrenceId={occ.id}
      now={options.now ?? FIXTURE_NOW}
    />,
    { backend },
  );
  return { occ, ...view };
};
const updateBody = (backend: ReturnType<typeof createBackend>) =>
  backend.callsTo('adminOccurrences.update')[0]?.body as Record<string, unknown>;

describe.each(combos)('OccurrenceScreen in $name', (combo) => {
  it('shows the portion and recap fields', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const occ = firstOccurrence(backend, ids.sessionDora);
    const { container } = renderScreen(
      <OccurrenceScreen sessionId={ids.sessionDora} occurrenceId={occ.id} now={FIXTURE_NOW} />,
      { backend, combo },
    );
    await screen.findByTestId('occurrence-form');
    expect(screen.getByTestId('occurrence-portion-kind')).toBeTruthy();
    expect(screen.getByTestId('occurrence-recap')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('OccurrenceScreen', () => {
  it('sets the portion and the recap and saves only what changed', async () => {
    const { backend, nav } = await open();
    await screen.findByTestId('occurrence-form');
    // The fixture date already has Para 1; change it to the surah Yasin.
    fireEvent.click(screen.getByTestId('occurrence-portion-kind'));
    fireEvent.click(await screen.findByTestId('occurrence-portion-kind-option-surah'));
    typeInto('occurrence-surah', '36');
    typeInto('occurrence-recap', 'We read the first page with tajweed.');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(updateBody(backend)).toEqual({
      portion: { kind: 'surah', surah: 36 },
      recapNote: 'We read the first page with tajweed.',
      recapLocale: 'en',
      notify: false,
    });
  });

  it('clears the portion by choosing "Not set"', async () => {
    const { backend } = await open();
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-portion-kind'));
    fireEvent.click(await screen.findByTestId('occurrence-portion-kind-option-none'));
    fireEvent.click(screen.getByTestId('occurrence-save'));
    await waitFor(() => expect(updateBody(backend)).toMatchObject({ portion: null }));
  });

  it('checks the para and verse numbers', async () => {
    const { backend } = await open();
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-portion-kind'));
    fireEvent.click(await screen.findByTestId('occurrence-portion-kind-option-ayah_range'));
    typeInto('occurrence-surah', '2');
    typeInto('occurrence-from-ayah', '10');
    typeInto('occurrence-to-ayah', '5');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByText(/last is not before the first/)).toBeTruthy();
    typeInto('occurrence-to-ayah', '20');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    await waitFor(() =>
      expect(updateBody(backend)).toMatchObject({
        portion: { kind: 'ayah_range', surah: 2, fromAyah: 10, toAyah: 20 },
      }),
    );
  });

  it('rejects a para outside 1 to 30', async () => {
    const { backend } = await open();
    await screen.findByTestId('occurrence-form');
    typeInto('occurrence-para', '31');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByText('Enter a number from 1 to 30.')).toBeTruthy();
    expect(backend.callsTo('adminOccurrences.update')).toHaveLength(0);
  });

  it('says so when nothing has changed', async () => {
    const { backend } = await open();
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByTestId('occurrence-nothing')).toBeTruthy();
    expect(backend.callsTo('adminOccurrences.update')).toHaveLength(0);
  });

  it('asks before cancelling one date, and says whether people will be told', async () => {
    const { backend, nav, occ } = await open();
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-cancelled'));
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByText('Registered people will be told.')).toBeTruthy();
    expect(backend.callsTo('adminOccurrences.update')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('occurrence-cancel-confirm-confirm'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(updateBody(backend)).toEqual({ status: 'cancelled', notify: true });
    expect(backend.state.occurrences.find((o) => o.id === occ.id)!.status).toBe('cancelled');
    // Only this date: the next one is untouched.
    const next = backend.state.occurrences.filter((o) => o.sessionId === ids.sessionDora)[1]!;
    expect(next.status).toBe('scheduled');
  });

  it('can cancel quietly', async () => {
    const { backend } = await open();
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-cancelled'));
    fireEvent.click(screen.getByTestId('occurrence-notify'));
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByText('No one will be told.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('occurrence-cancel-confirm-confirm'));
    await waitFor(() =>
      expect(updateBody(backend)).toEqual({ status: 'cancelled', notify: false }),
    );
  });

  it('closes the sheet and shows the mapped error when the server refuses the cancellation', async () => {
    const { backend } = await open();
    backend.failWith('adminOccurrences.update', 'session_cancelled');
    await screen.findByTestId('occurrence-form');
    fireEvent.click(screen.getByTestId('occurrence-cancelled'));
    fireEvent.click(screen.getByTestId('occurrence-save'));
    fireEvent.click(await screen.findByTestId('occurrence-cancel-confirm-confirm'));
    expect(await screen.findByText('This session has been cancelled.')).toBeTruthy();
  });

  it('marks the field the server rejected', async () => {
    const { backend, nav } = await open();
    backend.failWith('adminOccurrences.update', 'validation_failed', {
      issues: [{ path: 'recapNote', code: 'too_big' }],
    });
    await screen.findByTestId('occurrence-form');
    typeInto('occurrence-recap', 'A short recap.');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    expect(await screen.findByText('This was not accepted. Check it and try again.')).toBeTruthy();
    expect(nav.backs).toBe(0);
  });

  it('does not offer to cancel a date that has passed, but still takes a recap', async () => {
    const { backend } = await open({ now: new Date('2027-03-20T00:00:00Z') });
    // The past is outside the 60-day window of the first date? Not here: Feb 15 is 33 days back.
    await screen.findByTestId('occurrence-form');
    expect(screen.queryByTestId('occurrence-cancelled')).toBeNull();
    typeInto('occurrence-recap', 'A good session.');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    await waitFor(() =>
      expect(updateBody(backend)).toMatchObject({ recapNote: 'A good session.' }),
    );
  });

  it('shows the form in Urdu with the recap field right to left', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const occ = firstOccurrence(backend, ids.sessionDora);
    renderScreen(
      <OccurrenceScreen sessionId={ids.sessionDora} occurrenceId={occ.id} now={FIXTURE_NOW} />,
      {
        backend,
        combo: { locale: 'ur' },
      },
    );
    await screen.findByTestId('occurrence-form');
    expect(screen.getByText('اس تاریخ کا حصہ')).toBeTruthy();
    const recap = screen.getByTestId('occurrence-recap');
    const field = recap.tagName === 'TEXTAREA' ? recap : (recap.querySelector('textarea') ?? recap);
    expect(field.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
  });

  it('is closed to a venue coordinator on another venue', async () => {
    const { backend } = await open({ sessionId: ids.sessionLahore });
    expect(await screen.findByTestId('occurrence-not-available')).toBeTruthy();
    expect(screen.getByText(/not available to you/)).toBeTruthy();
    expect(backend.callsTo('adminOccurrences.update')).toHaveLength(0);
  });

  it('opens for a national admin anywhere', async () => {
    await open({ me: 'admin', sessionId: ids.sessionLahore });
    await screen.findByTestId('occurrence-form');
  });

  it('goes back to the session after saving', async () => {
    const { nav } = await open();
    await screen.findByTestId('occurrence-form');
    typeInto('occurrence-recap', 'x');
    fireEvent.click(screen.getByTestId('occurrence-save'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(routes.session(ids.sessionDora)).toBe(`/session/${ids.sessionDora}`);
  });
});
