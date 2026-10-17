import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import { creditGroups } from '../lib/ui-tokens';
import { renderConsole, screen, shellReady, text } from '../test/harness';

const ENTRY_IDS = creditGroups.flatMap((g) => g.entries.map((e) => e.id));

describe.each<Locale>(['en', 'ur'])('credits footer (%s)', (locale) => {
  it.each([0, 3] as const)('lists every credit at text size %s', async (textStep) => {
    renderConsole({ role: 'venue', locale, path: '/sessions', textStep });
    await shellReady(locale);
    const footer = screen.getByRole('contentinfo', { name: text('credits.title', locale) });
    expect(within(footer).getByText(text('credits.console.heading', locale))).toBeTruthy();
    for (const id of ENTRY_IDS) expect(within(footer).getByTestId(`credit-${id}`)).toBeTruthy();
    expect(within(footer).getByText(text('credits.mehr.body', locale))).toBeTruthy();
    expect(within(footer).getByText(text('credits.translationEn.body', locale))).toBeTruthy();
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });

  it('links the CC BY-SA licence and tanzil.net in a new tab', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    const mehr = screen.getByRole('link', { name: text('credits.mehr.link', locale) });
    expect(mehr.getAttribute('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    const tanzil = screen.getByRole('link', { name: text('credits.tanzil.link', locale) });
    expect(tanzil.getAttribute('href')).toBe('https://tanzil.net');
    expect(tanzil.getAttribute('rel')).toBe('noopener noreferrer');
    expect(tanzil.getAttribute('target')).toBe('_blank');
  });
});
