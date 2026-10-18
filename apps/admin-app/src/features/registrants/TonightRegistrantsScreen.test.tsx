import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, FIXTURE_NOW, meFor } from '../../test/backend';
import { combos, renderScreen } from '../../test/render';
import { nextOf } from '../home/TodayScreen';
import { TonightRegistrantsScreen } from './TonightRegistrantsScreen';

describe.each(combos)('TonightRegistrantsScreen in $name', (combo) => {
  it('shows the registrants of the next session in scope, with no back button', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { container } = renderScreen(<TonightRegistrantsScreen now={FIXTURE_NOW} />, {
      backend,
      combo,
    });
    await screen.findByTestId('registrants');
    await screen.findByTestId('registrants-search');
    const call = backend.callsTo('registrations.forSession')[0];
    const inScope = backend.state.sessions.filter(
      (s) => s.venueId === backend.me.roles[0]!.venueId,
    );
    if (call) expect(call.path).toContain(nextOf(inScope)!.id);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('TonightRegistrantsScreen', () => {
  it('says so when no session has a coming date', async () => {
    const backend = createBackend({ me: meFor('venue') });
    for (const s of backend.state.sessions) s.nextOccurrence = null;
    renderScreen(<TonightRegistrantsScreen now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByText('No sessions in your area yet')).toBeTruthy();
  });
});
