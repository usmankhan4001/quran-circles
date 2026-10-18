// Store screenshot and feature-graphic generator.
//
//   node build.mjs --input <screens dir> --out <out dir> [--locales en,ur] [--sizes all] [--playwright <path>]
//
// <screens dir> holds the app screenshots named as in config.json (01-home.png, ...). If it has
// one sub-folder per locale (en/, ur/), each locale uses its own screens; otherwise every locale
// uses the same files. Screens should be portrait phone captures at about 9:19.5 (any width).
// Output: <out>/<store>/<locale>/<size>/NN-name.png and <out>/play/<locale>/feature-graphic.png.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
const input = resolve(args.input ?? join(here, '..', '..', 'screenshots-input', 'current'));
const out = resolve(args.out ?? join(here, '..', '..', 'screenshots'));
const locales = (args.locales ?? 'en,ur').split(',');
const config = JSON.parse(readFileSync(join(here, 'config.json'), 'utf8'));
const icon = join(here, '..', '..', 'icons', 'store', 'play-store-icon-512.png');

// Current store sizes (portrait). Apple: 6.9" is the required iPhone size, 6.5" is accepted as
// the fallback; 13" iPad is required while the app declares tablet support. Play: 9:16 phone.
const SIZES = {
  'ios-6.9': { store: 'app-store', w: 1320, h: 2868 },
  'ios-6.5': { store: 'app-store', w: 1284, h: 2778 },
  'ipad-13': { store: 'app-store', w: 2064, h: 2752 },
  'play-phone': { store: 'play', w: 1080, h: 1920 },
};
const sizes = args.sizes && args.sizes !== 'all' ? args.sizes.split(',') : Object.keys(SIZES);

