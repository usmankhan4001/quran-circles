import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Badge, Button, Card, Chip, ListItem, Sheet, TabBar, Text } from '../index';
import { messages } from '@qc/i18n';
import { semanticColors } from '../semantic-colors';
import { fonts, minTouchTarget, typeStyle } from '../tokens';
import { matrix, px, renderThemed, rgb } from '../test/utils';

describe.each(matrix)('first release in $name', (combo) => {
  const colors = semanticColors[combo.mode];

  it('Text uses the type role, font, line height and colour of the theme', () => {
    renderThemed(<Text variant="body">Sample</Text>, combo);
    const el = screen.getByText('Sample');
    const script = combo.locale === 'ur' ? 'urdu' : 'latin';
    const expected = typeStyle('body', script, combo.textSize);
    expect(px(el.style.fontSize)).toBe(expected.fontSize);
    expect(px(el.style.lineHeight)).toBe(expected.lineHeight);
    expect(el.style.fontFamily).toContain(script === 'urdu' ? fonts.urdu : fonts.sans);
    expect(el.style.color).toBe(rgb(colors.text));
    expect(el.getAttribute('dir')).toBe(combo.direction);
  });

  it('ThemeProvider sets the layout direction', () => {
    const { container } = renderThemed(<Text>x</Text>, combo);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('dir')).toBe(combo.direction);
    expect(root.style.direction).toBe(combo.direction);
    expect(root.style.backgroundColor).toBe(rgb(colors.background));
  });

  it('Button is a labelled button with a 48 dp target and fires onPress', () => {
    const onPress = vi.fn();
    renderThemed(<Button label="Register" onPress={onPress} />, combo);
    const button = screen.getByRole('button', { name: 'Register' });
    expect(px(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Chip toggles and exposes its checked state', () => {
    const onPress = vi.fn();
    renderThemed(<Chip label="Women" selected onPress={onPress} />, combo);
    const chip = screen.getByRole('checkbox', { name: 'Women' });
    expect(chip.getAttribute('aria-checked')).toBe('true');
    expect(px(getComputedStyle(chip).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Card, ListItem, Badge, TabBar render with accessible roles', () => {
    renderThemed(
      <>
        <Card accessibilityLabel="Venue card">
          <Text>Body</Text>
        </Card>
        <ListItem title="Row title" subtitle="Row subtitle" onPress={() => undefined} />
        <Badge count={3} />
        <TabBar
          items={[
            { key: 'a', label: 'One' },
            { key: 'b', label: 'Two', badge: { count: 2 } },
          ]}
          activeKey="a"
          onChange={() => undefined}
        />
      </>,
      combo,
    );
    expect(screen.getByLabelText('Venue card')).toBeTruthy();
    const row = screen.getByRole('button', { name: /Row title/ });
    expect(px(getComputedStyle(row).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    expect(
      screen.getByRole('img', { name: combo.locale === 'ur' ? '3 نئے' : '3 unread' }),
    ).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    for (const tab of tabs) {
      expect(px(getComputedStyle(tab).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    }
  });

  it('Sheet shows a dialog with a close button when visible', () => {
    const onClose = vi.fn();
    renderThemed(
      <Sheet visible onClose={onClose} title="Filters">
        <Text>Inside</Text>
      </Sheet>,
      combo,
    );
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(within(dialog).getByText('Inside')).toBeTruthy();
    const closeName = (messages[combo.locale] as Record<string, string>)['ui.close'] as string;
    fireEvent.click(within(dialog).getByRole('button', { name: closeName }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Text', () => {
  it('sets Quran text in the Quran font, right-to-left, with the tallest line height', () => {
    renderThemed(<Text variant="quran">بسم</Text>, { locale: 'en' });
    const el = screen.getByText('بسم');
    expect(el.style.fontFamily).toContain(fonts.quran);
    expect(el.getAttribute('dir')).toBe('rtl');
    const t = typeStyle('quran', 'quran', 0);
    expect(px(el.style.lineHeight)).toBe(t.lineHeight);
    expect(t.lineHeight / t.fontSize).toBeCloseTo(2.2, 1);
  });

  it('keeps English runs in the Latin face and left-to-right on an Urdu screen', () => {
    renderThemed(<Text lang="en">Dora venue</Text>, { locale: 'ur' });
    const el = screen.getByText('Dora venue');
    expect(el.style.fontFamily).toContain(fonts.sans);
    expect(el.getAttribute('dir')).toBe('ltr');
    expect(el.style.textAlign).toBe('left');
  });

  it('aligns the start of a line to the right in Urdu and to the left in English', () => {
    const { unmount } = renderThemed(<Text>Start</Text>, { locale: 'ur' });
    expect(screen.getByText('Start').style.textAlign).toBe('right');
    unmount();
    renderThemed(<Text>Start</Text>, { locale: 'en' });
    expect(screen.getByText('Start').style.textAlign).toBe('left');
  });

  it('aligns the end of a line opposite to the start', () => {
    renderThemed(<Text align="end">End</Text>, { locale: 'ur' });
    expect(screen.getByText('End').style.textAlign).toBe('left');
  });

  it('lets the first strong character decide with direction auto', () => {
    renderThemed(<Text direction="auto">Mixed</Text>, { locale: 'ur' });
    expect(screen.getByText('Mixed').getAttribute('dir')).toBe('auto');
  });

  it('marks headings, hides decorative text, and never bolds Urdu', () => {
    const { unmount } = renderThemed(
      <>
        <Text heading={2}>Title</Text>
        <Text decorative>Hidden</Text>
        <Text strong>Bold</Text>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Title', level: 2 })).toBeTruthy();
    expect(screen.getByText('Hidden').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Bold').style.fontWeight).toBe('700');
    unmount();
    renderThemed(<Text strong>Bold</Text>, { locale: 'ur' });
    expect(screen.getByText('Bold').style.fontWeight).toBe('400');
  });

  it('truncates when numberOfLines is set', () => {
    renderThemed(<Text numberOfLines={1}>One line</Text>);
    expect(
      screen.getByText('One line').style.webkitLineClamp || screen.getByText('One line').className,
    ).toBeTruthy();
  });
});

describe('Button', () => {
  it('ignores presses while disabled and reports it', () => {
    const onPress = vi.fn();
    renderThemed(<Button label="Save" disabled onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b.getAttribute('aria-disabled')).toBe('true');
  });

  it('ignores presses while loading and reports busy', () => {
    const onPress = vi.fn();
    renderThemed(<Button label="Save" loading onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b.getAttribute('aria-busy')).toBe('true');
  });

  it('does not throw when pressed without a handler', () => {
    renderThemed(<Button label="Nothing" />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Nothing' }))).not.toThrow();
  });

  it('is 56 dp tall for the large size', () => {
    renderThemed(<Button label="Register" size="large" />);
    expect(px(getComputedStyle(screen.getByRole('button')).minHeight)).toBe(56);
  });

  it.each([
    ['primary', 'cta', 'textOnCta'],
    ['emerald', 'accent', 'textOnAccent'],
    ['danger', 'dangerSubtle', 'textOnDangerSubtle'],
  ] as const)('%s uses the %s fill and %s label', (variant, bg, fg) => {
    renderThemed(<Button label="Go" variant={variant} />, { mode: 'dark' });
    const b = screen.getByRole('button');
    expect(b.style.backgroundColor).toBe(rgb(semanticColors.dark[bg]));
    expect(screen.getByText('Go').style.color).toBe(rgb(semanticColors.dark[fg]));
  });

  it('uses the disabled colours when disabled', () => {
    renderThemed(<Button label="Go" disabled />);
    expect(screen.getByRole('button').style.backgroundColor).toBe(
      rgb(semanticColors.light.disabledBackground),
    );
    expect(screen.getByText('Go').style.color).toBe(rgb(semanticColors.light.disabledText));
  });
});

describe('Chip', () => {
  it('is a button, not a toggle, when `selected` is not given', () => {
    renderThemed(<Chip label="Nearby" onPress={() => undefined} />);
    const b = screen.getByRole('button', { name: 'Nearby' });
    expect(b.getAttribute('aria-checked')).toBeNull();
  });

  it('shows a check mark when selected so colour is not the only cue', () => {
    renderThemed(<Chip label="Urdu" selected />);
    expect(screen.getByTestId('icon-check')).toBeTruthy();
  });

  it('has no check mark when not selected', () => {
    renderThemed(<Chip label="Urdu" selected={false} />);
    expect(screen.queryByTestId('icon-check')).toBeNull();
  });

  it('removes through a separately labelled button', () => {
    const onRemove = vi.fn();
    renderThemed(<Chip label="Lahore" selected onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Lahore' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', () => {
    const onPress = vi.fn();
    renderThemed(<Chip label="Off" selected={false} disabled onPress={onPress} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Card', () => {
  it('is a plain container without onPress and a button with it', () => {
    const { unmount } = renderThemed(
      <Card testID="c">
        <Text>Hi</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    const onPress = vi.fn();
    renderThemed(
      <Card onPress={onPress} accessibilityLabel="Open venue">
        <Text>Hi</Text>
      </Card>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open venue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const onPress = vi.fn();
    renderThemed(
      <Card onPress={onPress} disabled accessibilityLabel="Open">
        <Text>Hi</Text>
      </Card>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses a strong border in high contrast', () => {
    renderThemed(
      <Card testID="c" accessibilityLabel="c">
        <Text>Hi</Text>
      </Card>,
      { mode: 'highContrast' },
    );
    expect(screen.getByLabelText('c').style.borderTopColor).toBe(
      rgb(semanticColors.highContrast.borderStrong),
    );
  });
});

describe('ListItem', () => {
  it('is a static row without onPress and has no chevron', () => {
    renderThemed(<ListItem title="Static" />);
    expect(screen.getByText('Static')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('icon-chevron-forward')).toBeNull();
  });

  it('shows a chevron and fires onPress when pressable', () => {
    const onPress = vi.fn();
    renderThemed(<ListItem title="Open" subtitle="Details" onPress={onPress} />);
    expect(screen.getByTestId('icon-chevron-forward')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mirrors the chevron in right-to-left only', () => {
    const { unmount } = renderThemed(<ListItem title="A" onPress={() => undefined} />, {
      locale: 'en',
    });
    expect(screen.getByTestId('icon-chevron-forward').style.transform).toBe('');
    unmount();
    renderThemed(<ListItem title="A" onPress={() => undefined} />, { locale: 'ur' });
    expect(screen.getByTestId('icon-chevron-forward').style.transform).toContain('scaleX(-1)');
  });

  it('does not fire while disabled and can hide the chevron', () => {
    const onPress = vi.fn();
    renderThemed(<ListItem title="Off" disabled chevron={false} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /Off/ }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('icon-chevron-forward')).toBeNull();
  });
});

describe('Badge', () => {
  it('shows nothing for zero, no count and no dot', () => {
    const { container } = renderThemed(
      <>
        <Badge count={0} />
        <Badge />
      </>,
    );
    expect(container.querySelector('[data-testid^="badge"]')).toBeNull();
  });

  it('shows a dot with the words "New updates"', () => {
    renderThemed(<Badge dot />);
    expect(screen.getByRole('img', { name: 'New updates' })).toBeTruthy();
  });

  it('caps large counts', () => {
    renderThemed(<Badge count={250} />);
    expect(screen.getByRole('img', { name: '250 unread' })).toBeTruthy();
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('can be decorative so a parent announces it', () => {
    renderThemed(<Badge count={4} decorative />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('TabBar', () => {
  it('reports the change and folds the badge into the tab name', () => {
    const onChange = vi.fn();
    renderThemed(
      <TabBar
        accessibilityLabel="Main menu"
        items={[
          { key: 'home', label: 'Home', badge: { count: 5 } },
          { key: 'nearby', label: 'Nearby' },
        ]}
        activeKey="home"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tablist', { name: 'Main menu' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Home, 5 unread' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Nearby' }));
    expect(onChange).toHaveBeenCalledWith('nearby');
  });

  it('renders an icon from a function with the selected state', () => {
    const icon = vi.fn(({ selected }: { selected: boolean }) => (
      <Text>{selected ? 'on' : 'off'}</Text>
    ));
    renderThemed(
      <TabBar
        items={[
          { key: 'a', label: 'A', icon },
          { key: 'b', label: 'B', icon },
        ]}
        activeKey="b"
        onChange={() => undefined}
      />,
    );
    expect(icon).toHaveBeenCalledWith(expect.objectContaining({ selected: true }));
    expect(icon).toHaveBeenCalledWith(expect.objectContaining({ selected: false }));
  });

  it('renders an empty bar without throwing', () => {
    expect(() =>
      renderThemed(<TabBar items={[]} activeKey="" onChange={() => undefined} />),
    ).not.toThrow();
  });
});

describe('Sheet', () => {
  it('renders nothing when hidden', () => {
    renderThemed(
      <Sheet visible={false} onClose={() => undefined} title="Hidden">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes from the backdrop', () => {
    const onClose = vi.fn();
    renderThemed(
      <Sheet visible onClose={onClose} title="T" testID="sheet">
        <Text>Body</Text>
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom close label', () => {
    renderThemed(
      <Sheet visible onClose={() => undefined} title="T" closeLabel="Done">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
