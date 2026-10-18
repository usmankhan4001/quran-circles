import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ListItem,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Text,
  screenGutter,
  spacing,
} from '@qc/ui';
import { computeDay, PRAYER_NAMES, todayAt, type PrayerPlace } from '../prayer/calc';
import { weekOf } from '../prayer/calendar';
import { addDays, daysInMonth, sameDay, type CivilDate } from '../prayer/civil';
import { hijriDate } from '../prayer/hijri';
import { PAKISTAN_CITIES } from '../prayer/places';
import { shiftMonth } from '../prayer/calendar';
import type { CalendarView } from '../state/viewState';
import { useContent } from './context';
import {
  cityName,
  clockText,
  countdownLine,
  gregorianText,
  hijriText,
  MONTH_KEYS,
  prayerName,
} from './format';
import { useNextPrayer } from './hooks';
import { useContentI18n, type ContentI18n } from './i18n';

export interface PrayerTimesScreenProps {
  /** The chosen city (an id from PAKISTAN_CITIES), or null before the person has chosen. */
  placeId: string | null;
  /** True once the saved choice has been read, so the screen does not flash "choose your city". */
  ready?: boolean;
  onPlaceChange: (id: string) => void;
  calendarView: CalendarView;
  onCalendarViewChange: (view: CalendarView) => void;
  testID?: string;
}

/**
 * Prayer times: the next prayer with a countdown, the Hijri date, today's six times, and a week
 * or month calendar. Everything is calculated on the phone and works with no connection.
 */
