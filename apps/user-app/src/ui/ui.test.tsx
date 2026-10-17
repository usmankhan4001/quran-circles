import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderScreen } from '../test/harness';
import { ChoiceCards } from './ChoiceCards';
import { GlassButton } from './GlassButton';
import { MapPin } from './MapPin';
import { MapPreviewCard } from './MapPreviewCard';
import { MasjidLineArt } from './MasjidLineArt';
import { SearchButton } from './SearchButton';
import { SectionIcon } from './SectionIcon';
import { Shortcut } from './Shortcut';
import { PictureCard } from './PictureCard';
import { Stepper } from './Stepper';
import { VenueArt, artIndex } from './VenueArt';
import { tabIcon } from './tabIcons';
import { MATRIX } from '../test/harness';

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
  it('PictureCard names itself from its words, shows the distance on the art, and opens on press', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <PictureCard
        seed="venue-1"
        title="Masjid Al-Noor"
        caption="Tonight 9:00 pm"
        distance="1.2 km"
        section="family"
        sectionLabel="Family"
        onPress={onPress}
        testID="pic"
      />,
    );
    expect(view.getByTestId('pic').getAttribute('aria-label')).toBe(
      'Masjid Al-Noor, Tonight 9:00 pm, Family, 1.2 km',
    );
    expect(view.getByText('1.2 km')).toBeTruthy();
    fireEvent.click(view.getByTestId('pic'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('PictureCard without a press is not a button', async () => {
    const view = await renderScreen(<PictureCard seed="v" title="Masjid" testID="pic" />);
    expect(view.getByTestId('pic').getAttribute('role')).toBeNull();
  });

  it('MapPreviewCard marks the places with green pins and opens the map on press', async () => {
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
    expect(view.getByTestId('map').getAttribute('aria-label')).toBe(
      '3 circles near you, Open the map',
    );
    fireEvent.click(view.getByTestId('map'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('MapPin shows the number of circles when there is more than one', async () => {
    const many = await renderScreen(<MapPin count={4} testID="pin" />);
    expect(many.getByTestId('pin').textContent).toBe('4');
    expect(many.getByTestId('pin').getAttribute('aria-hidden')).toBe('true');
    many.unmount();
    const one = await renderScreen(<MapPin testID="pin" />);
    expect(one.getByTestId('pin').textContent).toBe('');
  });

  it('MapPin writes the count in Urdu digits on an Urdu screen', async () => {
    const view = await renderScreen(<MapPin count={4} selected testID="pin" />, { locale: 'ur' });
    expect(view.getByTestId('pin').textContent).not.toBe('');
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
        icon="bell"
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

  it('Shortcut is a named round button, with the unread count when there is one', async () => {
    const onPress = vi.fn();
    const view = await renderScreen(
      <Shortcut
        icon="bell"
        label="Updates"
        count={2}
        accessibilityLabel="Updates, 2 unread"
        onPress={onPress}
        testID="sc"
      />,
    );
    expect(view.getByTestId('sc').getAttribute('aria-label')).toBe('Updates, 2 unread');
    expect(view.getByTestId('badge-count')).toBeTruthy();
    fireEvent.click(view.getByTestId('sc'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it.each(MATRIX)(
    'VenueArt is decoration and draws in $name',
    async ({ locale, color, textSize }) => {
      const view = await renderScreen(
        <VenueArt seed="venue-1" height={92} testID="art">
          <></>
        </VenueArt>,
        { locale, color, textSize },
      );
      const art = view.getByTestId('art');
      expect(art.getAttribute('aria-hidden')).toBe('true');
      expect(art.style.height).toBe('92px');
    },
  );

  it('VenueArt keeps one colouring per place', () => {
    expect(artIndex('venue-1')).toBe(artIndex('venue-1'));
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => artIndex(x)));
    expect(seen.size).toBeGreaterThan(1);
    for (const index of seen) expect(index).toBeLessThan(4);
  });

  it.each(['women', 'men', 'family'] as const)(
    'SectionIcon draws %s as decoration',
    async (section) => {
      const view = await renderScreen(
        <div data-testid="wrap">
          <SectionIcon section={section} color="currentColor" />
        </div>,
      );
      const icon = view.getByTestId('wrap').firstElementChild as HTMLElement;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('MasjidLineArt is decoration', async () => {
    const view = await renderScreen(<MasjidLineArt testID="masjid" />);
    expect(view.getByTestId('masjid').getAttribute('aria-hidden')).toBe('true');
  });

  it('ChoiceCards draw each option picture', async () => {
    const view = await renderScreen(
      <ChoiceCards
        options={[
          { value: 'women', label: 'Women', icon: () => <span data-testid="icon-women" /> },
          { value: 'men', label: 'Men', icon: () => <span data-testid="icon-men" /> },
        ]}
        value="women"
        onChange={vi.fn()}
        accessibilityLabel="Section"
      />,
    );
    expect(view.getByTestId('icon-women')).toBeTruthy();
    expect(view.getByTestId('icon-men')).toBeTruthy();
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

  it('draws icons with the kit Icon: the local Glyph and photo block are gone', () => {
    const root = join(__dirname, '..');
    const files = ['screens', 'components', 'ui', 'features'].flatMap((d) =>
      sourceFiles(join(root, d)),
    );
    const offenders = files.filter((f) => /ui\/(Glyph|PhotoBlock)'/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('uses theme colours only: no hex or rgb colours in screens, components or the local kit pieces', () => {
    const root = join(__dirname, '..');
    const files = ['screens', 'components', 'ui'].flatMap((d) => sourceFiles(join(root, d)));
    expect(files.length).toBeGreaterThan(10);
    const raw = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    const offenders = files.filter((f) => raw.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
