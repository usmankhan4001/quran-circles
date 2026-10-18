import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { APPEARANCE_KEY } from '../appearance/AppearanceProvider';
import { START_SCREEN_ID } from './startScreen';

/**
 * The page the browser draws before any of the app's code has arrived: `public/index.html`
 * (the start screen and the first font) and `public/boot.js` (language, direction, colours and
 * text size from the saved appearance, and the Urdu font). Neither goes through the bundler or
 * `@qc/i18n`, so this checks them against both.
 */
const publicDir = resolve(import.meta.dirname, '../../public');
const webFonts = resolve(import.meta.dirname, '../../../../packages/ui/assets/fonts/web');
const html = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
const bootJs = readFileSync(resolve(publicDir, 'boot.js'), 'utf8');

/** The URL the bundler gives a font in packages/ui/assets/fonts/web: its name and md5. */
function bundlerUrl(file: string): string {
  const md5 = createHash('md5')
    .update(readFileSync(resolve(webFonts, file)))
    .digest('hex');
  const [name, ext] = file.split('.') as [string, string];
  return `/assets/__packages/ui/assets/fonts/web/${name}.${md5}.${ext}`;
}

interface Boot {
  doc: Document;
}

function runBoot(saved: string | null, languages: string[] = ['en-GB']): Boot {
  const doc = document.implementation.createHTMLDocument('boot');
  doc.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  const storage = {
    getItem: (key: string) => (key === APPEARANCE_KEY ? saved : null),
  };
  runInNewContext(bootJs, {
    document: doc,
    window: { localStorage: storage },
    navigator: { languages, language: languages[0] },
  });
  return { doc };
}

const prefs = (value: object) => JSON.stringify(value);
const mehrPreloads = (doc: Document) =>
  doc.head.querySelectorAll(
    `link[rel="preload"][href="${bundlerUrl('MehrNastaliqWeb-Regular.woff2')}"]`,
  );

describe('the start page', () => {
  it('preloads Figtree 400 under the name the bundler gives it', () => {
    expect(html).toContain(`href="${bundlerUrl('Figtree-400.woff2')}"`);
  });

  it('knows the bundler name of the Urdu font', () => {
    expect(bootJs).toContain(`'${bundlerUrl('MehrNastaliqWeb-Regular.woff2')}'`);
  });

  it('runs no inline script: the production policy would block it', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of scripts) {
      expect(attributes).toMatch(/\bsrc="\/[\w.-]+"/);
      expect(body?.trim()).toBe('');
    }
  });

  it('shows the app name, which reads the same in both languages, and the loading label', () => {
    expect(messages.en['app.name']).toBe(messages.ur['app.name']);
    expect(html).toContain(`>${messages.en['app.name']}</p>`);
    expect(html).toContain(`id="${START_SCREEN_ID}"`);
    expect(html).toContain(`aria-label="${messages.en['ui.loading']}"`);
    expect(bootJs).toContain(`en: '${messages.en['ui.loading']}'`);
    expect(bootJs).toContain(`ur: '${messages.ur['ui.loading']}'`);
  });
});

describe('boot.js', () => {
  it('sets English, left to right, with no colour or size of its own, when nothing is saved', () => {
    const { doc } = runBoot(null);
    const root = doc.documentElement;
    expect(root.lang).toBe('en');
    expect(root.dir).toBe('ltr');
    expect(root.hasAttribute('data-qc-color')).toBe(false);
    expect(root.hasAttribute('data-qc-text-size')).toBe(false);
    expect(doc.getElementById(START_SCREEN_ID)?.getAttribute('aria-label')).toBe(
      messages.en['ui.loading'],
    );
    expect(mehrPreloads(doc)).toHaveLength(0);
  });

  it('sets Urdu, right to left, the Urdu label and starts the Urdu font when Urdu is saved', () => {
    const { doc } = runBoot(prefs({ locale: 'ur' }));
    expect(doc.documentElement.lang).toBe('ur');
    expect(doc.documentElement.dir).toBe('rtl');
    expect(doc.getElementById(START_SCREEN_ID)?.getAttribute('aria-label')).toBe(
      messages.ur['ui.loading'],
    );
    const links = mehrPreloads(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('as')).toBe('font');
  });

  it('starts in English on a device set to Urdu until Urdu is chosen, as the app does', () => {
    expect(runBoot(null, ['ur-PK', 'en']).doc.documentElement.dir).toBe('ltr');
    expect(mehrPreloads(runBoot(null, ['ur-PK']).doc)).toHaveLength(0);
    expect(runBoot(prefs({ locale: 'ur' }), ['en']).doc.documentElement.dir).toBe('rtl');
  });

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['highContrast', 'highContrast'],
    ['system', null],
    ['purple', null],
  ])('puts the saved colour choice %s on the page as %s', (color, expected) => {
    const { doc } = runBoot(prefs({ colorChoice: color }));
    expect(doc.documentElement.getAttribute('data-qc-color')).toBe(expected);
  });

  it.each([
    [0, null],
    [1, '1'],
    [2, '2'],
    [3, '3'],
    [9, null],
    ['3', null],
  ])('puts the saved text size %s on the page as %s', (textSize, expected) => {
    const { doc } = runBoot(prefs({ textSize }));
    expect(doc.documentElement.getAttribute('data-qc-text-size')).toBe(expected);
  });

  it('uses the defaults when the saved value is damaged, and never throws', () => {
    for (const saved of ['{', 'null', '"ur"', '[]']) {
      expect(runBoot(saved).doc.documentElement.dir).toBe('ltr');
    }
    expect(() =>
      runInNewContext(bootJs, {
        document: { documentElement: null },
        window: {},
        navigator: {},
      }),
    ).not.toThrow();
  });
});
