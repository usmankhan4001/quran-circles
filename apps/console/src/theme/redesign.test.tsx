import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import { initialsOf } from '../components/Shell';
import { rawalpindi, venueA } from '../test/people';
import { renderConsole, screen, shellReady, text } from '../test/harness';
import { contrastRatio, directionForLocale } from '../lib/ui-tokens';
import { themeVariables } from './index';
import * as fx from '@qc/contracts/fixtures';

const SRC = resolve(process.cwd(), 'src');
const read = (path: string) => readFileSync(path, 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const NAMED = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'orange',
  'yellow',
  'purple',
  'pink',
  'brown',
  'teal',
  'navy',
  'gold',
  'silver',
  'maroon',
  'olive',
  'lime',
  'aqua',
  'cyan',
  'magenta',
];

describe('colour discipline', () => {
  /** Every style and component file. Tests and the token re-export file are not styled output. */
  const styled = walk(SRC).filter(
    (file) =>
      /\.(css|ts|tsx)$/.test(file) &&
      !/\.test\.tsx?$/.test(file) &&
      relative(SRC, file) !== join('lib', 'ui-tokens.ts'),
  );

  it('finds the stylesheet and the components it should check', () => {
    const names = styled.map((f) => relative(SRC, f));
    expect(names).toContain('styles.css');
    expect(names).toContain(join('components', 'Shell.tsx'));
    expect(names).toContain(join('theme', 'index.tsx'));
  });

  it('writes no raw colour outside the token file: no hex, rgb(), hsl() or named colours', () => {
    const offenders: string[] = [];
    for (const file of styled) {
      // Comments may name a colour format when they explain the rule; only code is checked.
      const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
      const name = relative(SRC, file);
      const checks: [string, RegExp][] = [
        ['hex colour', /#[0-9a-fA-F]{3,8}\b/g],
        ['colour function', /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g],
        [
          'named colour',
          new RegExp(
            `\\b(?:color|background(?:-color)?|border(?:-[a-z]+)*-color|border(?:-[a-z]+)*|fill|stroke|outline(?:-color)?|box-shadow|text-shadow)\\s*:\\s*[^;{}]*\\b(?:${NAMED.join('|')})\\b`,
            'gi',
          ),
        ],
        [
          'named colour in markup',
          new RegExp(
            `\\b(?:fill|stroke|color|backgroundColor)\\s*=\\s*["']?(?:${NAMED.join('|')})\\b`,
            'g',
          ),
        ],
      ];
      for (const [label, pattern] of checks) {
        for (const match of source.matchAll(pattern)) {
          offenders.push(`${name}: ${label} ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only styles colour through CSS variables in the stylesheet', () => {
    const css = read(resolve(SRC, 'styles.css'));
    const declarations = [
      ...css.matchAll(/\b(color|background|background-color|fill|stroke)\s*:\s*([^;{}]+);/g),
    ];
    expect(declarations.length).toBeGreaterThan(20);
    const allowed =
      /^(var\(|color-mix\(|currentColor|transparent|none|inherit|url\(|linear-gradient\()/;
    const bad = declarations.filter((m) => !allowed.test((m[2] as string).trim()));
    expect(bad.map((m) => m[0])).toEqual([]);
  });
});

describe('logical properties', () => {
  const css = read(resolve(SRC, 'styles.css'));

  it('has no physical edges, so the sidebar and every page flip on their own in Urdu', () => {
    expect(css).not.toMatch(/\b(margin|padding|border)-(left|right)\b/);
    expect(css).not.toMatch(/\bborder-(top|bottom)-(left|right)-radius\b/);
    expect(css).not.toMatch(/(^|[\s;{])(left|right)\s*:/m);
    expect(css).not.toMatch(/\bfloat\s*:/);
    expect(css).not.toMatch(/\bclear\s*:\s*(left|right)/);
    expect(css).not.toMatch(/text-align\s*:\s*(left|right)/);
  });

  it('keeps the sidebar in the start column, so it moves to the right in right to left', () => {
    const shell = /\.shell\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(shell).toMatch(/display\s*:\s*grid/);
    expect(shell).toMatch(/grid-template-columns\s*:\s*var\(--sidebar-size\)/);
    expect(css).toMatch(/\.sidebar\s*\{[^}]*inset-block-start\s*:\s*0/);
  });
});

describe('redesign tokens as CSS variables', () => {
  it('generates the sidebar, hero, type, line height and shadow variables for both modes', () => {
    const light = themeVariables('light');
    const dark = themeVariables('dark');
    for (const name of [
      '--c-sidebar-from',
      '--c-sidebar-to',
      '--c-sidebar-text',
      '--c-hero',
      '--c-text-on-hero',
      '--type-title1-size',
      '--type-body-size',
      '--line-latin',
      '--line-urdu',
      '--scale-urdu',
      '--shadow-low',
      '--shadow-button',
      '--card-edge',
      '--radius-card',
      '--radius-dialog',
      '--font-sans',
      '--font-urdu',
    ]) {
      expect(light[name], name).toBeTruthy();
      expect(dark[name], name).toBeTruthy();
    }
    expect(light['--font-sans']).toMatch(/Figtree/);
    expect(light['--font-urdu']).toMatch(/^'Mehr Nastaliq Web', 'Noto Nastaliq Urdu', serif$/);
  });

  it('turns shadows off and uses a hairline instead at night', () => {
    expect(themeVariables('light')['--card-edge']).toBe('transparent');
    expect(themeVariables('dark')['--shadow-low']).toBe('none');
    expect(themeVariables('dark')['--card-edge']).not.toBe('transparent');
  });

  it('keeps sidebar text readable on both ends of the green gradient, in light and dark', () => {
    for (const mode of ['light', 'dark'] as const) {
      const v = themeVariables(mode);
      const text = v['--c-sidebar-text'] as string;
      for (const end of ['--c-sidebar-from', '--c-sidebar-to']) {
        expect(contrastRatio(text, v[end] as string), `${mode} ${end}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('initials', () => {
  it('takes up to two initials, whatever the script', () => {
    expect(initialsOf('Test Coordinator')).toBe('TC');
    expect(initialsOf('  Single ')).toBe('S');
    expect(initialsOf('One Two Three')).toBe('OT');
    expect(initialsOf('')).toBe('');
    expect(initialsOf('ٹیسٹ کوآرڈینیٹر')).toBe('ٹک');
  });
});

describe.each<Locale>(['en', 'ur'])('shell and sidebar (%s)', (locale) => {
  const dir = directionForLocale(locale);

  it('puts the menu, the person and the display settings in the sidebar frame', async () => {
    const { container } = renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    expect(document.documentElement.dir).toBe(dir);
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    expect(sidebar).toBeTruthy();
    // The pattern is decoration: hidden from screen readers.
    expect(sidebar.querySelector('svg.pattern')?.getAttribute('aria-hidden')).toBe('true');
    expect(within(sidebar).getByRole('navigation')).toBeTruthy();
    expect(within(sidebar).getByText('Test Coordinator')).toBeTruthy();
    expect(within(sidebar).getByText('TC')).toBeTruthy();
    // Every icon sits beside a label, so none is read out.
    for (const icon of sidebar.querySelectorAll('svg')) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
    const tools = screen.getByRole('group', { name: text('console.shell.toolsLabel', locale) });
    expect(sidebar.contains(tools)).toBe(false);
    expect(within(tools).getAllByRole('combobox')).toHaveLength(3);
  });

  it('marks the current page in the menu', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    const nav = screen.getByRole('navigation', { name: text('console.shell.navLabel', locale) });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual([text('console.nav.sessions', locale)]);
  });

  it('keeps the focus order: skip link, menu, who is signed in, display settings, the page, then the credits', async () => {
    const { user } = renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    await screen.findByRole('table');
    // The page takes focus after a move; start from the top of the document, as a new visit would.
    (document.activeElement as HTMLElement | null)?.blur();
    const order: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      if (el === document.body) break;
      if (el.classList.contains('skip-link')) order.push('skip');
      else if (el.closest('.shell-nav')) order.push('nav');
      else if (el.closest('.shell-user')) order.push('user');
      else if (el.closest('.shell-bar')) order.push('tools');
      else if (el.closest('main')) order.push('main');
      else if (el.closest('.credits')) order.push('credits');
      else order.push('other');
    }
    const firstOf = (name: string) => order.indexOf(name);
    expect(order).not.toContain('other');
    expect(firstOf('skip')).toBe(0);
    expect(firstOf('nav')).toBeLessThan(firstOf('user'));
    expect(firstOf('user')).toBeLessThan(firstOf('tools'));
    expect(firstOf('tools')).toBeLessThan(firstOf('main'));
    // Each group is one run, never interleaved.
    const collapsed = order.filter((name, i) => name !== order[i - 1]);
    expect(collapsed).toEqual(['skip', 'nav', 'user', 'tools', 'main', 'credits']);
  });
});

describe.each<Locale>(['en', 'ur'])('restyled pages in %s', (locale) => {
  const dir = directionForLocale(locale);
  const sessionId = fx.sessions[0]!.id;

  const pages: [string, string, () => string][] = [
    ['venues', '/venues', () => text('console.venues.title', locale)],
    ['exports', '/exports', () => text('console.exports.title', locale)],
    ['audit log', '/audit', () => text('console.audit.title', locale)],
    ['settings', '/settings', () => text('console.settings.title', locale)],
    ['bulk import', '/import', () => text('console.import.title', locale)],
    ['coordinators', '/coordinators', () => text('console.nav.coordinators', locale)],
  ];

  it.each(pages)(
    'draws the %s page inside the shell with its own heading',
    async (_n, path, title) => {
      renderConsole({ role: 'national', locale, path });
      await shellReady(locale);
      const heading = await screen.findByRole('heading', { level: 1 });
      expect(heading.textContent).toBe(title());
      expect(document.documentElement.dir).toBe(dir);
      expect(document.querySelector('main#main .page')).toBeTruthy();
      expect(document.querySelectorAll('h1')).toHaveLength(1);
    },
  );

  it('draws the registrations page with its table and the sensitive-data notice', async () => {
    renderConsole({
      role: 'national',
      locale,
      path: `/sessions/${sessionId}/registrations`,
      handlers: {
        'registrations.forSession': () => ({
          items: [
            {
              id: '00000000-0000-4000-8000-0f0000000001',
              name: 'Test Registrant 1',
              phone: '+923000000101',
              areaId: '00000000-0000-4000-8000-030000000001',
              section: 'women',
              partySize: 2,
              status: 'confirmed',
              occurrenceId: null,
              allowsWhatsapp: true,
              createdAt: '2027-02-10T05:00:00Z',
            },
          ],
          nextCursor: null,
          totals: { registrations: 1, people: 2, waitlisted: 0 },
        }),
      },
    });
    await shellReady(locale);
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(document.documentElement.dir).toBe(dir);
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(document.querySelector('.banner-notice')).toBeTruthy();
  });

  it('draws the sign-in page as one card with a green top and the display settings above it', async () => {
    const { container } = renderConsole({ locale, path: '/sign-in', signedIn: false });
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: text('console.signIn.title', locale),
    });
    expect(document.documentElement.dir).toBe(dir);
    const card = container.querySelector('.auth-card') as HTMLElement;
    expect(card.querySelector('.auth-hero')).toBeTruthy();
    expect(card.querySelector('.auth-hero svg.pattern')).toBeTruthy();
    expect(card.contains(heading)).toBe(true);
    const tools = screen.getByRole('group', { name: text('console.shell.toolsLabel', locale) });
    expect(card.contains(tools)).toBe(false);
    // The phone field keeps its label inside the box and takes the first focus after the tools.
    const phone = screen.getByLabelText(text('console.signIn.phone.label', locale));
    expect(phone.closest('.field-box')).toBeTruthy();
  });
});

describe('controls', () => {
  it('marks the current step of the import and keeps the others as text, not colour', async () => {
    renderConsole({ role: 'national', path: '/import' });
    await shellReady();
    const steps = await screen.findByRole('list', { name: text('console.import.steps.label') });
    const items = within(steps).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(3);
    const current = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(items[0]);
    expect(
      within(current[0] as HTMLElement).getByText(
        text('console.import.step.current')
          .replace('{number}', '1')
          .replace('{total}', String(items.length)),
      ),
    ).toBeTruthy();
  });

  it('gives a careful action a green-topped dialog with the safe choice first and stacked', async () => {
    const person = {
      id: '00000000-0000-4000-8000-0c0000000001',
      userId: '00000000-0000-4000-8000-0c0000000011',
      userName: 'Test Person One',
      phone: '+923000000051',
      role: 'venue_coordinator',
      scopeType: 'venue',
      cityId: venueA!.cityId,
      venueId: venueA!.id,
      scopeName: venueA!.name,
      createdAt: '2027-02-01T05:00:00Z',
      revokedAt: null,
    } as const;
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { 'adminRoles.list': () => ({ items: [person], nextCursor: null }) },
    });
    const row = (await screen.findByText('Test Person One')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.remove') }));
    const dialog = await screen.findByRole('dialog', {
      name: text('console.invites.remove.title'),
    });
    expect(dialog.className).toContain('modal-careful');
    expect(dialog.querySelector('.modal-head .star-badge')).toBeTruthy();
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      text('console.shell.keep'),
      text('console.invites.remove.confirm'),
    ]);
    expect(buttons[0]?.className).toContain('btn-primary');
    expect(buttons[1]?.className).toContain('btn-danger');
    // Focus lands on the safe action, not the careful one.
    expect(document.activeElement).toBe(buttons[0]);
    expect(rawalpindi).toBeTruthy();
  });
});
