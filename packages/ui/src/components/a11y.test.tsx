import axe from 'axe-core';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  CodeField,
  DateStrip,
  EmptyState,
  ErrorState,
  Header,
  HeroHeader,
  IconButton,
  ListItem,
  PrayerStrip,
  SearchField,
  SeatMeter,
  SessionCard,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  TabBar,
  Tag,
  Text,
  TextField,
  Toast,
} from '../index';
import { SheetPanel } from './Sheet';
import { matrix, renderThemed } from '../test/utils';

const noop = () => undefined;

/** A screen-like page with every component, so axe sees them together. */
function Everything() {
  return (
    <main>
      <Header
        title="Nearby"
        subtitle="Lahore"
        onBack={noop}
        actions={<IconButton icon="plus" accessibilityLabel="Add" />}
      />
      <HeroHeader eyebrow="Gulshan" title="Your next circle" onBack={noop}>
        <Tag label="Seats left" />
      </HeroHeader>
      <Banner kind="change" title="Time changed" actionLabel="View" onAction={noop} />
      <SearchField accessibilityLabel="Search circles" value="kahf" onChangeText={noop} />
      <CodeField accessibilityLabel="6-digit code" value="12" onChangeText={noop} />
      <DateStrip
        accessibilityLabel="Day"
        value="fri"
        onChange={noop}
        days={[
          { key: 'thu', weekday: 'Thu', day: '29', accessibilityLabel: 'Thursday 29' },
          { key: 'fri', weekday: 'Fri', day: '30', accessibilityLabel: 'Friday 30' },
        ]}
      />
      <PrayerStrip
        nextLabel="Next"
        nextKey="asr"
        prayers={[
          { key: 'fajr', name: 'Fajr', time: '5:12' },
          { key: 'asr', name: 'Asr', time: '3:52' },
        ]}
      />
      <SessionCard
        title="Dars-e-Quran"
        place="Masjid Al-Noor"
        time="7:30 pm"
        seats={{ taken: 21, capacity: 30 }}
        onPress={noop}
      />
      <SeatMeter taken={3} capacity={10} />
      <Text heading={2} variant="title2">
        Section
      </Text>
      <Button label="Register" onPress={noop} />
      <Button label="Saving" loading onPress={noop} />
      <Button label="Disabled" disabled onPress={noop} />
      <TextField label="Full name" value="" onChangeText={noop} required error="Enter your name." />
      <TextField label="Notes" value="" onChangeText={noop} helper="Optional notes." multiline />
      <Select
        label="Section"
        value="men"
        onChange={noop}
        options={[
          { value: 'men', label: 'Men' },
          { value: 'women', label: 'Women' },
        ]}
      />
      <Switch label="Dark mode" value onValueChange={noop} />
      <SegmentedControl
        accessibilityLabel="Language"
        value="en"
        onChange={noop}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ur', label: 'Urdu' },
        ]}
      />
      <Checkbox label="Parking" checked onChange={noop} />
      <Checkbox label="Wudu area" checked={false} onChange={noop} />
      <Chip label="Women" selected onPress={noop} />
      <Chip label="Lahore" selected onRemove={noop} onPress={noop} />
      <Card>
        <Text>Plain card</Text>
      </Card>
      <Card onPress={noop} accessibilityLabel="Open venue">
        <Text>Pressable card</Text>
      </Card>
      <div>
        <ListItem title="Static row" />
        <ListItem
          title="Pressable row"
          subtitle="Subtitle"
          leading={<Avatar name="Amina Khan" />}
          trailing={<Badge count={4} />}
          onPress={noop}
        />
      </div>
      <Skeleton lines={2} />
      <EmptyState
        title="Nothing here"
        description="Add one."
        action={{ label: 'Add', onPress: noop }}
      />
      <ErrorState onRetry={noop} />
      <Toast kind="success" message="Saved" onDismiss={noop} durationMs={0} />
      <SheetPanel title="Choose" onClose={noop}>
        <Text>Inside</Text>
      </SheetPanel>
      <TabBar
        accessibilityLabel="Main menu"
        activeKey="a"
        onChange={noop}
        items={[
          { key: 'a', label: 'Home', badge: { dot: true } },
          { key: 'b', label: 'Nearby' },
        ]}
      />
    </main>
  );
}

describe.each(matrix.filter((c) => c.textSize === 0 || c.textSize === 3))(
  'axe in $name',
  (combo) => {
    it(
      'finds no accessibility violations in the full kit',
      async () => {
        const { container } = renderThemed(<Everything />, combo);
        expect(screen.getAllByRole('button').length).toBeGreaterThan(10);
        // Colour contrast needs real layout and painting, which jsdom lacks. It is proved from the
        // token pairs in tokens.test.ts instead.
        const results = await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        });
        const summary = results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`,
        );
        expect(summary).toEqual([]);
      },
      20000,
    );
  },
);

describe('axe with an open sheet', () => {
  it('finds no violations in an open Select', async () => {
    const { getByRole } = renderThemed(
      <Select
        label="Area"
        value="a"
        onChange={noop}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Bravo' },
        ]}
      />,
    );
    getByRole('button', { name: /Area/ }).click();
    await screen.findByRole('dialog');
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`,
      ),
    ).toEqual([]);
  });
});
