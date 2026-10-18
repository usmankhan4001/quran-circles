import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { localOnly } from '../support/browser';
import { closeDb } from '../support/db';
import { stack } from '../support/env';
import { SEED } from '../support/seed';
import {
  appearanceEntries,
  attendee,
  giveSession,
  nationalAdmin,
  venueCoordinator,
  type Account,
  type Appearance,
  type TextStep,
} from './accounts';
import { probeLayout, runAxe, type AxeOutcome, type LayoutProbe } from './a11y';
import { stubQuranSource } from './quran-stub';
import { enableFlags, outPath, readResult, STRICT, writeResult } from './results';
import {
  baseUrlFor,
  FLIPPING_ICONS,
  SCREENS,
  type App,
  type RunData,
  type Screen,
} from './screens';

/**
 * Deliverable 5 (docs/agents/briefs/quality.md): axe-core and the right-to-left checks on the
 * real screens, in English and Urdu, light and dark, at all four text sizes, plus the apps' own
 * high-contrast mode and the browser's forced colours, and a 320 px reflow pass at the largest
 * text size. Results go to the quality output directory (results.ts); the report is
 * docs/quality/accessibility-rtl.md.
 *
 * The run is an audit: a finding is recorded, not thrown, so one run shows every screen. Set
 * QC_QUALITY_STRICT=1 to fail on serious or critical WCAG violations.
 */

interface Combo extends Appearance {
  /** Browser-level emulation on top of the app's own choice. */
  forcedColors: boolean;
  width: number;
  /** The 320 px reflow pass checks layout only. */
  axe: boolean;
}

export interface ComboResult {
  combo: string;
  locale: 'en' | 'ur';
  color: string;
  textSize: TextStep;
  forcedColors: boolean;
  width: number;
  rendered: boolean;
  renderError: string | null;
  axe: AxeOutcome | null;
  layout: LayoutProbe | null;
}

export interface ScreenResult {
  /** The stack this was measured on, so a summary never mixes runs. */
  stackStartedAt: string;
  screen: string;
  app: App;
  title: string;
  owner: string;
  path: string;
  combos: ComboResult[];
}

const TEXT_STEPS: readonly TextStep[] = [0, 1, 2, 3];
const MOBILE_WIDTH = 360;
const CONSOLE_WIDTH = 1280;

function combosFor(app: App): Combo[] {
  const width = app === 'console' ? CONSOLE_WIDTH : MOBILE_WIDTH;
  const out: Combo[] = [];
  for (const locale of ['en', 'ur'] as const) {
    for (const color of ['light', 'dark'] as const) {
      for (const textSize of TEXT_STEPS) {
        out.push({ locale, color, textSize, forcedColors: false, width, axe: true });
      }
    }
    // The console has no high-contrast choice of its own: forced colours stand in for it.
    if (app !== 'console') {
      out.push({
        locale,
        color: 'highContrast',
        textSize: 0,
        forcedColors: false,
        width,
        axe: true,
      });
      out.push({
        locale,
        color: 'highContrast',
        textSize: 3,
        forcedColors: false,
        width,
        axe: true,
      });
    }
    out.push({ locale, color: 'light', textSize: 0, forcedColors: true, width, axe: true });
    out.push({ locale, color: 'light', textSize: 3, forcedColors: false, width: 320, axe: false });
  }
  return out;
}

const comboName = (c: Combo): string =>
  `${c.locale}-${c.forcedColors ? 'forced' : c.color}-t${c.textSize}${c.width === 320 ? '-320' : ''}`;

function tabsFor(screen: Screen): [string, string] | null {
  if (screen.app === 'console') return ['nav', 'main'];
  if (screen.app === 'admin-app' && screen.id === 'admin-home')
    return ['[data-testid="tab-index"]', '[data-testid="tab-account"]'];
  if (screen.app === 'user-app' && ['user-home', 'user-nearby', 'user-journey'].includes(screen.id))
    return ['[data-testid="tab-home"]', '[data-testid="tab-journey"]'];
  return null;
}

async function settle(page: Page, ready: string): Promise<string | null> {
  try {
    await page.locator(ready).first().waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    return `not rendered: ${ready} never became visible`;
  }
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 5_000,
    })
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(300);
  return null;
}

async function accountFor(app: App): Promise<Account> {
  if (app === 'user-app') return attendee();
  const admin = await nationalAdmin();
  return app === 'console' ? admin : venueCoordinator(admin);
}

