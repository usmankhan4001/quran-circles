import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import {
  Banner,
  CodeField,
  ConfirmSheet,
  DateStrip,
  HeroHeader,
  IconButton,
  PrayerStrip,
  SearchField,
  SeatMeter,
  SessionCard,
  StarNumber,
  TabBar,
  Tag,
  Icon,
  iconNames,
  phosphorSlugs,
  resolveIcon,
} from '../index';
import { formatNumber } from '../numerals';
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

  it('SeatMeter says the places left and exposes the fill to screen readers', () => {
    renderThemed(<SeatMeter taken={21} capacity={30} />, combo);
    const meter = screen.getByRole('progressbar');
    expect(meter.getAttribute('aria-valuenow')).toBe('21');
    expect(meter.getAttribute('aria-valuemax')).toBe('30');
    expect(meter.getAttribute('aria-label')).toBe(
      ui(combo.locale, 'ui.seatsLeft').replace('{count}', combo.locale === 'ur' ? '9' : '9'),
    );
  });

  it('DateStrip is a radio group whose chosen day fills green', () => {
    const onChange = vi.fn();
    renderThemed(
      <DateStrip
        accessibilityLabel="Day"
        value="fri"
        onChange={onChange}
        days={[
          { key: 'thu', weekday: 'Thu', day: '29', accessibilityLabel: 'Thursday 29 October' },
          { key: 'fri', weekday: 'Fri', day: '30', accessibilityLabel: 'Friday 30 October' },
          {
            key: 'sat',
            weekday: 'Sat',
            day: '31',
            accessibilityLabel: 'Saturday 31 October',
            disabled: true,
          },
        ]}
      />,
      combo,
    );
    const fri = screen.getByRole('radio', { name: 'Friday 30 October' });
    expect(fri.getAttribute('aria-checked')).toBe('true');
    expect(px(getComputedStyle(fri).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(screen.getByRole('radio', { name: 'Thursday 29 October' }));
    expect(onChange).toHaveBeenCalledWith('thu');
    fireEvent.click(screen.getByRole('radio', { name: 'Saturday 31 October' }));
    expect(onChange).not.toHaveBeenCalledWith('sat');
  });

  it('PrayerStrip names the next prayer for screen readers', () => {
    renderThemed(
      <PrayerStrip
        nextLabel="Next"
        nextKey="asr"
        prayers={[
          { key: 'fajr', name: 'Fajr', time: '5:12' },
          { key: 'asr', name: 'Asr', time: '3:52' },
        ]}
      />,
      combo,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Next: Asr 3:52')).toBeTruthy();
  });

  it('SessionCard is one button that reads the whole session', () => {
    const onPress = vi.fn();
    renderThemed(
      <SessionCard
        title="Dars-e-Quran"
        place="Masjid Al-Noor · 1.2 km"
        day="Friday"
        time="7:30 pm"
        tag={{ label: 'Time changed', kind: 'gilt' }}
        seats={{ taken: 30, capacity: 30 }}
        onPress={onPress}
      />,
      combo,
    );
    const card = screen.getByRole('button', {
      name: 'Dars-e-Quran, Masjid Al-Noor · 1.2 km, Friday 7:30 pm',
    });
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText(ui(combo.locale, 'ui.seatsFull'))).toBeTruthy();
  });

  it('ConfirmSheet asks before a destructive action and can be kept', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderThemed(
      <ConfirmSheet
        visible
        destructive
        title="Cancel this session?"
        message="Registered people will be told."
        confirmLabel="Yes, cancel session"
        cancelLabel="Keep the session"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
      combo,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep the session' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel session' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('SeatMeter', () => {
  it('says when a session is full, has one place, or has no limit', () => {
    const { unmount } = renderThemed(<SeatMeter taken={30} capacity={30} />);
    expect(screen.getByText('Full')).toBeTruthy();
    unmount();
    const one = renderThemed(<SeatMeter taken={29} capacity={30} />);
    expect(screen.getByText('1 place left')).toBeTruthy();
    one.unmount();
    renderThemed(<SeatMeter taken={12} capacity={null} />);
    expect(screen.getByText('No limit on places')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('Banner', () => {
  it('uses a polite status for offline and time changes', () => {
    renderThemed(<Banner kind="offline" title="You are offline" />);
    expect(screen.getByRole('status').textContent).toContain('You are offline');
  });
});

describe.each(matrix)('drawing details in $name', (combo) => {
  it('StarNumber shows the number in the locale numerals and can be named', () => {
    renderThemed(<StarNumber value={18} accessibilityLabel="Surah 18" />, combo);
    expect(screen.getByRole('img', { name: 'Surah 18' })).toBeTruthy();
    expect(screen.getByText(formatNumber(18, combo.locale))).toBeTruthy();
  });

  it('every kit icon draws something and hides from screen readers without a label', () => {
    for (const name of iconNames) {
      const { unmount } = renderThemed(<Icon name={name} />, combo);
      const el = screen.getByTestId(`icon-${name}`);
      expect(el.childElementCount, name).toBeGreaterThan(0);
      expect(el.getAttribute('aria-hidden'), name).toBe('true');
      unmount();
    }
  });
});

describe('style guide icons (D17)', () => {
  const added = [
    'arrow-forward',
    'arrow-back',
    'masjid',
    'compass',
    'ticket',
    'qr',
    'phone',
    'minus',
    'sun',
    'sliders',
    'play',
    'check-circle',
  ] as const;

  it('are part of the kit set and each draws something', () => {
    for (const name of added) {
      expect(iconNames, name).toContain(name);
      const { unmount } = renderThemed(<Icon name={name} accessibilityLabel={name} />);
      expect(screen.getByRole('img', { name }).childElementCount, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('mirror the arrows in right to left and leave the objects alone', () => {
    for (const name of added) {
      const { unmount } = renderThemed(<Icon name={name} />, { locale: 'ur' });
      const flipped = screen.getByTestId(`icon-${name}`).style.transform.includes('scaleX(-1)');
      expect(flipped, name).toBe(name === 'arrow-forward' || name === 'arrow-back');
      unmount();
    }
    const { unmount } = renderThemed(<Icon name="arrow-forward" />, { locale: 'en' });
    expect(screen.getByTestId('icon-arrow-forward').style.transform).not.toContain('scaleX(-1)');
    unmount();
  });
});

describe('Phosphor icons (D17)', () => {
  const paths = (name: string) =>
    [...screen.getByTestId(`icon-${name}`).querySelectorAll('path')].map((p) => ({
      d: p.getAttribute('d'),
      opacity: p.getAttribute('opacity'),
    }));

  it('draws the showcase names from the Phosphor set', () => {
    for (const name of [
      'house',
      'compass',
      'book-open-text',
      'mosque',
      'ticket',
      'qr-code',
    ] as const) {
      expect(phosphorSlugs, name).toContain(name);
      const { unmount } = renderThemed(<Icon name={name} />);
      expect(paths(name).length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('draws each kit name as its Phosphor glyph', () => {
    const { unmount } = renderThemed(<Icon name="home" />);
    const home = paths('home');
    unmount();
    renderThemed(<Icon name="house" />);
    expect(paths('house')).toEqual(home);
    expect(resolveIcon('chevron-forward')).toEqual({ slug: 'caret-right', weight: 'bold' });
    expect(resolveIcon('masjid', 'duotone')).toEqual({ slug: 'mosque', weight: 'duotone' });
  });

  it('switches weight: fill differs from regular, duotone adds a faint back layer', () => {
    const drawn = (weight: 'regular' | 'fill' | 'duotone') => {
      const { unmount } = renderThemed(<Icon name="house" weight={weight} />);
      const out = paths('house');
      unmount();
      return out;
    };
    const regular = drawn('regular');
    expect(drawn('fill')).not.toEqual(regular);
    const duo = drawn('duotone');
    expect(duo.some((p) => p.opacity === '0.2')).toBe(true);
    expect(duo.filter((p) => p.opacity === null).map((p) => p.d)).toEqual(regular.map((p) => p.d));
  });

  it('paints in the given colour, and mirrors the Phosphor arrows in right to left', () => {
    renderThemed(<Icon name="caret-right" color="rgb(1, 2, 3)" />, { locale: 'ur' });
    const box = screen.getByTestId('icon-caret-right');
    expect(box.querySelector('svg')?.style.color).toBe('rgb(1, 2, 3)');
    expect(box.style.transform).toContain('scaleX(-1)');
  });
});

describe('HeroHeader shapes', () => {
  it('draws the eight-point pattern only on request (D17), and never in high contrast', () => {
    const { unmount } = renderThemed(<HeroHeader title="Home" pattern />);
    expect(screen.getByTestId('hero-pattern')).toBeTruthy();
    unmount();
    const off = renderThemed(<HeroHeader title="Home" />);
    expect(screen.queryByTestId('hero-pattern')).toBeNull();
    off.unmount();
    renderThemed(<HeroHeader title="Home" pattern />, { mode: 'highContrast' });
    expect(screen.queryByTestId('hero-pattern')).toBeNull();
  });

  it('fades into the page on the web, and rounds its lower corners when asked', () => {
    const { unmount } = renderThemed(<HeroHeader testID="hero" title="Home" />);
    expect(screen.getByTestId('hero').style.backgroundImage).toContain('linear-gradient');
    unmount();
    renderThemed(<HeroHeader testID="hero" title="Home" shape="rounded" />);
    const hero = screen.getByTestId('hero');
    expect(hero.style.backgroundImage).toBe('');
    expect(
      px(hero.style.borderBottomLeftRadius) + px(hero.style.borderBottomRightRadius),
    ).toBeGreaterThan(0);
  });
});

describe('TabBar sizing', () => {
  const items = [
    { key: 'home', label: 'Home', icon: <Icon name="home" />, badge: { count: 1 } },
    { key: 'journey', label: 'My Journey', icon: <Icon name="route" /> },
    { key: 'more', label: 'More' },
  ];

  it('shares the width equally between tabs (D17)', () => {
    renderThemed(<TabBar items={items} activeKey="journey" onChange={() => {}} />);
    for (const key of ['home', 'journey', 'more'])
      expect(screen.getByTestId(`tab-${key}`).style.flexGrow).toBe('1');
    expect(screen.getByTestId('tab-journey').getAttribute('aria-label')).toBe('My Journey');
  });

  it('a badge sits on the icon, and after the label when there is no icon', () => {
    renderThemed(
      <TabBar
        items={[items[0]!, { key: 'more', label: 'More', badge: { count: 2 } }]}
        activeKey="home"
        onChange={() => {}}
      />,
    );
    const home = screen.getByTestId('tab-home');
    expect(home.getAttribute('aria-label')).toContain('Home');
    expect(screen.getByTestId('icon-home').parentElement?.textContent).toBe('1');
    expect(screen.getByTestId('tab-more').textContent).toBe('More2');
  });
});
