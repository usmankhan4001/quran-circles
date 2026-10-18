import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import { createMemoryStore } from '../storage/storage';
import { MainTabs, mainTabOrder } from './MainTabs';

function renderTabs(
  locale: 'en' | 'ur',
  active: 'index' | 'updates' | 'places' | 'account' = 'index',
) {
  const onChange = vi.fn();
  render(
    <AppearanceProvider
      store={createMemoryStore()}
      initial={{ locale, colorChoice: 'light', textSize: 0 }}
      reduceMotion
    >
      <MainTabs active={active} onChange={onChange} />
    </AppearanceProvider>,
  );
  return onChange;
}

describe('MainTabs', () => {
  it('has the four destinations in order', () => {
    expect(mainTabOrder).toEqual(['index', 'places', 'updates', 'account']);
  });

  it('labels each tab in English and marks the active one', () => {
    renderTabs('en', 'places');
    // Each tab keeps its name for a screen reader; the dock shows icons only (D17), with a dot
    // under the chosen one.
    for (const name of ['Today', 'Updates', 'Places', 'Account']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    expect(screen.queryByText('Places')).toBeNull();
    expect(screen.getByTestId('tab-dot-places')).toBeTruthy();
    for (const g of ['calendar', 'pin', 'bell', 'user']) {
      expect(screen.getAllByTestId(`icon-${g}`).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId('tab-places').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('tab-index').getAttribute('aria-selected')).toBe('false');
  });

  it('labels the tabs in Urdu', () => {
    renderTabs('ur');
    expect(screen.queryByLabelText('Today')).toBeNull();
    expect(screen.getByTestId('main-tabs')).toBeTruthy();
  });

  it('is the navigation landmark of the screen (A-08)', () => {
    renderTabs('en');
    const nav = screen.getByRole('navigation');
    expect(nav.contains(screen.getByTestId('main-tabs'))).toBe(true);
  });

  it('reports the tab that was pressed', () => {
    const onChange = renderTabs('en');
    fireEvent.click(screen.getByTestId('tab-updates'));
    expect(onChange).toHaveBeenCalledWith('updates');
  });
});
