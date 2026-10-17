import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { Banner, CodeField, HeroHeader, IconButton, SearchField, Tag } from '../index';
import { semanticColors } from '../semantic-colors';
import { minTouchTarget } from '../tokens';
import { matrix, px, renderThemed, rgb } from '../test/utils';

const ui = (locale: 'en' | 'ur', key: string) =>
  (messages[locale] as Record<string, string>)[key] as string;

describe.each(matrix)('redesign components in $name', (combo) => {
  it('HeroHeader is a green header with a heading, a named back button and its content', () => {
    const onBack = vi.fn();
    renderThemed(
      <HeroHeader
        testID="hero"
        eyebrow="Gulshan · 4 Rabi al-Thani"
        title="Your next circle"
        onBack={onBack}
        actions={<IconButton icon="info" variant="onHero" accessibilityLabel="About" />}
      >
        <span>Dars-e-Quran</span>
      </HeroHeader>,
      combo,
    );
    expect(screen.getByRole('heading', { name: 'Your next circle' })).toBeTruthy();
    expect(screen.getByText('Dars-e-Quran')).toBeTruthy();
    expect(screen.getByTestId('hero').style.backgroundColor).toBe(
      rgb(semanticColors[combo.mode].hero),
    );
    fireEvent.click(screen.getByRole('button', { name: ui(combo.locale, 'ui.back') }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'About' })).toBeTruthy();
  });

  it('SearchField is a named search box with a clear button once something is typed', () => {
    const seen: string[] = [];
    function Controlled() {
      const [q, setQ] = useState('');
      return (
        <SearchField
          accessibilityLabel="Search circles"
          value={q}
          onChangeText={(t) => {
            seen.push(t);
            setQ(t);
          }}
        />
      );
    }
    renderThemed(<Controlled />, combo);
    const box = screen.getByRole('searchbox', { name: 'Search circles' });
    expect(px(getComputedStyle(box).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    const clear = () => screen.queryByRole('button', { name: ui(combo.locale, 'ui.clearSearch') });
    expect(clear()).toBeNull();
    fireEvent.change(box, { target: { value: 'kahf' } });
    expect(seen).toEqual(['kahf']);
    fireEvent.click(clear() as HTMLElement);
    expect(seen).toEqual(['kahf', '']);
    expect(clear()).toBeNull();
  });

  it('CodeField keeps digits only, finishes at six and announces an error', () => {
    const onChangeText = vi.fn();
    const onComplete = vi.fn();
    renderThemed(
      <CodeField
        accessibilityLabel="6-digit code"
        value="12"
        onChangeText={onChangeText}
        onComplete={onComplete}
        error="That code is not right"
      />,
      combo,
    );
    const input = screen.getByLabelText('6-digit code');
    fireEvent.change(input, { target: { value: '12a3' } });
    expect(onChangeText).toHaveBeenLastCalledWith('123');
    fireEvent.change(input, { target: { value: '1234567' } });
    expect(onChangeText).toHaveBeenLastCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(screen.getByRole('alert').textContent).toContain('That code is not right');
  });

  it('Tag shows its label on the colour for its kind', () => {
    renderThemed(<Tag label="Time changed" kind="gilt" testID="tag" />, combo);
    expect(screen.getByText('Time changed')).toBeTruthy();
    expect(screen.getByTestId('tag').style.backgroundColor).toBe(
      rgb(semanticColors[combo.mode].warningSubtle),
    );
  });

  it('Banner announces errors at once and offers its action', () => {
    const onAction = vi.fn();
    renderThemed(
      <Banner kind="error" title="Could not load" actionLabel="Retry" onAction={onAction} />,
      combo,
    );
    expect(screen.getByRole('alert').textContent).toContain('Could not load');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('Banner', () => {
  it('uses a polite status for offline and time changes', () => {
    renderThemed(<Banner kind="offline" title="You are offline" />);
    expect(screen.getByRole('status').textContent).toContain('You are offline');
  });
});