export function PrayerTimesScreen({
  placeId,
  ready = true,
  onPlaceChange,
  calendarView,
  onCalendarViewChange,
  testID,
}: PrayerTimesScreenProps) {
  const i18n = useContentI18n();
  const [picking, setPicking] = useState(false);
  const city = PAKISTAN_CITIES.find((c) => c.id === placeId) ?? null;

  const chooser = (
    <Sheet
      visible={picking}
      onClose={() => setPicking(false)}
      title={i18n.t('prayer.noCity.title')}
      testID="city-sheet"
    >
      <View>
        {PAKISTAN_CITIES.map((c) => (
          <ListItem
            key={c.id}
            testID={`city-${c.id}`}
            title={cityName(i18n, c)}
            role="radio"
            checked={c.id === placeId}
            chevron={false}
            divider
            onPress={() => {
              setPicking(false);
              onPlaceChange(c.id);
            }}
          />
        ))}
      </View>
    </Sheet>
  );

  if (!ready) {
    return (
      <View style={{ padding: screenGutter }} testID={testID ? `${testID}-loading` : undefined}>
        <Skeleton shape="block" height={140} announce />
      </View>
    );
  }

  if (!city) {
    return (
      <View style={{ padding: screenGutter }} testID={testID}>
        <EmptyState
          title={i18n.t('prayer.noCity.title')}
          description={i18n.t('prayer.noCity.body')}
          action={{ label: i18n.t('prayer.noCity.action'), onPress: () => setPicking(true) }}
          testID="no-city"
        />
        {chooser}
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      contentContainerStyle={{
        padding: screenGutter,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      }}
    >
      <Select<string>
        label={i18n.t('prayer.place.label')}
        value={city.id}
        options={PAKISTAN_CITIES.map((c) => ({ value: c.id, label: cityName(i18n, c) }))}
        onChange={onPlaceChange}
        testID="city-select"
      />
      <PlaceView
        place={city}
        cityLabel={cityName(i18n, city)}
        calendarView={calendarView}
        onCalendarViewChange={onCalendarViewChange}
        i18n={i18n}
      />
    </ScrollView>
  );
}

function PlaceView({
  place,
  cityLabel,
  calendarView,
  onCalendarViewChange,
  i18n,
}: {
  place: PrayerPlace;
  cityLabel: string;
  calendarView: CalendarView;
  onCalendarViewChange: (view: CalendarView) => void;
  i18n: ContentI18n;
}) {
  const { hijriOffsetDays } = useContent();
  const { next, countdown, now } = useNextPrayer(place);
  const today = todayAt(place, now);
  const dayKey = `${today.year}-${today.month}-${today.day}`;
  // Worked out again only when the calendar day or the place changes, not at every tick.
  const todayTimes = useMemo(() => computeDay(place, today), [place, dayKey]);
  const hijriToday = hijriDate(today, hijriOffsetDays);
  const line = countdownLine(i18n, next.prayer, countdown);

  return (
    <>
      <Card testID="next-prayer-card">
        <Text variant="caption" color="textSecondary">
          {next.tomorrow
            ? `${i18n.t('prayer.next')} · ${i18n.t('prayer.next.tomorrow')}`
            : i18n.t('prayer.next')}
        </Text>
        <View style={{ height: spacing.xs }} />
        <Text variant="title2" heading={2} testID="next-prayer-countdown">
          {line}
        </Text>
        <View style={{ height: spacing.sm }} />
        {hijriToday ? (
          <Text color="textSecondary" testID="hijri-today">
            {`${i18n.t('prayer.hijri')}: ${hijriText(i18n, hijriToday)}`}
          </Text>
        ) : null}
        <Text color="textSecondary" testID="prayer-city">
          {i18n.t('prayer.city', { city: cityLabel })}
        </Text>
      </Card>

      <Card variant="outlined" padding="none">
        <View testID="today-times">
          {PRAYER_NAMES.map((prayer, index) => {
            const isNext = !next.tomorrow && next.prayer === prayer;
            const time = clockText(i18n, todayTimes.times[prayer], place);
            return (
              <ListItem
                key={prayer}
                testID={`time-${prayer}`}
                title={prayerName(i18n, prayer)}
                {...(isNext ? { subtitle: i18n.t('prayer.badge.next'), selected: true } : {})}
                trailing={<Text strong>{time}</Text>}
                accessibilityLabel={`${prayerName(i18n, prayer)}, ${time}${isNext ? `, ${i18n.t('prayer.badge.next')}` : ''}`}
                chevron={false}
                divider={index < PRAYER_NAMES.length - 1}
              />
            );
          })}
        </View>
      </Card>

      <Text variant="caption" color="textSecondary" testID="hijri-note">
        {i18n.t('prayer.hijriNote')}
      </Text>

      <CalendarSection
        place={place}
        today={today}
        view={calendarView}
        onViewChange={onCalendarViewChange}
        hijriOffsetDays={hijriOffsetDays}
        i18n={i18n}
      />

      <Text variant="caption" color="textSecondary" testID="prayer-method">
        {i18n.t('prayer.method')}
      </Text>
    </>
  );
}

function CalendarSection({
  place,
  today,
  view,
  onViewChange,
  hijriOffsetDays,
  i18n,
}: {
  place: PrayerPlace;
  today: CivilDate;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  hijriOffsetDays: number;
  i18n: ContentI18n;
}) {
  const [anchor, setAnchor] = useState<CivilDate>(today);

  const days = useMemo<CivilDate[]>(() => {
    if (view === 'week') return weekOf(anchor);
    return Array.from({ length: daysInMonth(anchor.year, anchor.month) }, (_, i) => ({
      year: anchor.year,
      month: anchor.month,
      day: i + 1,
    }));
  }, [view, anchor]);

  const first = days[0] ?? anchor;
  const last = days[days.length - 1] ?? anchor;
  const title =
    view === 'month'
      ? i18n.t('prayer.calendar.monthTitle', {
          month: i18n.t(MONTH_KEYS[anchor.month - 1] ?? 'prayer.month.1'),
          year: i18n.n(anchor.year),
        })
      : i18n.t('prayer.calendar.weekTitle', {
          from: shortDate(i18n, first),
          to: shortDate(i18n, last),
        });

  const step = (direction: 1 | -1) => {
    if (view === 'week') setAnchor(addDays(anchor, 7 * direction));
    else {
      const { year, month } = shiftMonth(anchor.year, anchor.month, direction);
      setAnchor({ year, month, day: 1 });
    }
  };

  return (
    <View style={{ gap: spacing.md }} testID="prayer-calendar">
      <SegmentedControl<CalendarView>
        accessibilityLabel={i18n.t('prayer.view.label')}
        value={view}
        onChange={(next) => {
          setAnchor(today);
          onViewChange(next);
        }}
        options={[
          { value: 'week', label: i18n.t('prayer.view.week') },
          { value: 'month', label: i18n.t('prayer.view.month') },
        ]}
        testID="calendar-view"
      />
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}
      >
        <Button
          variant="secondary"
          label={
            view === 'week'
              ? i18n.t('prayer.calendar.previousWeek')
              : i18n.t('prayer.calendar.previousMonth')
          }
          onPress={() => step(-1)}
          testID="calendar-previous"
        />
        <Button
          variant="secondary"
          label={
            view === 'week'
              ? i18n.t('prayer.calendar.nextWeek')
              : i18n.t('prayer.calendar.nextMonth')
          }
          onPress={() => step(1)}
          testID="calendar-next"
        />
        <Button
          variant="tertiary"
          label={i18n.t('prayer.calendar.today')}
          onPress={() => setAnchor(today)}
          testID="calendar-today"
        />
      </View>
      <Text variant="title3" heading={2} testID="calendar-title">
        {title}
      </Text>
      <View style={{ gap: spacing.sm }}>
        {days.map((date) => (
          <DayRow
            key={`${date.year}-${date.month}-${date.day}`}
            place={place}
            date={date}
            isToday={sameDay(date, today)}
            hijriOffsetDays={hijriOffsetDays}
            i18n={i18n}
          />
        ))}
      </View>
    </View>
  );
}

