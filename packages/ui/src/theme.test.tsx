import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { ThemeProvider, Text, createTheme, fonts, textScale, useTheme } from './index';
import { t } from './i18n';
import { renderThemed } from './test/utils';

function Probe() {
  const theme = useTheme();
  return (
    <Text>
      {`${theme.mode}|${theme.locale}|${theme.direction}|${theme.textSize}|${theme.scale}|${theme.reduceMotion}`}
    </Text>
  );
}

describe('theme', () => {
  it('defaults to light, English, left-to-right, the default size, with motion on', () => {
    const theme = createTheme();
    expect(theme).toMatchObject({
      mode: 'light',
      locale: 'en',
      direction: 'ltr',
      textSize: 0,
      scale: 1,
      reduceMotion: false,
      script: 'latin',
    });
  });

  it('works without a provider using those defaults', () => {
    renderThemed(<Probe />);
    expect(screen.getByText('light|en|ltr|0|1|true')).toBeTruthy();
  });

  it('derives the direction from the language and the script from the language', () => {
    const theme = createTheme({ locale: 'ur' });
    expect(theme.direction).toBe('rtl');
    expect(theme.script).toBe('urdu');
  });

  it('lets a caller override the direction', () => {
    expect(createTheme({ locale: 'en', direction: 'rtl' }).direction).toBe('rtl');
  });

  it('carries the text size scale for each of the four steps', () => {
    for (const step of [0, 1, 2, 3] as const) {
      expect(createTheme({ textSize: step }).scale).toBe(textScale[step]);
    }
  });

  it('provides the values to components below it and nests', () => {
    renderThemed(
      <ThemeProvider mode="dark" locale="ur" textSize={2}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark|ur|rtl|2|1.3|false')).toBeTruthy();
  });

  it('resolves type roles for the theme', () => {
    const theme = createTheme({ locale: 'ur', textSize: 3 });
    expect(theme.type('body').fontFamily).toBe(fonts.urdu);
    expect(theme.type('body', 'latin').fontFamily).toBe(fonts.sans);
  });
});

describe('kit strings', () => {
  it('translates in both languages and fills placeholders', () => {
    expect(t('en', 'ui.unread', { count: 5 })).toBe('5 unread');
    expect(t('ur', 'ui.unread', { count: 5 })).toBe('5 نئے');
    expect(t('en', 'ui.close')).toBe('Close');
  });

  it('keeps an unknown placeholder visible rather than dropping it', () => {
    expect(t('en', 'ui.remove', {})).toBe('Remove {name}');
  });

  it('has every ui key in both languages', () => {
    const keys = Object.keys(messages.en).filter((k) => k.startsWith('ui.'));
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) {
      expect((messages.ur as Record<string, string>)[k], k).toBeTruthy();
    }
  });
});
