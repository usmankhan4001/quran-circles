/**
 * Static catalog of the component kit. Run it with `pnpm --filter @qc/ui catalog`.
 * Strings here are catalog fixtures, not product copy.
 */
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRegistry } from 'react-native';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  CodeField,
  EmptyState,
  ErrorState,
  Header,
  HeroHeader,
  Icon,
  IconButton,
  ListItem,
  SearchField,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  TabBar,
  Tag,
  Text,
  TextField,
  ThemeProvider,
  Toast,
  colorModes,
  contrastPairs,
  contrastRatio,
  fonts,
  iconNames,
  isolate,
  lineHeightRatio,
  minTouchTarget,
  radii,
  semanticColors,
  spacing,
  textScale,
  textSizeSteps,
  typeRoles,
  typeStyle,
  type ColorMode,
  type Locale,
  type TextSizeStep,
  type TypeRole,
} from '../src/index';
import { SheetPanel } from '../src/components/Sheet';

type Fixture = (locale: Locale) => ReactNode;
interface Story {
  id: string;
  title: string;
  note?: string;
  cases: { label: string; render: Fixture }[];
}

const pick = <T,>(locale: Locale, en: T, ur: T): T => (locale === 'ur' ? ur : en);
const noop = () => undefined;

const stories: Story[] = [
  {
    id: 'text',
    title: 'Text',
    note: 'The only way to show text. Urdu uses Jameel Noori Nastaleeq with a taller line height; Quran text uses KFGQPC Uthmanic Hafs and is always right to left.',
    cases: [
      ...(
        [
          'display',
          'title1',
          'title2',
          'title3',
          'bodyLarge',
          'body',
          'label',
          'caption',
        ] as TypeRole[]
      ).map((role) => ({
        label: `Variant: ${role}`,
        render: (l: Locale) => (
          <Text variant={role}>
            {pick(l, 'The next session is on Friday', 'اگلی نشست جمعہ کو ہے')}
          </Text>
        ),
      })),
      {
        label: 'Variant: quran',
        render: () => <Text variant="quran">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>,
      },
      {
        label: 'Mixed direction: an English venue name inside Urdu',
        render: (l) => (
          <Text>
            {pick(
              l,
              `Join us at ${isolate('Al-Noor Masjid')} in Lahore`,
              `${isolate('Al-Noor Masjid')} لاہور میں ہمارے ساتھ شامل ہوں`,
            )}
          </Text>
        ),
      },
      {
        label: 'Colours: secondary, muted, accent, danger, success, warning',
        render: (l) => (
          <>
            <Text color="textSecondary">{pick(l, 'Secondary text', 'ثانوی متن')}</Text>
            <Text color="textMuted">{pick(l, 'Muted text', 'مدھم متن')}</Text>
            <Text color="textAccent">{pick(l, 'Accent text', 'نمایاں متن')}</Text>
            <Text color="textDanger">{pick(l, 'Danger text', 'خطرے کا متن')}</Text>
            <Text color="textSuccess">{pick(l, 'Success text', 'کامیابی کا متن')}</Text>
            <Text color="textWarning">{pick(l, 'Warning text', 'انتباہ کا متن')}</Text>
          </>
        ),
      },
    ],
  },
  {
    id: 'button',
    title: 'Button',
    cases: [
      {
        label: 'Primary',
        render: (l) => <Button label={pick(l, 'Register', 'رجسٹر کریں')} onPress={noop} />,
      },
      {
        label: 'Secondary',
        render: (l) => (
          <Button
            variant="secondary"
            label={pick(l, 'See details', 'تفصیل دیکھیں')}
            onPress={noop}
          />
        ),
      },
      {
        label: 'Tertiary',
        render: (l) => (
          <Button variant="tertiary" label={pick(l, 'Not now', 'ابھی نہیں')} onPress={noop} />
        ),
      },
      {
        label: 'Danger',
        render: (l) => (
          <Button
            variant="danger"
            label={pick(l, 'Delete account', 'اکاؤنٹ حذف کریں')}
            onPress={noop}
          />
        ),
      },
      {
        label: 'Large, full width (key action)',
        render: (l) => (
          <Button
            size="large"
            fullWidth
            label={pick(l, 'Register for this session', 'اس نشست کے لیے رجسٹر کریں')}
            onPress={noop}
          />
        ),
      },
      {
        label: 'With icon',
        render: (l) => <Button icon="plus" label={pick(l, 'Add', 'شامل کریں')} onPress={noop} />,
      },
      {
        label: 'Loading',
        render: (l) => (
          <Button loading label={pick(l, 'Saving', 'محفوظ ہو رہا ہے')} onPress={noop} />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => <Button disabled label={pick(l, 'Register', 'رجسٹر کریں')} onPress={noop} />,
      },
      {
        label: 'Disabled secondary',
        render: (l) => (
          <Button
            disabled
            variant="secondary"
            label={pick(l, 'See details', 'تفصیل دیکھیں')}
            onPress={noop}
          />
        ),
      },
    ],
  },
  {
    id: 'icon-button',
    title: 'IconButton',
    cases: [
      {
        label: 'Plain, tonal, filled, disabled, loading',
        render: (l) => {
          const name = pick(l, 'Add', 'شامل کریں');
          return (
            <Row>
              <IconButton icon="plus" accessibilityLabel={name} onPress={noop} />
              <IconButton icon="plus" variant="tonal" accessibilityLabel={name} onPress={noop} />
              <IconButton icon="plus" variant="filled" accessibilityLabel={name} onPress={noop} />
              <IconButton icon="plus" disabled accessibilityLabel={name} onPress={noop} />
              <IconButton icon="plus" loading accessibilityLabel={name} onPress={noop} />
            </Row>
          );
        },
      },
      {
        label: 'Icon set (arrows mirror in right to left)',
        render: () => (
          <Row>
            {iconNames.map((n) => (
              <Icon key={n} name={n} size={28} />
            ))}
          </Row>
        ),
      },
    ],
  },
  {
    id: 'text-field',
    title: 'TextField',
    cases: [
      {
        label: 'Empty with placeholder',
        render: (l) => (
          <TextField
            label={pick(l, 'Full name', 'پورا نام')}
            placeholder={pick(l, 'As on your ID', 'جیسا شناختی کارڈ پر ہے')}
            value=""
            onChangeText={noop}
            required
          />
        ),
      },
      {
        label: 'Filled, optional',
        render: (l) => (
          <TextField
            label={pick(l, 'Profession', 'پیشہ')}
            value={pick(l, 'Teacher', 'استاد')}
            onChangeText={noop}
          />
        ),
      },
      {
        label: 'Helper text',
        render: (l) => (
          <TextField
            label={pick(l, 'WhatsApp number', 'واٹس ایپ نمبر')}
            helper={pick(l, 'We send a code to this number.', 'ہم اس نمبر پر کوڈ بھیجیں گے۔')}
            value="0300 0000000"
            contentDirection="ltr"
            keyboardType="phone-pad"
            onChangeText={noop}
            required
          />
        ),
      },
      {
        label: 'Error',
        render: (l) => (
          <TextField
            label={pick(l, 'Full name', 'پورا نام')}
            error={pick(l, 'Enter your name.', 'اپنا نام لکھیں۔')}
            value=""
            onChangeText={noop}
            required
          />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => (
          <TextField
            label={pick(l, 'Area', 'علاقہ')}
            value={pick(l, 'Gulberg', 'گلبرگ')}
            disabled
            onChangeText={noop}
          />
        ),
      },
      {
        label: 'Loading (saving)',
        render: (l) => (
          <TextField
            label={pick(l, 'Full name', 'پورا نام')}
            value={pick(l, 'Amina', 'آمنہ')}
            loading
            onChangeText={noop}
          />
        ),
      },
      {
        label: 'Several lines',
        render: (l) => (
          <TextField label={pick(l, 'Update', 'اطلاع')} value="" multiline onChangeText={noop} />
        ),
      },
    ],
  },
  {
    id: 'chip',
    title: 'Chip',
    cases: [
      {
        label: 'Filter chips: off, on, removable, disabled',
        render: (l) => (
          <Row>
            <Chip label={pick(l, 'Women', 'خواتین')} selected={false} onPress={noop} />
            <Chip label={pick(l, 'Family', 'فیملی')} selected onPress={noop} />
            <Chip label={pick(l, 'Lahore', 'لاہور')} selected onRemove={noop} onPress={noop} />
            <Chip label={pick(l, 'Urdu', 'اردو')} selected={false} disabled onPress={noop} />
          </Row>
        ),
      },
      {
        label: 'Action chip',
        render: (l) => (
          <Chip label={pick(l, 'Request a circle', 'سرکل کی درخواست')} onPress={noop} />
        ),
      },
    ],
  },
  {
    id: 'card',
    title: 'Card',
    cases: [
      {
        label: 'Raised',
        render: (l) => (
          <Card>
            <Text variant="label">{pick(l, 'Al-Noor Masjid', 'النور مسجد')}</Text>
            <Text color="textSecondary">{pick(l, 'Tonight 9:30 pm', 'آج رات 9:30 بجے')}</Text>
          </Card>
        ),
      },
      {
        label: 'Outlined',
        render: (l) => (
          <Card variant="outlined">
            <Text>{pick(l, 'Outlined card', 'خاکے والا کارڈ')}</Text>
          </Card>
        ),
      },
      {
        label: 'Flat',
        render: (l) => (
          <Card variant="flat">
            <Text>{pick(l, 'Flat card', 'سادہ کارڈ')}</Text>
          </Card>
        ),
      },
      {
        label: 'Pressable',
        render: (l) => (
          <Card onPress={noop} accessibilityLabel={pick(l, 'Open venue', 'مقام کھولیں')}>
            <Text>{pick(l, 'Tap to open', 'کھولنے کے لیے دبائیں')}</Text>
          </Card>
        ),
      },
    ],
  },
  {
    id: 'list-item',
    title: 'ListItem',
    cases: [
      {
        label: 'Static',
        render: (l) => <ListItem title={pick(l, 'Parking available', 'پارکنگ دستیاب ہے')} />,
      },
      {
        label: 'Pressable, with avatar and badge',
        render: (l) => (
          <ListItem
            title={pick(l, 'Updates', 'اپڈیٹس')}
            subtitle={pick(l, 'From Al-Noor Masjid', 'النور مسجد کی طرف سے')}
            leading={<Avatar name={pick(l, 'Al Noor', 'النور مسجد')} />}
            trailing={<Badge count={3} />}
            onPress={noop}
          />
        ),
      },
      {
        label: 'Selected',
        render: (l) => (
          <ListItem title={pick(l, 'English', 'انگریزی')} selected onPress={noop} chevron={false} />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => (
          <ListItem title={pick(l, 'Not available', 'دستیاب نہیں')} disabled onPress={noop} />
        ),
      },
      {
        label: 'With divider',
        render: (l) => (
          <ListItem title={pick(l, 'With a line below', 'نیچے لکیر کے ساتھ')} divider />
        ),
      },
    ],
  },
  {
    id: 'badge',
    title: 'Badge',
    cases: [
      {
        label: 'Dot, 3, 120 (shows 99+)',
        render: () => (
          <Row>
            <Badge dot />
            <Badge count={3} />
            <Badge count={120} />
          </Row>
        ),
      },
    ],
  },
  {
    id: 'tab-bar',
    title: 'TabBar',
    note: 'Icons here are stand-ins. The bar floats; the selected tab is a green pill with its label, so it is shown by shape and text, not by colour alone.',
    cases: [
      {
        label: 'Four tabs, one with an unread badge',
        render: (l) => (
          <TabBar
            accessibilityLabel={pick(l, 'Main menu', 'مین مینو')}
            activeKey="home"
            onChange={noop}
            items={[
              {
                key: 'home',
                label: pick(l, 'Home', 'ہوم'),
                icon: ({ color }) => <Icon name="success" color={color} />,
                badge: { dot: true },
              },
              {
                key: 'nearby',
                label: pick(l, 'Nearby', 'قریب'),
                icon: ({ color }) => <Icon name="info" color={color} />,
              },
              {
                key: 'journey',
                label: pick(l, 'My Journey', 'میرا سفر'),
                icon: ({ color }) => <Icon name="check" color={color} />,
                badge: { count: 2 },
              },
              {
                key: 'quran',
                label: pick(l, 'Quran & Prayer', 'قرآن و نماز'),
                icon: ({ color }) => <Icon name="plus" color={color} />,
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    id: 'sheet',
    title: 'Sheet',
    note: 'Shown open. In the app it slides up over a dimmed backdrop.',
    cases: [
      {
        label: 'Open sheet with a list',
        render: (l) => (
          <SheetPanel title={pick(l, 'Choose your area', 'اپنا علاقہ منتخب کریں')} onClose={noop}>
            <ListItem title={pick(l, 'Gulberg', 'گلبرگ')} chevron={false} onPress={noop} />
            <ListItem title={pick(l, 'Model Town', 'ماڈل ٹاؤن')} chevron={false} onPress={noop} />
          </SheetPanel>
        ),
      },
    ],
  },
  {
    id: 'select',
    title: 'Select',
    cases: [
      {
        label: 'Empty',
        render: (l) => (
          <Select
            label={pick(l, 'Section', 'حصہ')}
            value={undefined}
            onChange={noop}
            options={sections(l)}
            required
          />
        ),
      },
      {
        label: 'Chosen',
        render: (l) => (
          <Select
            label={pick(l, 'Section', 'حصہ')}
            value="women"
            onChange={noop}
            options={sections(l)}
          />
        ),
      },
      {
        label: 'Error',
        render: (l) => (
          <Select
            label={pick(l, 'Section', 'حصہ')}
            value={undefined}
            error={pick(l, 'Choose a section.', 'حصہ منتخب کریں۔')}
            onChange={noop}
            options={sections(l)}
            required
          />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => (
          <Select
            label={pick(l, 'Section', 'حصہ')}
            value="men"
            disabled
            onChange={noop}
            options={sections(l)}
          />
        ),
      },
    ],
  },
  {
    id: 'switch',
    title: 'Switch',
    cases: [
      {
        label: 'On',
        render: (l) => (
          <Switch label={pick(l, 'Dark mode', 'ڈارک موڈ')} value onValueChange={noop} />
        ),
      },
      {
        label: 'Off, with description',
        render: (l) => (
          <Switch
            label={pick(l, 'Alerts for this venue', 'اس مقام کی اطلاعات')}
            description={pick(l, 'Reminders before each session', 'ہر نشست سے پہلے یاد دہانی')}
            value={false}
            onValueChange={noop}
          />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => (
          <Switch label={pick(l, 'Dark mode', 'ڈارک موڈ')} value disabled onValueChange={noop} />
        ),
      },
    ],
  },
  {
    id: 'checkbox',
    title: 'Checkbox',
    cases: [
      {
        label: 'Checked, unchecked, disabled',
        render: (l) => (
          <>
            <Checkbox label={pick(l, 'Parking', 'پارکنگ')} checked onChange={noop} />
            <Checkbox
              label={pick(l, 'Wudu area', 'وضو کی جگہ')}
              description={pick(l, 'Near the entrance', 'داخلے کے قریب')}
              checked={false}
              onChange={noop}
            />
            <Checkbox
              label={pick(l, 'Child friendly', 'بچوں کے لیے موزوں')}
              checked
              disabled
              onChange={noop}
            />
          </>
        ),
      },
    ],
  },
  {
    id: 'segmented-control',
    title: 'SegmentedControl',
    cases: [
      {
        label: 'Three segments',
        render: (l) => (
          <SegmentedControl
            accessibilityLabel={pick(l, 'Section', 'حصہ')}
            value="men"
            onChange={noop}
            options={sections(l)}
          />
        ),
      },
      {
        label: 'Disabled',
        render: (l) => (
          <SegmentedControl
            accessibilityLabel={pick(l, 'Section', 'حصہ')}
            value="men"
            disabled
            onChange={noop}
            options={sections(l)}
          />
        ),
      },
    ],
  },
  {
    id: 'empty-state',
    title: 'EmptyState',
    cases: [
      {
        label: 'With actions',
        render: (l) => (
          <EmptyState
            icon="info"
            title={pick(l, 'No sessions near you yet', 'آپ کے قریب ابھی کوئی نشست نہیں')}
            description={pick(
              l,
              'You can ask for a circle in your area.',
              'آپ اپنے علاقے میں سرکل کی درخواست کر سکتے ہیں۔',
            )}
            action={{
              label: pick(l, 'Request a circle near me', 'میرے قریب سرکل کی درخواست'),
              onPress: noop,
            }}
            secondaryAction={{ label: pick(l, 'Change area', 'علاقہ تبدیل کریں'), onPress: noop }}
          />
        ),
      },
    ],
  },
  {
    id: 'error-state',
    title: 'ErrorState',
    cases: [
      { label: 'Generic', render: () => <ErrorState onRetry={noop} /> },
      { label: 'Offline', render: () => <ErrorState kind="offline" onRetry={noop} /> },
      { label: 'Retrying', render: () => <ErrorState retrying onRetry={noop} /> },
    ],
  },
  {
    id: 'skeleton',
    title: 'Skeleton',
    cases: [
      {
        label: 'A loading list row',
        render: () => (
          <Row>
            <Skeleton shape="circle" announce={false} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <Skeleton lines={2} />
            </div>
          </Row>
        ),
      },
      { label: 'A loading card', render: () => <Skeleton shape="block" height={120} /> },
    ],
  },
  {
    id: 'toast',
    title: 'Toast',
    cases: [
      {
        label: 'Info',
        render: (l) => (
          <Toast
            message={pick(l, 'Reminder set.', 'یاد دہانی لگا دی گئی۔')}
            onDismiss={noop}
            durationMs={0}
          />
        ),
      },
      {
        label: 'Success',
        render: (l) => (
          <Toast
            kind="success"
            message={pick(l, 'You are registered.', 'آپ کا اندراج ہو گیا۔')}
            onDismiss={noop}
            durationMs={0}
          />
        ),
      },
      {
        label: 'Warning with action',
        render: (l) => (
          <Toast
            kind="warning"
            message={pick(l, 'Session time changed.', 'نشست کا وقت بدل گیا۔')}
            actionLabel={pick(l, 'View', 'دیکھیں')}
            onAction={noop}
            onDismiss={noop}
          />
        ),
      },
      {
        label: 'Danger',
        render: (l) => (
          <Toast
            kind="danger"
            message={pick(l, 'Could not save. Try again.', 'محفوظ نہیں ہو سکا۔ دوبارہ کوشش کریں۔')}
            onDismiss={noop}
            durationMs={0}
          />
        ),
      },
    ],
  },
  {
    id: 'avatar',
    title: 'Avatar',
    cases: [
      {
        label: 'Sizes and names',
        render: (l) => (
          <Row>
            <Avatar size="sm" name={pick(l, 'Amina Khan', 'آمنہ خان')} />
            <Avatar name={pick(l, 'Bilal Ahmed', 'بلال احمد')} />
            <Avatar size="lg" name={pick(l, 'Zainab', 'زینب')} />
            <Avatar name={pick(l, 'Yusuf Ali', 'یوسف علی')} />
          </Row>
        ),
      },
    ],
  },
  {
    id: 'header',
    title: 'Header',
    cases: [
      {
        label: 'Regular with back',
        render: (l) => (
          <Header
            title={pick(l, 'Al-Noor Masjid', 'النور مسجد')}
            subtitle={pick(l, 'Gulberg, Lahore', 'گلبرگ، لاہور')}
            onBack={noop}
          />
        ),
      },
      {
        label: 'Large with actions',
        render: (l) => (
          <Header
            variant="large"
            title={pick(l, 'Nearby', 'قریب')}
            actions={
              <IconButton
                icon="plus"
                accessibilityLabel={pick(l, 'Add', 'شامل کریں')}
                onPress={noop}
              />
            }
          />
        ),
      },
    ],
  },
  {
    id: 'hero-header',
    title: 'HeroHeader',
    note: 'The green header that tops main screens (D12). Content such as the next circle sits inside it.',
    cases: [
      {
        label: 'With back, actions and content',
        render: (l) => (
          <HeroHeader
            eyebrow={pick(l, 'Gulshan · 4 Rabi al-Thani', 'گلشن · 4 ربیع الثانی')}
            title={pick(l, 'Your next circle', 'آپ کا اگلا حلقہ')}
            onBack={noop}
            actions={
              <IconButton
                icon="info"
                variant="onHero"
                accessibilityLabel={pick(l, 'About', 'تعارف')}
                onPress={noop}
              />
            }
          >
            <Card>
              <Text variant="title3">{pick(l, 'Dars-e-Quran', 'درسِ قرآن')}</Text>
              <Text variant="caption" color="textSecondary">
                {pick(l, 'Masjid Al-Noor · 1.2 km', 'مسجد النور · 1.2 کلومیٹر')}
              </Text>
            </Card>
          </HeroHeader>
        ),
      },
    ],
  },
  {
    id: 'search-field',
    title: 'SearchField and CodeField',
    note: 'Search is a pill with a clear button (D9). The code is one box per digit, always left to right.',
    cases: [
      {
        label: 'Search with text',
        render: (l) => (
          <SearchField
            accessibilityLabel={pick(l, 'Search circles', 'حلقے تلاش کریں')}
            value={pick(l, 'Kahf', 'کہف')}
            onChangeText={noop}
          />
        ),
      },
      {
        label: 'Code, two digits typed',
        render: (l) => (
          <CodeField
            accessibilityLabel={pick(l, '6-digit code', '6 ہندسوں کا کوڈ')}
            value="48"
            onChangeText={noop}
          />
        ),
      },
    ],
  },
  {
    id: 'tag-banner',
    title: 'Tag and Banner',
    cases: [
      {
        label: 'Tags',
        render: (l) => (
          <Row>
            <Tag label={pick(l, 'Seats left', 'جگہ باقی')} />
            <Tag kind="gilt" label={pick(l, 'Time changed', 'وقت بدل گیا')} />
            <Tag kind="alert" label={pick(l, 'Full', 'مکمل')} />
            <Tag kind="neutral" label={pick(l, 'Draft', 'مسودہ')} />
            <Tag kind="strong" label={pick(l, 'Registered', 'رجسٹرڈ')} />
          </Row>
        ),
      },
      {
        label: 'Banners',
        render: (l) => (
          <div style={{ display: 'grid', gap: 8 }}>
            <Banner kind="offline" title={pick(l, 'You are offline', 'آپ آف لائن ہیں')} />
            <Banner
              kind="change"
              title={pick(l, 'Friday’s circle starts at 8:00 pm', 'جمعہ کا حلقہ رات 8:00 بجے')}
              actionLabel={pick(l, 'View', 'دیکھیں')}
              onAction={noop}
            />
            <Banner
              kind="error"
              title={pick(l, 'Could not load', 'لوڈ نہیں ہو سکا')}
              actionLabel={pick(l, 'Retry', 'دوبارہ')}
              onAction={noop}
            />
          </div>
        ),
      },
    ],
  },
];

function sections(l: Locale) {
  return [
    { value: 'women', label: pick(l, 'Women', 'خواتین') },
    { value: 'men', label: pick(l, 'Men', 'مرد') },
    { value: 'family', label: pick(l, 'Family', 'فیملی') },
  ] as const;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {children}
    </div>
  );
}

const modeNames: Record<ColorMode, string> = {
  light: 'Light',
  dark: 'Dark',
  highContrast: 'High contrast',
};
const localeNames: Record<Locale, string> = {
  en: 'English, left to right',
  ur: 'Urdu, right to left',
};

function Cell({
  mode,
  locale,
  size = 0,
  children,
}: {
  mode: ColorMode;
  locale: Locale;
  size?: TextSizeStep;
  children: ReactNode;
}) {
  const c = semanticColors[mode];
  return (
    <div className="cell">
      <div className="tag">
        {modeNames[mode]} · {localeNames[locale]} · size {size + 1} of 4 ({textScale[size]}x)
      </div>
      <ThemeProvider
        mode={mode}
        locale={locale}
        textSize={size}
        reduceMotion
        style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: c.border, gap: 12 }}
      >
        {children}
      </ThemeProvider>
    </div>
  );
}

function StorySection({ story }: { story: Story }) {
  return (
    <section id={story.id}>
      <h2>{story.title}</h2>
      {story.note ? <p className="note">{story.note}</p> : null}
      {story.cases.map((c) => (
        <div key={c.label} className="case">
          <h3>{c.label}</h3>
          <div className="grid">
            {colorModes.flatMap((mode) =>
              (['en', 'ur'] as const).map((locale) => (
                <Cell key={`${mode}-${locale}`} mode={mode} locale={locale}>
                  {c.render(locale)}
                </Cell>
              )),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function TextSizes() {
  const rows: { label: string; render: Fixture }[] = [
    {
      label: 'Text and Button',
      render: (l) => (
        <>
          <Text>
            {pick(l, 'The next session is on Friday evening.', 'اگلی نشست جمعہ کی شام کو ہے۔')}
          </Text>
          <Button label={pick(l, 'Register', 'رجسٹر کریں')} onPress={noop} />
        </>
      ),
    },
    {
      label: 'TextField and Switch',
      render: (l) => (
        <>
          <TextField
            label={pick(l, 'Full name', 'پورا نام')}
            value=""
            onChangeText={noop}
            required
          />
          <Switch label={pick(l, 'Dark mode', 'ڈارک موڈ')} value onValueChange={noop} />
        </>
      ),
    },
    {
      label: 'ListItem and Chips',
      render: (l) => (
        <>
          <ListItem
            title={pick(l, 'Al-Noor Masjid', 'النور مسجد')}
            subtitle={pick(l, 'Tonight 9:30 pm', 'آج رات 9:30 بجے')}
            onPress={noop}
          />
          <Row>
            <Chip label={pick(l, 'Women', 'خواتین')} selected onPress={noop} />
            <Chip label={pick(l, 'Family', 'فیملی')} selected={false} onPress={noop} />
          </Row>
        </>
      ),
    },
    {
      label: 'TabBar',
      render: (l) => (
        <TabBar
          activeKey="nearby"
          onChange={noop}
          items={[
            { key: 'home', label: pick(l, 'Home', 'ہوم') },
            { key: 'nearby', label: pick(l, 'Nearby', 'قریب') },
            { key: 'journey', label: pick(l, 'My Journey', 'میرا سفر') },
            { key: 'quran', label: pick(l, 'Quran & Prayer', 'قرآن و نماز') },
          ]}
        />
      ),
    },
  ];
  return (
    <section id="text-sizes">
      <h2>Four text sizes</h2>
      <p className="note">Everything grows; nothing is clipped. Shown in light mode.</p>
      {rows.map((row) => (
        <div key={row.label} className="case">
          <h3>{row.label}</h3>
          <div className="grid">
            {textSizeSteps.flatMap((size) =>
              (['en', 'ur'] as const).map((locale) => (
                <Cell key={`${size}-${locale}`} mode="light" locale={locale} size={size}>
                  {row.render(locale)}
                </Cell>
              )),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function Tokens() {
  const roles = Object.keys(typeRoles) as TypeRole[];
  return (
    <section id="tokens">
      <h2>Tokens</h2>
      <h3>Colour, with the contrast of every text pair</h3>
      <p className="note">
        Minimum 4.5:1 for text (7:1 in high contrast), 3:1 for outlines and the focus ring. Gold is
        decoration and is never used for text.
      </p>
      <div className="grid">
        {colorModes.map((mode) => {
          const c = semanticColors[mode];
          return (
            <div key={mode} className="cell">
              <div className="tag">{modeNames[mode]}</div>
              <div className="swatches">
                {Object.entries(c).map(([name, value]) => (
                  <div key={name} className="swatch">
                    <span className="chip" style={{ background: value, borderColor: '#94a3b8' }} />
                    <code>{name}</code> <span className="muted">{value}</span>
                  </div>
                ))}
              </div>
              <table>
                <tbody>
                  {contrastPairs(mode).map((p) => {
                    const ratio = contrastRatio(p.foreground, p.background);
                    return (
                      <tr key={p.name} className={ratio >= p.min ? '' : 'fail'}>
                        <td>{p.name}</td>
                        <td>{ratio.toFixed(2)}:1</td>
                        <td>
                          {ratio >= p.min ? 'pass' : 'FAIL'} (min {p.min})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <h3>Type scale, in the three scripts</h3>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Size (dp)</th>
            <th>Latin line</th>
            <th>Urdu size / line</th>
            <th>Quran size / line</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => {
            const u = typeStyle(r, 'urdu', 0);
            const q = typeStyle(r, 'quran', 0);
            return (
              <tr key={r}>
                <td>{r}</td>
                <td>{typeRoles[r].size}</td>
                <td>
                  {typeStyle(r, 'latin', 0).lineHeight} ({lineHeightRatio.latin}x)
                </td>
                <td>
                  {u.fontSize} / {u.lineHeight} ({lineHeightRatio.urdu}x)
                </td>
                <td>
                  {q.fontSize} / {q.lineHeight} ({lineHeightRatio.quran}x)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">
        Fonts: {fonts.sans} (English), {fonts.urdu} (Urdu), {fonts.quran} (Quran text only). Touch
        target {minTouchTarget} dp. Spacing:{' '}
        {Object.entries(spacing)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}
        . Radii:{' '}
        {Object.entries(radii)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}
        .
      </p>
    </section>
  );
}

function Page() {
  return (
    <div className="page">
      <h1>Quran Circles component catalog</h1>
      <p className="note">
        Every component in light, dark and high contrast, in English (left to right) and Urdu (right
        to left, draft wording). Generated by <code>pnpm --filter @qc/ui catalog</code>. Fonts load
        from Google Fonts when online. The Nastaliq and Quran files are not bundled yet, so Urdu
        shows in Noto Nastaliq Urdu and Quran text in a system font here.
      </p>
      <nav>
        <a href="#tokens">Tokens</a> <a href="#text-sizes">Text sizes</a>
        {stories.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>
      <Tokens />
      <TextSizes />
      {stories.map((s) => (
        <StorySection key={s.id} story={s} />
      ))}
    </div>
  );
}

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
  .page { max-width: 1280px; margin: 0 auto; padding: 24px 16px 96px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 48px 0 8px; border-top: 2px solid #064e3b; padding-top: 16px; }
  h3 { font-size: 15px; margin: 24px 0 8px; color: #334155; }
  .note { color: #475569; max-width: 70ch; }
  nav { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 16px 0; }
  nav a { color: #064e3b; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
  .cell { min-width: 0; }
  .tag { font-size: 12px; color: #475569; margin-bottom: 4px; }
  .swatches { display: grid; grid-template-columns: 1fr; gap: 2px; font-size: 12px; margin-bottom: 12px; }
  .swatch { display: flex; align-items: center; gap: 6px; }
  .chip { width: 18px; height: 18px; border: 1px solid; border-radius: 4px; display: inline-block; }
  .muted { color: #64748b; }
  table { border-collapse: collapse; font-size: 12px; width: 100%; }
  td, th { border-bottom: 1px solid #e2e8f0; padding: 2px 6px; text-align: start; }
  tr.fail { background: #fee2e2; }
  code { font-size: 12px; }
`;

AppRegistry.registerComponent('Catalog', () => Page);

// `getApplication` exists only in react-native-web, which is what runs this script.
const webRegistry = AppRegistry as unknown as {
  getApplication(name: string): { element: ReactElement; getStyleElement(): ReactElement };
};

/** Renders the whole catalog to one HTML document. */
export function renderCatalog(): string {
  const { element, getStyleElement } = webRegistry.getApplication('Catalog');
  const body = renderToStaticMarkup(element);
  const styles = renderToStaticMarkup(getStyleElement());
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quran Circles component catalog</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400&display=swap">
<style>[style*="Jameel Noori"] { font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important; }</style>
${styles}
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
