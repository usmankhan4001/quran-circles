import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderScreen } from '../test/harness';
import { ChoiceCards } from './ChoiceCards';
import { GlassButton } from './GlassButton';
import { Glyph, type GlyphName } from './Glyph';
import { MapPreviewCard } from './MapPreviewCard';
import { PhotoBlock } from './PhotoBlock';
import { SearchButton } from './SearchButton';
import { PictureCard } from './PictureCard';
import { Stepper } from './Stepper';
import { tabIcon } from './tabIcons';

const GLYPHS: GlyphName[] = [
  'home',
  'pin',
  'book',
  'calendar',
  'search',
  'clock',
  'bell',
  'people',
  'route',
  'prayer',
  'filter',
  'user',
];

describe('Stepper', () => {
  function stepper(value: number, onChange: (n: number) => void) {
    return (
      <Stepper
        label="People"
        value={value}
        min={1}
        max={3}
        onChange={onChange}
        decreaseLabel="Fewer"
        increaseLabel="More"
        locale="en"
        testID="party"
      />
    );
  }

  it('counts up and down inside its limits', async () => {
    const onChange = vi.fn();
    const view = await renderScreen(stepper(2, onChange));
    fireEvent.click(view.getByTestId('party-plus'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(view.getByTestId('party-minus'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('turns the minus off at the lowest number and the plus off at the highest', async () => {
    const onChange = vi.fn();
    const low = await renderScreen(stepper(1, onChange));
    expect(low.getByTestId('party-minus').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(low.getByTestId('party-minus'));
    expect(onChange).not.toHaveBeenCalled();
    low.unmount();
    const high = await renderScreen(stepper(3, onChange));
    expect(high.getByTestId('party-plus').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(high.getByTestId('party-plus'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('names its buttons and shows the number', async () => {
    const view = await renderScreen(stepper(2, vi.fn()));
    expect(view.getByTestId('party-minus').getAttribute('aria-label')).toBe('Fewer');
    expect(view.getByTestId('party-plus').getAttribute('aria-label')).toBe('More');
    expect(view.getByTestId('party-value').textContent).toBe('2');
  });
});

describe('ChoiceCards', () => {
  const options = [
    { value: 'women', label: 'Women' },
    { value: 'men', label: 'Men', disabled: true },
    { value: 'family', label: 'Family' },
  ] as const;

  it('is a group of radios, one chosen', async () => {
    const view = await renderScreen(
      <ChoiceCards
        options={options}
        value="family"
        onChange={vi.fn()}
        accessibilityLabel="Section"
        testID="sec"
      />,
    );
    expect(view.getByRole('radiogroup').getAttribute('aria-label')).toBe('Section');
    expect(view.getByTestId('sec-family').getAttribute('aria-checked')).toBe('true');
    expect(view.getByTestId('sec-women').getAttribute('aria-checked')).toBe('false');
  });

  it('lets the person choose an offered card but not a faded one', async () => {
    const onChange = vi.fn();
    const view = await renderScreen(
      <ChoiceCards
        options={options}
        value={null}
        onChange={onChange}
        accessibilityLabel="Section"
        testID="sec"
      />,
    );
    fireEvent.click(view.getByTestId('sec-women'));
    expect(onChange).toHaveBeenCalledWith('women');
    onChange.mockClear();
    expect(view.getByTestId('sec-men').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(view.getByTestId('sec-men'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('small pieces', () => {
  it('PictureCard names itself from its words and opens on press', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <PictureCard
        title="Masjid Al-Noor"
        caption="Tonight 9:00 pm"
        onPress={onPress}
        testID="pic"
      />,
    );
    expect(view.getByTestId('pic').getAttribute('aria-label')).toBe(
      'Masjid Al-Noor, Tonight 9:00 pm',
    );
    fireEvent.click(view.getByTestId('pic'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('MapPreviewCard marks the places and opens the map on press', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <MapPreviewCard
        pins={3}
        title="3 circles near you"
        caption="Open the map"
        onPress={onPress}
        testID="map"
      />,
    );
    expect(view.getAllByTestId('glyph-pin')).toHaveLength(3);
    fireEvent.click(view.getByTestId('map'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('SearchButton opens the search elsewhere when pressed', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <SearchButton label="Search" placeholder="Search by area" onPress={onPress} testID="s" />,
    );
    expect(view.getByTestId('s').getAttribute('aria-label')).toBe('Search. Search by area');
    fireEvent.click(view.getByTestId('s'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('GlassButton shows an unread count and names itself', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <GlassButton
        glyph="bell"
        accessibilityLabel="Updates"
        count={3}
        onPress={onPress}
        testID="bell"
      />,
    );
    expect(view.getByTestId('bell').getAttribute('aria-label')).toBe('Updates');
    expect(view.getByTestId('badge-count')).toBeTruthy();
    fireEvent.click(view.getByTestId('bell'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('PhotoBlock is decoration and shows a mark when there is no photo', async () => {
    const view = await renderScreen(<PhotoBlock testID="photo" />);
    expect(view.getByTestId('photo').getAttribute('aria-hidden')).toBe('true');
    expect(view.getByTestId('glyph-home')).toBeTruthy();
  });

  it.each(GLYPHS)('Glyph %s draws and hides from screen readers', async (name) => {
    const view = await renderScreen(<Glyph name={name} />);
    expect(view.getByTestId(`glyph-${name}`).getAttribute('aria-hidden')).toBe('true');
  });

  it('every tab has an icon', async () => {
    for (const key of ['home', 'nearby', 'quran', 'journey'] as const) {
      const icon = tabIcon(key);
      expect(typeof icon).toBe('function');
    }
  });
});

describe('screen code', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it('uses theme colours only: no hex or rgb colours in screens, components or the local kit pieces', () => {
    const root = join(__dirname, '..');
    const files = ['screens', 'components', 'ui'].flatMap((d) => sourceFiles(join(root, d)));
    expect(files.length).toBeGreaterThan(10);
    const raw = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    const offenders = files.filter((f) => raw.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
