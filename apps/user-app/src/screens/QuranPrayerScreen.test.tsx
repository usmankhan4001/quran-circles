import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { MATRIX, directionOf, expectGreenHeader, renderScreen } from '../test/harness';
import { ContentPageScreen } from './ContentPageScreen';
import { QuranPrayerScreen } from './QuranPrayerScreen';

const en = messages.en;
const ur = messages.ur;

describe('QuranPrayerScreen', () => {
  it('says plainly that the reader is not available yet while the content package is missing', async () => {
    const view = await renderScreen(<QuranPrayerScreen />);
    expect(view.getByTestId('quran-unavailable')).toBeTruthy();
    expect(view.getByText(en['quran.unavailable.title'])).toBeTruthy();
  });

  it('mounts the content package screen when it provides one', async () => {
    const view = await renderScreen(<QuranPrayerScreen />, {
      content: { QuranPrayerScreen: () => <Text>Reader from the content package</Text> },
    });
    expect(view.getByText('Reader from the content package')).toBeTruthy();
    expect(view.queryByTestId('quran-unavailable')).toBeNull();
  });

  it('asks the package to open the reader at the requested place', async () => {
    const seen: unknown[] = [];
    const view = await renderScreen(<QuranPrayerScreen reader={{ surah: 36, ayah: 1, at: 5 }} />, {
      content: {
        QuranPrayerScreen: ({ reader }) => {
          seen.push(reader);
          return <Text>Reader</Text>;
        },
      },
    });
    expect(view.getByText('Reader')).toBeTruthy();
    expect(seen).toEqual([{ surah: 36, ayah: 1, at: 5 }]);
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the fallback', async () => {
      const view = await renderScreen(<QuranPrayerScreen />, { locale, color, textSize });
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      expect(view.getByText((locale === 'ur' ? ur : en)['quran.unavailable.title'])).toBeTruthy();
    });
  });
});

describe('ContentPageScreen', () => {
  it('shows a page from the console in the language of the person', async () => {
    const english = await renderScreen(<ContentPageScreen slug="about" />);
    expect(await english.findAllByText('About Quran Circles')).not.toHaveLength(0);
    const urdu = await renderScreen(<ContentPageScreen slug="about" />, { locale: 'ur' });
    expect(await urdu.findAllByText('قرآن سرکلز کے بارے میں')).not.toHaveLength(0);
  });

  it('says what happened when the page does not exist', async () => {
    const view = await renderScreen(<ContentPageScreen slug="nope" />);
    expect(await view.findByText(en['errors.not_found'])).toBeTruthy();
  });
});
