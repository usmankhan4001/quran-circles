import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { fonts, sansWeights, urduFallbackFont } from '@qc/ui';
import { appFontFamilies } from './appFonts';
import { FontGate } from './FontGate';

function renderGate(load: () => Promise<void>, timeoutMs?: number) {
  return render(
    <FontGate load={load} {...(timeoutMs !== undefined ? { timeoutMs } : {})}>
      <Text>App</Text>
    </FontGate>,
  );
}

describe('admin app fonts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the families under the token names, Figtree in the type roles weights', () => {
    expect(appFontFamilies.map((f) => f.fontFamily)).toEqual([
      fonts.sans,
      fonts.urdu,
      urduFallbackFont,
      fonts.quran,
    ]);
    expect(appFontFamilies[0]?.fontDefinitions.map((d) => String(d.weight))).toEqual([
      ...sansWeights,
    ]);
    expect(String(appFontFamilies[3]?.fontDefinitions[0]?.path)).toContain(
      'KFGQPCUthmanicScriptHAFS-Regular.otf',
    );
  });

  it('draws the app once the fonts have loaded', async () => {
    const load = vi.fn(() => Promise.resolve());
    renderGate(load);
    expect(screen.getByTestId('fonts-loading')).toBeTruthy();
    expect(await screen.findByText('App')).toBeTruthy();
    expect(load).toHaveBeenCalledWith(appFontFamilies);
  });

  it('draws the app with fallback fonts when loading fails', async () => {
    renderGate(() => Promise.reject(new Error('missing')));
    expect(await screen.findByText('App')).toBeTruthy();
  });

  it('draws the app after the timeout when a font never arrives', async () => {
    vi.useFakeTimers();
    renderGate(() => new Promise(() => undefined), 500);
    expect(screen.queryByText('App')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText('App')).toBeTruthy();
  });
});
