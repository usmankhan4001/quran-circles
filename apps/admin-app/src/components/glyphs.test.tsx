import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Glyph } from './glyphs';

/** Pretends the browser has forced colours (Windows high contrast) on or off. */
function emulateForcedColors(active: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: active && query === '(forced-colors: active)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Glyph in forced colours (A-07)', () => {
  it.each(['chat'] as const)(
    'keeps the %s drawing and drops the theme colour when forced colours are on',
    (name) => {
      emulateForcedColors(true);
      render(<Glyph name={name} color="#ffffff" />);
      const glyph = screen.getByTestId(`glyph-${name}`);
      expect(glyph.style.getPropertyValue('forced-color-adjust')).toBe('none');
      // Drawn in the system text colour; the theme colour is gone.
      expect(glyph.outerHTML).toContain('CanvasText');
      expect(glyph.outerHTML).not.toContain('rgb(255, 255, 255)');
    },
  );

  it('draws in the theme colour when forced colours are off', () => {
    emulateForcedColors(false);
    render(<Glyph name="chat" color="#ffffff" />);
    const glyph = screen.getByTestId('glyph-chat');
    expect(glyph.style.getPropertyValue('forced-color-adjust')).toBe('');
    expect(glyph.outerHTML).toContain('rgb(255, 255, 255)');
  });
});
