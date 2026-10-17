import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, ids, meFor } from '../../test/backend';
import { combos, renderScreen, typeInto } from '../../test/render';
import { ScheduleScreen } from './ScheduleScreen';

const open = async (
  backend = createBackend({ me: meFor('venue') }),
  sessionId: string = ids.sessionDora,
) => {
  const view = renderScreen(<ScheduleScreen sessionId={sessionId} now={FIXTURE_NOW} />, {
    backend,
  });
  await waitFor(() =>
    expect(
      screen.queryByTestId('schedule-form') ??
        screen.queryByTestId('schedule-forbidden') ??
        screen.queryByTestId('schedule-data-not-available'),
    ).toBeTruthy(),
  );
  return { ...view };
};
const changeBody = (backend: ReturnType<typeof createBackend>) =>
  backend.callsTo('adminSessions.changeSchedule')[0]?.body as Record<string, unknown>;

describe.each(combos)('ScheduleScreen in $name', (combo) => {
  it('shows the current time and the form', async () => {
    const { container } = renderScreen(
      <ScheduleScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />,
      {
        backend: createBackend({ me: meFor('venue') }),
        combo,
      },
    );
    await screen.findByTestId('schedule-form');
    expect((screen.getByTestId('schedule-time') as HTMLInputElement).value).toBe('21:00');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('ScheduleScreen', () => {
  it('spells out the effect, then saves only what changed from the chosen date', async () => {
    const { backend } = await open();
    await screen.findByTestId('schedule-form');
    typeInto('schedule-time', '20:00');
    fireEvent.click(screen.getByTestId('schedule-review'));
    // Before saving: when, how many dates, how many people are told, and the poster warning.
    expect(await screen.findByText(/New time: 8:00 pm, from/)).toBeTruthy();
    expect(screen.getByTestId('schedule-effect-people').textContent).toBe(
      '6 registered people will be told',
    );
    expect(screen.getAllByText(/printed poster/).length).toBeGreaterThan(0);
    expect(backend.callsTo('adminSessions.changeSchedule')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('schedule-confirm-confirm'));
    expect(await screen.findByTestId('schedule-done')).toBeTruthy();
    expect(changeBody(backend)).toEqual({
      localStartTime: '20:00',
      effectiveFrom: '2027-02-15',
      notify: true,
    });
    expect(screen.getByText('Registered people were told.')).toBeTruthy();
  });

  it('can change the time without telling anyone', async () => {
    const { backend } = await open();
    typeInto('schedule-time', '20:30');
    fireEvent.click(screen.getByTestId('schedule-notify'));
    fireEvent.click(screen.getByTestId('schedule-review'));
    expect((await screen.findByTestId('schedule-effect-people')).textContent).toBe(
      'No one will be told.',
    );
    fireEvent.click(screen.getByTestId('schedule-confirm-confirm'));
    await screen.findByTestId('schedule-done');
    expect(changeBody(backend)).toMatchObject({ notify: false });
    expect(screen.getByText('No one was told.')).toBeTruthy();
  });

  it('tidies a short time such as 7:30 to 07:30', async () => {
    const { backend } = await open();
    typeInto('schedule-time', '7:30');
    fireEvent.click(screen.getByTestId('schedule-review'));
    fireEvent.click(await screen.findByTestId('schedule-confirm-confirm'));
    await screen.findByTestId('schedule-done');
    expect(changeBody(backend)).toMatchObject({ localStartTime: '07:30' });
  });

  it('sends the days when they change', async () => {
    const { backend } = await open(createBackend({ me: meFor('venue') }), ids.sessionCircle);
    // The Tuesday circle meets on day 2; add Thursday (4).
    fireEvent.click(screen.getByTestId('schedule-day-4'));
    fireEvent.click(screen.getByTestId('schedule-review'));
    fireEvent.click(await screen.findByTestId('schedule-confirm-confirm'));
    await screen.findByTestId('schedule-done');
    expect(changeBody(backend)).toMatchObject({ daysOfWeek: [2, 4] });
    expect(changeBody(backend)).not.toHaveProperty('localStartTime');
  });

  it('refuses a request that changes nothing', async () => {
    const { backend } = await open();
    fireEvent.click(screen.getByTestId('schedule-review'));
    expect(await screen.findByTestId('schedule-nothing')).toBeTruthy();
    expect(backend.callsTo('adminSessions.changeSchedule')).toHaveLength(0);
  });

  it('refuses a time that is not a time', async () => {
    const { backend } = await open();
    typeInto('schedule-time', '25:99');
    fireEvent.click(screen.getByTestId('schedule-review'));
    expect(
      await screen.findByText('Use 24-hour time, for example 17:30.', {
        selector: '[role="alert"], *',
      }),
    ).toBeTruthy();
    expect(screen.queryByTestId('schedule-confirm-confirm')).toBeNull();
    expect(backend.callsTo('adminSessions.changeSchedule')).toHaveLength(0);
  });

  it('shows the mapped error when the session was cancelled meanwhile', async () => {
    const { backend } = await open();
    backend.failWith('adminSessions.changeSchedule', 'session_cancelled');
    typeInto('schedule-time', '20:00');
    fireEvent.click(screen.getByTestId('schedule-review'));
    fireEvent.click(await screen.findByTestId('schedule-confirm-confirm'));
    expect(await screen.findByText('This session has been cancelled.')).toBeTruthy();
    expect(screen.queryByTestId('schedule-done')).toBeNull();
  });

  it('marks the field the server rejected', async () => {
    const { backend } = await open();
    backend.failWith('adminSessions.changeSchedule', 'validation_failed', {
      issues: [{ path: 'localStartTime', code: 'invalid_format' }],
    });
    typeInto('schedule-time', '20:00');
    fireEvent.click(screen.getByTestId('schedule-review'));
    fireEvent.click(await screen.findByTestId('schedule-confirm-confirm'));
    expect(await screen.findByText('This was not accepted. Check it and try again.')).toBeTruthy();
    expect(screen.queryByTestId('schedule-done')).toBeNull();
  });

  it('still lets the change go ahead when the registrant count is unavailable', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('registrations.forSession', 'service_unavailable');
    await open(backend);
    typeInto('schedule-time', '20:00');
    fireEvent.click(screen.getByTestId('schedule-review'));
    expect((await screen.findByTestId('schedule-effect-people')).textContent).toBe(
      'Registered people will be told.',
    );
  });

  it('hides the form from a venue coordinator on a session outside their venue', async () => {
    const { backend } = await open(createBackend({ me: meFor('venue') }), ids.sessionLahore);
    expect(await screen.findByTestId('schedule-data-not-available')).toBeTruthy();
    expect(screen.queryByTestId('schedule-review')).toBeNull();
    expect(backend.callsTo('adminSessions.changeSchedule')).toHaveLength(0);
  });

  it('lets a city coordinator change any venue of their city', async () => {
    const { backend } = await open(createBackend({ me: meFor('city') }), ids.sessionWomen);
    typeInto('schedule-time', '17:00');
    fireEvent.click(screen.getByTestId('schedule-review'));
    fireEvent.click(await screen.findByTestId('schedule-confirm-confirm'));
    await waitFor(() => expect(changeBody(backend)).toMatchObject({ localStartTime: '17:00' }));
  });
});
