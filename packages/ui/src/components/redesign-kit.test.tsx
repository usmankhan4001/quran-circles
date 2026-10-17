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

describe('HeroHeader shapes', () => {
  it('draws the eight-point pattern by default and leaves it out on request or in high contrast', () => {
    const { unmount } = renderThemed(<HeroHeader title="Home" />);
    expect(screen.getByTestId('hero-pattern')).toBeTruthy();
    unmount();
    const off = renderThemed(<HeroHeader title="Home" pattern={false} />);
    expect(screen.queryByTestId('hero-pattern')).toBeNull();
    off.unmount();
    renderThemed(<HeroHeader title="Home" />, { mode: 'highContrast' });
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

  it('the chosen tab does not shrink, so its label is not cut', () => {
    renderThemed(<TabBar items={items} activeKey="journey" onChange={() => {}} />);
    const chosen = screen.getByTestId('tab-journey');
    expect(chosen.style.flexShrink).toBe('0');
    expect(chosen.textContent).toBe('My Journey');
    expect(screen.getByTestId('tab-home').style.flexGrow).toBe('1');
  });

  it('a badge sits on the icon, apart from the label, and after the label when there is no icon', () => {
    renderThemed(
      <TabBar
        items={[items[0]!, { key: 'more', label: 'More', badge: { count: 2 } }]}
        activeKey="home"
        onChange={() => {}}
      />,
    );
    const home = screen.getByTestId('tab-home');
    expect(home.getAttribute('aria-label')).toContain('Home');
    // The icon box holds the badge; the label is its sibling, not under the badge.
    const label = screen.getByText('Home');
    expect(label.parentElement?.contains(screen.getByTestId('icon-home'))).toBe(true);
    expect(screen.getByTestId('icon-home').parentElement?.textContent).toBe('1');
    expect(screen.getByTestId('tab-more').textContent).toBe('More2');
  });
});
