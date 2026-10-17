import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { fonts, semanticColors } from '@qc/ui';
import { FAKE_OPENING, fakeArabic, fakeUrdu } from '../test/fakes';
import { createTestServices, lightDarkMatrix, matrix, renderContent } from '../test/render';
import { AyahText, QuranTextCredit, SavedMark } from './QuranText';

// All Quran text and translation in these tests is invented ("FAKE-AR 93:3"). Nothing is real text.

const msg = (locale: 'en' | 'ur', key: string) =>
  (messages[locale] as Record<string, string>)[key] as string;

const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const ayahCalls = (calls: string[]) => calls.filter((url) => url.includes('/ayah/'));

describe.each(matrix)('AyahText in $name', (combo) => {
  it('shows one ayah in the Quran font, the translation on an Urdu screen, and the credit', async () => {
    const t = createTestServices();
    renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo });
    const arabic = await screen.findByTestId('ayah-text-arabic');
    expect(arabic.textContent).toBe(fakeArabic(93, 3));
    expect(arabic.getAttribute('lang')).toBe('ar');
    expect(arabic.getAttribute('dir')).toBe('rtl');
    expect(getComputedStyle(arabic).fontFamily).toContain(fonts.quran);
    expect(getComputedStyle(arabic).color).toBe(rgbOf(semanticColors[combo.mode].text));

    if (combo.locale === 'ur') {
      const translation = screen.getByTestId('ayah-text-translation');
      expect(translation.textContent).toBe(fakeUrdu(93, 3));
      expect(translation.getAttribute('lang')).toBe('ur');
      expect(getComputedStyle(translation).fontFamily).not.toContain(fonts.quran);
    } else {
      expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
    }

    expect(screen.getByTestId('ayah-text-credit').textContent).toBe(
      msg(combo.locale, 'quran.credit.arabic'),
    );
    // Only that ayah was fetched, not its surah.
    expect(t.quranApi.calls).toHaveLength(1);
    expect(ayahCalls(t.quranApi.calls)).toHaveLength(1);
  });
});

describe('AyahText', () => {
  it('draws nothing while the ayah loads', () => {
    const t = createTestServices();
    const { container } = renderContent(<AyahText surah={93} ayah={3} />, t.services);
    expect(container.textContent).toBe('');
  });

  it('draws nothing when the ayah cannot be had, so a card keeps its reference', async () => {
    const t = createTestServices();
    t.quranApi.offline = true;
    const { container } = renderContent(<AyahText surah={93} ayah={3} />, t.services);
    await waitFor(() => expect(t.quranApi.calls).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toBe('');
  });

  it('shows the translation when asked on an English screen, and hides it when asked on Urdu', async () => {
    const t = createTestServices();
    const first = renderContent(<AyahText surah={93} ayah={3} showTranslation />, t.services);
    expect((await screen.findByTestId('ayah-text-translation')).textContent).toBe(fakeUrdu(93, 3));
    first.unmount();
    renderContent(<AyahText surah={93} ayah={3} showTranslation={false} />, t.services, {
      combo: { locale: 'ur' },
    });
    await screen.findByTestId('ayah-text-arabic');
    expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
  });

  it('leaves the translation out when the ayah has none', async () => {
    const t = createTestServices();
    t.quranApi.withoutTranslation = true;
    renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo: { locale: 'ur' } });
    await screen.findByTestId('ayah-text-arabic');
    expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
  });

  it('shows ayah 1 without the opening formula, as the reader does', async () => {
    const t = createTestServices();
    renderContent(<AyahText surah={18} ayah={1} />, t.services);
    const arabic = await screen.findByTestId('ayah-text-arabic');
    expect(arabic.textContent).toBe('FAKE-AR 18:1');
    expect(arabic.textContent).not.toContain(FAKE_OPENING);
  });

  it('reads the ayah from a surah already on the phone, without a request', async () => {
    const t = createTestServices();
    await t.services.source.getSurah(112);
    t.quranApi.offline = true;
    renderContent(<AyahText surah={112} ayah={2} />, t.services);
    expect((await screen.findByTestId('ayah-text-arabic')).textContent).toBe(fakeArabic(112, 2));
    expect(t.quranApi.calls).toHaveLength(1);
  });

  it('follows a change of ayah', async () => {
    const t = createTestServices();
    const view = renderContent(<AyahText surah={93} ayah={3} />, t.services);
    await screen.findByTestId('ayah-text-arabic');
    view.unmount();
    renderContent(<AyahText surah={94} ayah={5} testID="other" />, t.services);
    expect((await screen.findByTestId('other-arabic')).textContent).toBe(fakeArabic(94, 5));
  });
});

describe.each(lightDarkMatrix)('QuranTextCredit and SavedMark in $name', (combo) => {
  it('writes the credit in the screen language, in the secondary colour', () => {
    const t = createTestServices();
    renderContent(<QuranTextCredit />, t.services, { combo });
    const credit = screen.getByTestId('quran-text-credit');
    expect(credit.textContent).toBe(msg(combo.locale, 'quran.credit.arabic'));
    expect(getComputedStyle(credit).color).toBe(rgbOf(semanticColors[combo.mode].textSecondary));
  });

  it('hides the saved mark from screen readers unless it is given words', () => {
    const t = createTestServices();
    renderContent(
      <>
        <SavedMark testID="plain" />
        <SavedMark testID="named" accessibilityLabel={msg(combo.locale, 'quran.offline.saved')} />
      </>,
      t.services,
      { combo },
    );
    expect(screen.getByTestId('plain').getAttribute('aria-hidden')).toBe('true');
    const named = screen.getByRole('img', { name: msg(combo.locale, 'quran.offline.saved') });
    expect(named.getAttribute('aria-hidden')).toBeNull();

    // The arrowhead is drawn with physical borders, so it points down in either direction.
    const head = [...screen.getByTestId('plain').querySelectorAll<HTMLElement>('div')].find((el) =>
      el.style.transform.includes('rotate'),
    );
    expect(head).toBeDefined();
    expect(head?.style.borderRightWidth).toMatch(/px/);
    expect(head?.style.borderLeftWidth ?? '').toBe('');
  });
});