const require = createRequire(import.meta.url);
const { chromium } = require(args.playwright ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const font = (f) => pathToFileURL(join(here, 'fonts', f)).href;
const css = (b) => `
  @font-face { font-family: Figtree; font-weight: 500; src: url(${font('Figtree-500.woff2')}); }
  @font-face { font-family: Figtree; font-weight: 700; src: url(${font('Figtree-700.woff2')}); }
  @font-face { font-family: Figtree; font-weight: 800; src: url(${font('Figtree-800.woff2')}); }
  @font-face { font-family: Nastaliq; src: url(${font('MehrNastaliqWeb-Regular.woff2')}); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: var(--w); height: var(--h); overflow: hidden; }
  body {
    background: radial-gradient(120% 70% at 50% 0%, #2b7350 0%, ${b.background_top} 45%, ${b.background_bottom} 100%);
    color: ${b.text}; font-family: Figtree, sans-serif; position: relative;
  }
  body::before { /* faint eight-point star lattice */
    content: ''; position: absolute; inset: 0; opacity: .06;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M40 8l9 23 23 9-23 9-9 23-9-23-23-9 23-9z' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E");
    background-size: calc(var(--u) * 14);
  }
  [dir=rtl] { font-family: Nastaliq, serif; }
`;

function shotHtml(b, s, text, dir, screen) {
  const { w, h } = s;
  const u = w / 100;
  const textH = h * (w / h > 0.6 ? 0.25 : 0.215);
  const phoneW = Math.min(w * (w / h > 0.6 ? 0.5 : 0.8), (h - textH + h * 0.05) / 2.13);
  const rtl = dir === 'rtl';
  const titlePx = (rtl ? 6.6 : 7.4) * u * (w / h > 0.6 ? 0.78 : 1);
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><style>${css(b)}
    :root { --w: ${w}px; --h: ${h}px; --u: ${u}px; }
    .text { position: absolute; top: 0; left: 0; right: 0; height: ${textH}px; display: flex; flex-direction: column;
      justify-content: center; align-items: center; text-align: center; padding: 0 ${8 * u}px; gap: ${rtl ? 0.6 * u : 1.6 * u}px; }
    h1 { font-weight: 800; font-size: ${titlePx}px; line-height: ${rtl ? 1.75 : 1.08}; letter-spacing: ${rtl ? 0 : '-0.02em'}; font-weight: ${rtl ? 400 : 800}; }
    p { font-weight: 500; font-size: ${titlePx * (rtl ? 0.62 : 0.5)}px; line-height: ${rtl ? 1.9 : 1.3}; color: rgba(255,255,255,.82); }
    .bar { width: ${7 * u}px; height: ${0.7 * u}px; border-radius: 99px; background: ${b.accent}; order: -1; }
    .phone { position: absolute; left: 50%; transform: translateX(-50%); top: ${textH}px; width: ${phoneW}px;
      aspect-ratio: 375 / 812; border-radius: ${phoneW * 0.13}px; background: #0b0f0d; padding: ${phoneW * 0.028}px;
      box-shadow: 0 ${phoneW * 0.06}px ${phoneW * 0.16}px rgba(0,0,0,.45), inset 0 0 0 ${phoneW * 0.006}px #3a4a42; }
    .screen { width: 100%; height: 100%; border-radius: ${phoneW * 0.105}px; overflow: hidden; background: #fff; position: relative; }
    .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
    .island { position: absolute; top: ${phoneW * 0.028}px; left: 50%; transform: translateX(-50%); width: ${phoneW * 0.3}px;
      height: ${phoneW * 0.085}px; border-radius: 99px; background: #0b0f0d; }
  </style></head><body>
    <div class="text"><div class="bar"></div><h1>${text.title}</h1><p>${text.sub}</p></div>
    <div class="phone"><div class="screen"><img src="${pathToFileURL(screen).href}"><div class="island"></div></div></div>
  </body></html>`;
}

function featureHtml(b, text, dir, screen) {
  const w = 1024,
    h = 500,
    u = w / 100;
  const rtl = dir === 'rtl';
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><style>${css(b)}
    :root { --w: ${w}px; --h: ${h}px; --u: ${u}px; }
    .copy { position: absolute; top: 0; bottom: 0; ${rtl ? 'right' : 'left'}: 64px; width: 540px; display: flex; flex-direction: column; justify-content: center; gap: ${rtl ? 6 : 14}px; }
    .tile { width: 112px; height: 112px; border-radius: 26px; background: #fff; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.3); margin-bottom: 10px; }
    .tile img { width: 100%; height: 100%; }
    h1 { font-size: ${rtl ? 34 : 50}px; line-height: ${rtl ? 1.8 : 1.05}; font-weight: ${rtl ? 400 : 800}; letter-spacing: ${rtl ? 0 : '-0.02em'}; }
    p { font-size: ${rtl ? 26 : 22}px; line-height: ${rtl ? 2 : 1.35}; font-weight: 500; color: rgba(255,255,255,.82); }
    .phone { position: absolute; ${rtl ? 'left' : 'right'}: 70px; top: 46px; width: 250px; aspect-ratio: 375/812; border-radius: 34px;
      background: #0b0f0d; padding: 8px; transform: rotate(${rtl ? -6 : 6}deg); box-shadow: 0 24px 60px rgba(0,0,0,.5); }
    .screen { width: 100%; height: 100%; border-radius: 27px; overflow: hidden; background: #fff; }
    .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  </style></head><body>
    <div class="copy"><div class="tile"><img src="${pathToFileURL(icon).href}"></div><h1>${text.title}</h1><p>${text.sub}</p></div>
    <div class="phone"><div class="screen"><img src="${pathToFileURL(screen).href}"></div></div>
  </body></html>`;
}

const screensFor = (locale) => (existsSync(join(input, locale)) ? join(input, locale) : input);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const tmp = join(tmpdir(), 'qc-store-mockup.html');
mkdirSync(out, { recursive: true });
const written = [];
async function render(html, w, h, file) {
  writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: false });
  await page.close();
  written.push(file);
}

for (const locale of locales) {
  const dir = locale === 'ur' ? 'rtl' : 'ltr';
  const src = screensFor(locale);
  for (const key of sizes) {
    const s = SIZES[key];
    for (const [i, scr] of config.screens.entries()) {
      const file = join(src, scr.file);
      if (!existsSync(file)) {
        process.stderr.write(`missing ${file}, skipped\n`);
        continue;
      }
      const name = `${String(i + 1).padStart(2, '0')}-${basename(scr.file, '.png').replace(/^\d+-/, '')}.png`;
      await render(
        shotHtml(config.brand, s, scr[locale], dir, file),
        s.w,
        s.h,
        join(out, s.store, locale, key, name),
      );
    }
  }
  await render(
    featureHtml(
      config.brand,
      config.feature_graphic[locale],
      dir,
      join(src, config.screens[0].file),
    ),
    1024,
    500,
    join(out, 'play', locale, 'feature-graphic-1024x500.png'),
  );
}
await browser.close();
process.stdout.write(`${written.length} images written to ${out}\n`);
