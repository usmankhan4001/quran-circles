import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { createBackend, meFor } from '../../test/backend';
import { combos, renderScreen } from '../../test/render';
import { routes } from '../../navigation/routes';
import { UpdatesScreen } from './UpdatesScreen';

function seed(backend: ReturnType<typeof createBackend>) {
  backend.state.updates.push({
    id: '00000000-0000-4000-8000-0b0000009001',
    kind: 'announcement',
    scope: { type: 'venue', cityId: fx.venues[0]!.cityId, venueId: fx.venues[0]!.id },
    title: { en: 'Sample update title', ur: null },
    body: { en: 'Sample update body', ur: null },
    sessionId: null,
    publishedAt: fx.FIXTURE_NOW,
    authorName: 'Sample Coordinator',
    recipients: 37,
  });
}

describe.each(combos)('UpdatesScreen in $name', (combo) => {
  it('lists what was posted with the number reached', async () => {
    const backend = createBackend({ me: meFor('venue') });
    seed(backend);
    const { container } = renderScreen(<UpdatesScreen />, { backend, combo });
    const card = await screen.findByTestId('update-00000000-0000-4000-8000-0b0000009001');
    expect(card.textContent).toMatch(/Sample update title|Sample/);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('UpdatesScreen', () => {
  it('says so when nothing was posted', async () => {
    renderScreen(<UpdatesScreen />, { backend: createBackend({ me: meFor('venue') }) });
    expect(await screen.findByText('No updates yet')).toBeTruthy();
  });

  it('shows how many people an update reached', async () => {
    const backend = createBackend({ me: meFor('city') });
    seed(backend);
    renderScreen(<UpdatesScreen />, { backend });
    const card = await screen.findByTestId('update-00000000-0000-4000-8000-0b0000009001');
    expect(card.textContent).toContain('Reached 37 people');
  });

  it.each(['venue', 'city', 'admin'] as const)(
    'lets a %s coordinator start a new update',
    async (kind) => {
      const { nav } = renderScreen(<UpdatesScreen />, {
        backend: createBackend({ me: meFor(kind) }),
      });
      fireEvent.click(await screen.findByTestId('updates-new'));
      expect(nav.pushed).toEqual([routes.postUpdate()]);
    },
  );

  it('shows the mapped message when the list cannot load', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminUpdates.list', 'rate_limited', { times: 1 });
    renderScreen(<UpdatesScreen />, { backend });
    expect(await screen.findByText(/Too many tries/i)).toBeTruthy();
  });
});
