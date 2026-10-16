import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_KEY } from '../../appearance/AppearanceProvider';
import { createMemoryStore } from '../../storage/storage';
import { createBackend, meFor } from '../../test/backend';
import { combos, renderScreen } from '../../test/render';
import { AccountScreen } from './AccountScreen';

describe.each(combos)('AccountScreen in $name', (combo) => {
  it('shows who is signed in and the display choices', async () => {
    const { container } = renderScreen(<AccountScreen />, {
      backend: createBackend({ me: meFor('city') }),
      combo,
    });
    await screen.findByTestId('account');
    expect(screen.getByText(/Sample Coordinator/)).toBeTruthy();
    expect(screen.getByTestId('account-sign-out')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('AccountScreen', () => {
  it('shows a single role as a plain line and several as a picker', async () => {
    const single = renderScreen(<AccountScreen />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    expect(await screen.findByTestId('scope-single')).toBeTruthy();
    expect(screen.queryByTestId('scope-switcher')).toBeNull();
    single.unmount();
    renderScreen(<AccountScreen />, { backend: createBackend({ me: meFor('multi') }) });
    expect(await screen.findByTestId('scope-switcher')).toBeTruthy();
  });

  it('switches the language and remembers it', async () => {
    const prefs = createMemoryStore();
    renderScreen(<AccountScreen />, { backend: createBackend({ me: meFor('city') }), prefs });
    fireEvent.click(await screen.findByText('اردو'));
    await waitFor(async () =>
      expect(JSON.parse((await prefs.get(APPEARANCE_KEY)) ?? '{}').locale).toBe('ur'),
    );
    expect(
      document.documentElement.dir === 'rtl' || document.querySelector('[dir="rtl"]'),
    ).toBeTruthy();
  });

  it('changes and remembers the text size', async () => {
    const prefs = createMemoryStore();
    renderScreen(<AccountScreen />, { backend: createBackend({ me: meFor('city') }), prefs });
    fireEvent.click(await screen.findByText('Largest'));
    await waitFor(async () =>
      expect(JSON.parse((await prefs.get(APPEARANCE_KEY)) ?? '{}').textSize).toBe(3),
    );
  });

  it('changes and remembers the colours', async () => {
    const prefs = createMemoryStore();
    renderScreen(<AccountScreen />, { backend: createBackend({ me: meFor('city') }), prefs });
    fireEvent.click(await screen.findByTestId('account-color'));
    fireEvent.click(await screen.findByTestId('account-color-option-dark'));
    await waitFor(async () =>
      expect(JSON.parse((await prefs.get(APPEARANCE_KEY)) ?? '{}').colorChoice).toBe('dark'),
    );
  });

  it('signs out on the server and forgets the sign-in on the device', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<AccountScreen />, { backend });
    fireEvent.click(await screen.findByTestId('account-sign-out'));
    await waitFor(() => expect(backend.callsTo('auth.signOut')).toHaveLength(1));
    expect(await screen.findByTestId('signed-out')).toBeTruthy();
  });

  it('still signs out on the device when the server is unreachable', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<AccountScreen />, { backend });
    await screen.findByTestId('account');
    backend.setOffline(true);
    fireEvent.click(screen.getByTestId('account-sign-out'));
    expect(await screen.findByTestId('signed-out')).toBeTruthy();
  });
});