const two = (n: number) => String(n).padStart(2, '0');
const dayId = (d: CivilDate) => `day-${d.year}-${two(d.month)}-${two(d.day)}`;

function shortDate(i18n: ContentI18n, date: CivilDate): string {
  return `${i18n.n(date.day)} ${i18n.t(MONTH_KEYS[date.month - 1] ?? 'prayer.month.1')}`;
}

function DayRow({
  place,
  date,
  isToday,
  hijriOffsetDays,
  i18n,
}: {
  place: PrayerPlace;
  date: CivilDate;
  isToday: boolean;
  hijriOffsetDays: number;
  i18n: ContentI18n;
}) {
  const times = useMemo(() => computeDay(place, date), [place, date]);
  const hijri = hijriDate(date, hijriOffsetDays);
  const heading = gregorianText(i18n, date);
  const hijriLabel = hijri ? hijriText(i18n, hijri) : null;
  const rendered = PRAYER_NAMES.map((prayer) => ({
    prayer,
    name: prayerName(i18n, prayer),
    time: clockText(i18n, times.times[prayer], place),
  }));
  const label = [
    hijriLabel ? i18n.t('prayer.calendar.rowLabel', { date: heading, hijri: hijriLabel }) : heading,
    rendered.map((r) => `${r.name} ${r.time}`).join(', '),
    isToday ? i18n.t('prayer.calendar.today') : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Card
      variant={isToday ? 'outlined' : 'flat'}
      padding="md"
      accessibilityLabel={label}
      testID={dayId(date)}
    >
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}
      >
        <Text strong decorative>
          {heading}
        </Text>
        {isToday ? (
          <Text variant="caption" color="textAccent" decorative>
            {i18n.t('prayer.calendar.today')}
          </Text>
        ) : null}
      </View>
      {hijriLabel ? (
        <Text variant="caption" color="textSecondary" decorative>
          {hijriLabel}
        </Text>
      ) : null}
      <View style={{ height: spacing.sm }} />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: spacing.lg,
          rowGap: spacing.sm,
        }}
      >
        {rendered.map((r) => (
          <View key={r.prayer} testID={`${dayId(date)}-${r.prayer}`}>
            <Text variant="caption" color="textSecondary" decorative>
              {r.name}
            </Text>
            <Text decorative>{r.time}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