const seriousCount = (r: ComboResult): number =>
  (r.axe?.violations ?? [])
    .filter((v) => v.kind === 'wcag' && (v.impact === 'serious' || v.impact === 'critical'))
    .reduce((n, v) => n + v.nodes, 0);

test.describe('accessibility and right-to-left on the real screens', () => {
  test.setTimeout(30 * 60_000);
  let data: RunData;
  let restoreFlags: () => Promise<void> = async () => {};

  test.beforeAll(async () => {
    restoreFlags = await enableFlags([
      'memorisation',
      'ayah_of_the_day',
      'reading_days',
      'community_today',
      'read_along',
      'poster_sharing',
    ]);
    const coordinator = await venueCoordinator(await nationalAdmin());
    const occurrences = await coordinator.api.adminSessions.occurrences({
      params: { sessionId: SEED.sessionTaraweehNoor },
      query: {},
    });
    const dayStart = Date.now() - 12 * 60 * 60 * 1000;
    const today = occurrences.items.find((o) => Date.parse(o.startsAt) >= dayStart);
    if (!today) throw new Error('no current occurrence of the seeded Taraweeh session');
    data = { occurrenceId: today.id };
  });

  test.afterAll(async () => {
    await restoreFlags();
    await closeDb();
  });

  for (const screen of SCREENS) {
    test(`${screen.id}: ${screen.title}`, async ({ browser }) => {
      const base = baseUrlFor(screen.app, stack());
      // A fresh synthetic account per screen: access tokens last 15 minutes and refresh tokens
      // rotate, so one account shared by every context of a long run would end up signed out.
      const account = await accountFor(screen.app);
      const path = screen.path(data);
      const results: ComboResult[] = [];
      // One context and one tab for the whole screen: a second context would reuse the
      // account's refresh token, which rotation treats as theft and signs the account out.
      const width = screen.app === 'console' ? CONSOLE_WIDTH : MOBILE_WIDTH;
      const context: BrowserContext = await browser.newContext({
        viewport: { width, height: 800 },
        deviceScaleFactor: 1,
        isMobile: screen.app !== 'console',
        hasTouch: screen.app !== 'console',
        reducedMotion: 'reduce',
        timezoneId: 'Asia/Karachi',
      });
      try {
        await localOnly(context);
        await stubQuranSource(context);
        await giveSession(context, screen.app, account);
        const page: Page = await context.newPage();
        await page.goto(`${base}${path}`);
        for (const combo of combosFor(screen.app)) {
          await page.setViewportSize({ width: combo.width, height: 800 });
          await page.emulateMedia({
            colorScheme: combo.color === 'dark' ? 'dark' : 'light',
            forcedColors: combo.forcedColors ? 'active' : 'none',
            reducedMotion: 'reduce',
          });
          await page.evaluate(
            (entries) => {
              for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
            },
            appearanceEntries(screen.app, combo),
          );
          await page.goto(`${base}${path}`);
          const renderError = await settle(page, screen.ready);
          const name = comboName(combo);
          const result: ComboResult = {
            combo: name,
            locale: combo.locale,
            color: combo.color,
            textSize: combo.textSize,
            forcedColors: combo.forcedColors,
            width: combo.width,
            rendered: renderError === null,
            renderError,
            axe: renderError === null && combo.axe ? await runAxe(page) : null,
            layout:
              renderError === null
                ? await probeLayout(page, {
                    locale: combo.locale,
                    flipping: [...FLIPPING_ICONS],
                    tabs: tabsFor(screen),
                  })
                : null,
          };
          results.push(result);
          const keyShot =
            renderError !== null ||
            name === 'ur-light-t3' ||
            name === 'ur-light-t3-320' ||
            name === 'en-dark-t0' ||
            combo.forcedColors ||
            combo.color === 'highContrast';
          if (keyShot) {
            await page.screenshot({ path: outPath('screens', screen.id, `${name}.png`) });
          }
        }
      } finally {
        await context.close();
      }
      const out: ScreenResult = {
        stackStartedAt: stack().startedAt,
        screen: screen.id,
        app: screen.app,
        title: screen.title,
        owner: screen.owner,
        path,
        combos: results,
      };
      writeResult(`a11y/${screen.id}`, out);

      const notRendered = results.filter((r) => !r.rendered).map((r) => r.combo);
      expect.soft(notRendered, `${screen.id} rendered in every combination`).toEqual([]);
      expect(
        results.some((r) => r.axe !== null),
        'axe ran at least once',
      ).toBe(true);
      if (STRICT) {
        const serious = results.reduce((n, r) => n + seriousCount(r), 0);
        expect(serious, 'serious or critical WCAG violations').toBe(0);
      }
    });
  }

  test('summary by screen, rule and owner lane', () => {
    const summary = summarise(
      SCREENS.map((s) => readResult<ScreenResult>(`a11y/${s.id}`)).filter(
        (r): r is ScreenResult => r !== null && r.stackStartedAt === stack().startedAt,
      ),
    );
    writeResult('a11y-summary', summary);
    expect(summary.screens, 'screens measured in this run').toBeGreaterThan(0);
  });
});

