import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { creditGroups, fonts } from '@qc/ui';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { CreditsScreen } from './CreditsScreen';
import { ProfileScreen } from './ProfileScreen';

const en = messages.en;
const ur = messages.ur;
const ENTRY_IDS = creditGroups.flatMap((g) => g.entries.map((e) => e.id));

describe('CreditsScreen', () => {
  it('is reached from Profile', async () => {
    const view = await renderScreen(<ProfileScreen />);
    fireEvent.click(view.getByTestId('profile-credits'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'credits' } });
  });

  it('credits the fonts, the Quran text and both Maududi translations', async () => {
    const view = await renderScreen(<CreditsScreen />);
    expect(view.getByText(en['credits.title'])).toBeTruthy();
    for (const id of ENTRY_IDS) expect(view.getByTestId(`credit-${id}`)).toBeTruthy();
    expect(view.getByText(fonts.sans)).toBeTruthy();
    expect(view.getByText(fonts.urdu)).toBeTruthy();
    expect(view.getByText(fonts.quran)).toBeTruthy();
    expect(view.getByText(en['credits.mehr.body'])).toBeTruthy();
    expect(view.getByText(en['credits.translationEn.body'])).toBeTruthy();
    expect(view.getByText(en['credits.translationUr.body'])).toBeTruthy();
  });

  it('opens the CC BY-SA licence and tanzil.net in the browser', async () => {
    const view = await renderScreen(<CreditsScreen />);
    fireEvent.click(view.getByTestId('credit-mehr-link'));
    fireEvent.click(view.getByTestId('credit-tanzil-link'));
    await waitFor(() =>
      expect(view.world.opened).toEqual([
        'https://creativecommons.org/licenses/by-sa/4.0/',
        'https://tanzil.net',
      ]),
    );
  });

  it('has no link for the translations, which credit a book rather than a page', async () => {
    const view = await renderScreen(<CreditsScreen />);
    expect(view.queryByTestId('credit-translationUr-link')).toBeNull();
    expect(view.queryByTestId('credit-translationEn-link')).toBeNull();
  });

  it('goes back', async () => {
    const view = await renderScreen(<CreditsScreen />);
    fireEvent.click(view.getAllByRole('button', { name: en['ui.back'] })[0]!);
    expect(view.world.nav.last()).toEqual({ type: 'back' });
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws every credit in the language, direction and colours of the screen', async () => {
      const world = await createWorld({ locale, color, textSize });
      const view = await renderScreen(<CreditsScreen />, { world });
      const words = locale === 'ur' ? ur : en;
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      expect(view.getByText(words['credits.intro'])).toBeTruthy();
      expect(view.getByText(words['credits.fonts.heading'])).toBeTruthy();
      expect(view.getByText(words['credits.text.heading'])).toBeTruthy();
      expect(view.getByText(words['credits.kfgqpc.body'])).toBeTruthy();
      expect(view.getByText(words['credits.tanzil.link'])).toBeTruthy();
      for (const id of ENTRY_IDS) expect(view.getByTestId(`credit-${id}`)).toBeTruthy();
      // Body text uses the screen's script: the bundled Nastaliq in Urdu, Figtree in English.
      const intro = view.getByText(words['credits.intro']);
      expect(intro.style.fontFamily).toContain(locale === 'ur' ? fonts.urdu : fonts.sans);
    });
  });
});
