import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapPin, QuranPortion, ScreenHeader, SectionHeader, StarMark, TimeRow } from '../index';
import { semanticColors } from '../semantic-colors';
import { matrix, renderThemed, rgb } from '../test/utils';

describe.each(matrix)('member app parts in $name', (combo) => {
  it('ScreenHeader puts the title in a level-1 heading under the muted line', () => {
    renderThemed(<ScreenHeader meta="Saddar, Karachi" title="Circles near you" />, combo);
    expect(screen.getByRole('heading', { level: 1, name: 'Circles near you' })).toBeTruthy();
    expect(screen.getByText('Saddar, Karachi')).toBeTruthy();
  });

  it('SectionHeader is a level-2 heading with its trailing control', () => {
    renderThemed(<SectionHeader title="Your next session" trailing={<span>more</span>} />, combo);
    expect(screen.getByRole('heading', { level: 2, name: 'Your next session' })).toBeTruthy();
    expect(screen.getByText('more')).toBeTruthy();
  });

  it('QuranPortion shows the label between hairlines and draws the gilt star', () => {
    renderThemed(<QuranPortion testID="p" label="Para 12 · Surah Hud" />, combo);
    expect(screen.getByText('Para 12 · Surah Hud')).toBeTruthy();
    const line = screen.getByTestId('p');
    expect(line.style.borderTopColor).toBe(rgb(semanticColors[combo.mode].hairline));
    const star = line.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(star).toBeTruthy();
  });

  it('StarMark grows with the text size', () => {
    renderThemed(<StarMark testID="s" size={16} />, combo);
    const w = parseFloat(screen.getByTestId('s').style.width);
    expect(w).toBe(Math.round(16 * [1, 1.15, 1.3, 1.5][combo.textSize]!));
  });

  it('TimeRow is one button naming the circle and keeps the time left to right', () => {
    const onPress = vi.fn();
    renderThemed(
      <TimeRow title="Masjid Al-Noor" subtitle="Tonight · Men" time="9:30" onPress={onPress} />,
      combo,
    );
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('9:30').getAttribute('dir')).toBe('ltr');
  });

  it('MapPin shows the time, fills green when chosen and marks a running circle with a dot', () => {
    renderThemed(
      <>
        <MapPin testID="a" time="9:30" selected />
        <MapPin testID="b" time="8:45" now />
      </>,
      combo,
    );
    const c = semanticColors[combo.mode];
    const chosen = screen.getByTestId('a').firstElementChild as HTMLElement;
    expect(chosen.style.backgroundColor).toBe(rgb(c.accent));
    const running = screen.getByTestId('b').firstElementChild as HTMLElement;
    expect(running.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.getByText('8:45').getAttribute('dir')).toBe('ltr');
  });
});
