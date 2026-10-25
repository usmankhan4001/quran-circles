import { describe, expect, it } from 'vitest';
import { within } from '@testing-library/react';
import { renderConsole, screen, text, waitFor } from '../test/harness';
import { venueA } from '../test/people';

describe('venue location picker', () => {
  it('saves the middle of the map as the venue pin', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/venues',
      handlers: {
        'adminVenues.update': (c: { body: unknown }) => ({ ...venueA, ...(c.body as object) }),
      },
    });
    await screen.findByRole('table');
    const open = (await screen.findAllByRole('button', { name: /Set the map location of/ }))[0]!;
    await user.click(open);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('application')).toBeTruthy();
    await user.click(
      within(dialog).getByRole('button', { name: text('console.venues.location.use') }),
    );
    await waitFor(() => {
      const patch = calls.filter(
        (c) => c.method === 'PATCH' && c.path.startsWith('/v1/admin/venues/'),
      );
      expect(patch).toHaveLength(1);
      expect(patch[0]?.body).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    });
    expect(await screen.findByText(text('console.venues.location.saved'))).toBeTruthy();
  });

  it('moves the pin with the arrow keys before saving', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/venues',
      handlers: {
        'adminVenues.update': (c: { body: unknown }) => ({ ...venueA, ...(c.body as object) }),
      },
    });
    await screen.findByRole('table');
    await user.click(
      (await screen.findAllByRole('button', { name: /Set the map location of/ }))[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    within(dialog).getByRole('application').focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.venues.location.use') }),
    );
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const body = calls.find((c) => c.method === 'PATCH')?.body as { lat: number; lng: number };
    // Arrow left moves the view west, so the pin lands west of where the venue was.
    expect(body.lng).toBeLessThan(venueA!.lng ?? 0);
  });

  it('closes without saving on Cancel', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/venues' });
    await screen.findByRole('table');
    await user.click(
      (await screen.findAllByRole('button', { name: /Set the map location of/ }))[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: text('console.shell.cancel') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows the refusal in the dialog and keeps it open', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/venues',
      forceError: (c) => (c.method === 'PATCH' ? 'forbidden' : undefined),
    });
    await screen.findByRole('table');
    await user.click(
      (await screen.findAllByRole('button', { name: /Set the map location of/ }))[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.venues.location.use') }),
    );
    expect(await within(dialog).findByText(text('errors.forbidden'))).toBeTruthy();
  });
});
