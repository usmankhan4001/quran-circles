import { act, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { armStartFrameDeferral, useStartFrameDeferral } from './startFrame';

function Probe() {
  const below = useStartFrameDeferral();
  return <Text testID="probe">{below ? 'below' : 'first'}</Text>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useStartFrameDeferral', () => {
  it('draws everything at once when nothing armed it', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('below');
  });

  it('leaves what is below the fold for the frame after the armed start frame, once', async () => {
    vi.useFakeTimers();
    armStartFrameDeferral();
    const first = render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('first');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByTestId('probe').textContent).toBe('below');
    first.unmount();

    // The next screen draws at once: the deferral was for the start frame only.
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('below');
  });

  it('does nothing after the screen is gone', async () => {
    vi.useFakeTimers();
    armStartFrameDeferral();
    const view = render(<Probe />);
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByTestId('probe')).toBeNull();
  });
});