interface RuleRow {
  screen: string;
  owner: string;
  rule: string;
  impact: string;
  kind: string;
  help: string;
  /** Most elements failing in any one combination. */
  maxNodes: number;
  /** Combinations it fails in, of those axe ran. */
  failing: number;
  of: number;
  where: string;
  targets: string[];
  summary: string;
}

interface LayoutRow {
  screen: string;
  owner: string;
  check: string;
  combos: string[];
  examples: string[];
}

/** Says in a few words which combinations a finding shows up in. */
function whereItFails(failing: ComboResult[], all: ComboResult[]): string {
  if (failing.length === all.length) return 'every combination';
  const parts: string[] = [];
  const only = (pred: (r: ComboResult) => boolean, label: string) => {
    if (failing.every(pred) && all.some((r) => !pred(r))) parts.push(label);
  };
  only((r) => r.locale === 'ur', 'Urdu only');
  only((r) => r.locale === 'en', 'English only');
  only((r) => r.color === 'dark', 'dark only');
  only((r) => r.color === 'light' && !r.forcedColors, 'light only');
  only((r) => r.color === 'highContrast', 'high contrast only');
  only((r) => r.forcedColors, 'forced colours only');
  only((r) => r.textSize >= 2, 'text size 2-3 only');
  only((r) => r.textSize === 3, 'largest text only');
  return parts.length ? parts.join(', ') : `${failing.length} combinations`;
}

function summarise(screens: ScreenResult[]) {
  const rules: RuleRow[] = [];
  const layout: LayoutRow[] = [];
  for (const s of screens) {
    const ran = s.combos.filter((c) => c.axe !== null);
    const ruleIds = new Set(ran.flatMap((c) => c.axe?.violations.map((v) => v.rule) ?? []));
    for (const rule of ruleIds) {
      const failing = ran.filter((c) => c.axe?.violations.some((v) => v.rule === rule));
      const sample = failing
        .map((c) => c.axe?.violations.find((v) => v.rule === rule))
        .filter((v) => v !== undefined)
        .sort((a, b) => b.nodes - a.nodes)[0];
      if (!sample) continue;
      rules.push({
        screen: s.screen,
        owner: s.owner,
        rule,
        impact: sample.impact,
        kind: sample.kind,
        help: sample.help,
        maxNodes: sample.nodes,
        failing: failing.length,
        of: ran.length,
        where: whereItFails(failing, ran),
        targets: sample.targets,
        summary: sample.summaries[0] ?? '',
      });
    }
    const checks = new Set(s.combos.flatMap((c) => c.layout?.findings.map((f) => f.check) ?? []));
    for (const check of checks) {
      const hits = s.combos.filter((c) => c.layout?.findings.some((f) => f.check === check));
      layout.push({
        screen: s.screen,
        owner: s.owner,
        check,
        combos: hits.map((c) => c.combo),
        examples: [
          ...new Set(
            hits.flatMap(
              (c) => c.layout?.findings.filter((f) => f.check === check).map((f) => f.detail) ?? [],
            ),
          ),
        ].slice(0, 6),
      });
    }
  }
  const bySeverity: Record<string, { rules: number; elements: number }> = {};
  const byLane: Record<string, Record<string, number>> = {};
  for (const r of rules) {
    const sev = `${r.kind}:${r.impact}`;
    bySeverity[sev] ??= { rules: 0, elements: 0 };
    bySeverity[sev].rules += 1;
    bySeverity[sev].elements += r.maxNodes;
    byLane[r.owner] ??= {};
    const lane = byLane[r.owner] as Record<string, number>;
    lane[sev] = (lane[sev] ?? 0) + 1;
  }
  return {
    screens: screens.length,
    combinations: screens.reduce((n, s) => n + s.combos.length, 0),
    axeRuns: screens.reduce((n, s) => n + s.combos.filter((c) => c.axe !== null).length, 0),
    notRendered: screens.flatMap((s) =>
      s.combos.filter((c) => !c.rendered).map((c) => `${s.screen} ${c.combo}`),
    ),
    bySeverity,
    byLane,
    rules,
    layout,
  };
}
