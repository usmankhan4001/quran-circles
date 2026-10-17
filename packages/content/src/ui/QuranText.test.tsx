import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { fonts, semanticColors } from '@qc/ui';
import { FAKE_OPENING, fakeArabic, fakeEnglish, fakeUrdu } from '../test/fakes';
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
  it('shows one ayah in the Quran font, the translation in the screen language, and the credit', async () => {
    const t = createTestServices();
    renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo });
    const arabic = await screen.findByTestId('ayah-text-arabic');
    expect(arabic.textContent).toBe(fakeArabic(93, 3));
    expect(arabic.getAttribute('lang')).toBe('ar');
    expect(arabic.getAttribute('dir')).toBe('rtl');
    expect(getComputedStyle(arabic).fontFamily).toContain(fonts.quran);
    expect(getComputedStyle(arabic).color).toBe(rgbOf(semanticColors[combo.mode].text));

    // Maududi's Urdu on an Urdu screen (right to left), his English on an English screen (left
    // to right), in the theme's text colour and not in the Quran font.
    const translation = screen.getByTestId('ayah-text-translation');
    if (combo.locale === 'ur') {
      expect(translation.textContent).toBe(fakeUrdu(93, 3));
      expect(translation.getAttribute('lang')).toBe('ur');
      expect(translation.getAttribute('dir')).toBe('rtl');
    } else {
      expect(translation.textContent).toBe(fakeEnglish(93, 3));
      expect(translation.getAttribute('lang')).toBe('en');
      expect(translation.getAttribute('dir')).toBe('ltr');
    }
    expect(getComputedStyle(translation).fontFamily).not.toContain(fonts.quran);
    expect(getComputedStyle(translation).color).toBe(rgbOf(semanticColors[combo.mode].text));

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

  it.each(['en', 'ur'] as const)(
    'hides the translation when switched off, on an %s screen',
    async (locale) => {
      const t = createTestServices();
      renderContent(<AyahText surah={93} ayah={3} showTranslation={false} />, t.services, {
        combo: { locale },
      });
      await screen.findByTestId('ayah-text-arabic');
      expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
      expect(screen.queryByText(fakeUrdu(93, 3))).toBeNull();
      expect(screen.queryByText(fakeEnglish(93, 3))).toBeNull();
    },
  );

  it('shows the translation when asked explicitly, in the screen language', async () => {
    const t = createTestServices();
    const first = renderContent(<AyahText surah={93} ayah={3} showTranslation />, t.services);
    expect((await screen.findByTestId('ayah-text-translation')).textContent).toBe(
      fakeEnglish(93, 3),
    );
    first.unmount();
    renderContent(<AyahText surah={93} ayah={3} showTranslation />, t.services, {
      combo: { locale: 'ur' },
    });
    expect((await screen.findByTestId('ayah-text-translation')).textContent).toBe(fakeUrdu(93, 3));
  });

  it.each(['en', 'ur'] as const)(
    'leaves the translation out when the ayah has none, on an %s screen',
    async (locale) => {
      const t = createTestServices();
      t.quranApi.withoutTranslation = true;
      renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo: { locale } });
      await screen.findByTestId('ayah-text-arabic');
      expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
    },
  );

  it('shows the Arabic alone on an English screen when the English edition is missing', async () => {
    const t = createTestServices();
    t.quranApi.english = 'missing';
    renderContent(<AyahText surah={93} ayah={3} />, t.services);
    await screen.findByTestId('ayah-text-arabic');
    // No English, and the Urdu is not shown in its place.
    expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
    expect(screen.queryByText(fakeUrdu(93, 3))).toBeNull();
    expect(screen.getByTestId('ayah-text-credit')).toBeTruthy();
  });

  it('still shows the Urdu on an Urdu screen when the English edition is empty', async () => {
    const t = createTestServices();
    t.quranApi.english = 'empty';
    renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo: { locale: 'ur' } });
    expect((await screen.findByTestId('ayah-text-translation')).textContent).toBe(fakeUrdu(93, 3));
  });

  it('shows an ayah cached before English offline, with the Urdu on an Urdu screen only', async () => {
    const t = createTestServices();
    const old = JSON.stringify({
      kind: 'ayah',
      fetchedAt: t.clock.now().toISOString(),
      verse: { surah: 93, ayah: 3, arabic: fakeArabic(93, 3), urdu: fakeUrdu(93, 3) },
    });
    // The services keep the cache under the "qc.quran.cache." prefix of the given storage.
    await t.storage.setItem('qc.quran.cache.qc.quran.cache.v1:ayah:93:3', old);
    t.quranApi.offline = true;
    const english = renderContent(<AyahText surah={93} ayah={3} />, t.services);
    expect((await screen.findByTestId('ayah-text-arabic')).textContent).toBe(fakeArabic(93, 3));
    expect(screen.queryByTestId('ayah-text-translation')).toBeNull();
    english.unmount();
    renderContent(<AyahText surah={93} ayah={3} />, t.services, { combo: { locale: 'ur' } });
    expect((await screen.findByTestId('ayah-text-translation')).textContent).toBe(fakeUrdu(93, 3));
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
