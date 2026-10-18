import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroHeader, Icon, SearchField, TabBar, forcedColorsActive } from '../index';
import { matrix, renderThemed } from '../test/utils';

/**
 * Fixes from the accessibility and right-to-left pass (docs/quality/accessibility-rtl.md):
 * A-06 (search field at 320 px), A-07 (forced colours), A-08 (landmarks), A-10 (badge over the
 * chosen tab's label).
 */

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

describe('forced colours (A-07)', () => {
  it('is off without the media query, as on a phone or in an ordinary browser', () => {
    expect(forcedColorsActive()).toBe(false);
    emulateForcedColors(false);
    expect(forcedColorsActive()).toBe(false);
  });

  it('draws icons in the system text colour and keeps their drawing', () => {
    emulateForcedColors(true);
    renderThemed(<Icon name="bell" color="#ffffff" />);
    const icon = screen.getByTestId('icon-bell');
    expect(icon.style.getPropertyValue('forced-color-adjust')).toBe('none');
    // The art is drawn in the system text colour, and the theme colour is gone.
    expect(icon.outerHTML).toContain('var(--qc-system-text, CanvasText)');
    expect(icon.outerHTML).not.toContain('rgb(255, 255, 255)');
  });

  it('leaves icons alone when forced colours are off', () => {
    emulateForcedColors(false);
    renderThemed(<Icon name="bell" color="#ffffff" />);
    const icon = screen.getByTestId('icon-bell');
    expect(icon.style.getPropertyValue('forced-color-adjust')).toBe('');
    expect(icon.outerHTML).toContain('rgb(255, 255, 255)');
    expect(icon.outerHTML).not.toContain('--qc-system-text');
  });

  it('leaves out the hero pattern, which would turn into solid shapes', () => {
    emulateForcedColors(true);
    renderThemed(<HeroHeader title="Home" />);
    expect(screen.queryByTestId('hero-pattern')).toBeNull();
  });

  it('keeps the hero pattern otherwise', () => {
    renderThemed(<HeroHeader title="Home" pattern />);
    expect(screen.getByTestId('hero-pattern')).toBeTruthy();
  });

  it.each(['light', 'dark', 'highContrast'] as const)(
    'gives the search field an edge forced colours can paint (%s)',
    (mode) => {
      renderThemed(
        <SearchField accessibilityLabel="Search" value="" onChangeText={() => undefined} />,
        { mode },
      );
      const box = screen.getByRole('searchbox').parentElement as HTMLElement;
      expect(box.style.borderTopWidth).toBe('1px');
      // D17: a visible hairline in light mode too.
      expect(box.style.borderTopColor).not.toMatch(/^$|transparent|rgba\(0, 0, 0, 0\)/);
    },
  );
});

describe('SearchField reflow (A-06)', () => {
  it.each(matrix.filter((c) => c.textSize === 3))(
    'lets the input shrink below the browser default width in $name',
    ({ mode, locale, textSize }) => {
      renderThemed(
        <SearchField
          accessibilityLabel="Search"
          placeholder="Search by area or masjid"
          value=""
          onChangeText={() => undefined}
        />,
        { mode, locale, textSize },
      );
      expect(getComputedStyle(screen.getByRole('searchbox')).minWidth).toBe('0px');
    },
  );
});

describe('TabBar landmarks and badge (A-08, A-10)', () => {
  const items = [
    { key: 'home', label: 'Home', icon: <Icon name="home" />, badge: { count: 1 } },
    { key: 'nearby', label: 'Nearby', icon: <Icon name="pin" /> },
  ];

  it('is a navigation landmark holding the named tab list', () => {
    renderThemed(
      <TabBar accessibilityLabel="Main menu" items={items} activeKey="home" onChange={() => {}} />,
    );
    const nav = screen.getByRole('navigation');
    expect(nav.tagName).toBe('NAV');
    expect(nav.contains(screen.getByRole('tablist', { name: 'Main menu' }))).toBe(true);
  });

  // D17 draws icon tabs without a visible label, so a badge can no longer cover one (A-10).
  // The name and the count stay in the tab's accessible name.
  it.each(matrix.filter((c) => c.textSize === 3))(
    'keeps the badge in the name and draws no label to cover in $name',
    ({ mode, locale, textSize }) => {
      renderThemed(<TabBar items={items} activeKey="home" onChange={() => {}} />, {
        mode,
        locale,
        textSize,
      });
      expect(screen.queryByText('Home')).toBeNull();
      expect(screen.getByRole('tab', { name: /^Home, / })).toBeTruthy();
    },
  );

  it('marks the chosen tab with a dot as well as colour', () => {
    renderThemed(<TabBar items={items} activeKey="nearby" onChange={() => {}} />);
    expect(screen.getByTestId('tab-dot-nearby')).toBeTruthy();
    expect(screen.queryByTestId('tab-dot-home')).toBeNull();
  });
});
