// One-off capture of the Play screenshots from the exported web build against the mock API.
const { chromium } = require('playwright');
const fs = require('fs');
const locale = process.argv[2];
const out = process.argv[3];
const ur = locale.startsWith('ur');
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(locale, ...a);
const CITY = '00000000-0000-4000-8000-020000000001'; // Rawalpindi (most demo sessions)
const AREA = '00000000-0000-4000-8000-030000000001'; // Saddar
const SESSION = '00000000-0000-4000-8000-060000000001';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 790 },
    deviceScaleFactor: 3,
    locale,
    timezoneId: 'Asia/Karachi',
    colorScheme: 'light',
  });
  await ctx.addInitScript(
    ({ l, c, a }) => {
      if (!localStorage.getItem('qc.preferences.v1'))
        localStorage.setItem(
          'qc.preferences.v1',
          JSON.stringify({
            locale: l,
            cityId: c,
            areaId: a,
            welcomed: true,
            color: 'light',
            textSize: 0,
          }),
        );
    },
    { l: ur ? 'ur' : 'en', c: CITY, a: AREA },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2027-02-15T08:00:00Z') });
  const go = async (path) => {
    await p
      .goto('http://localhost:8081' + path, { waitUntil: 'networkidle', timeout: 120000 })
      .catch(() => {});
    await p.waitForTimeout(3500);
  };
  const tidy = () =>
    p.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());)
        n.nodeValue = n.nodeValue
          .replace(/Sample Teacher/g, 'Ustadh Ahmad Ali')
          .replace(/ \(sample address\)| \(sample\)| · Sample|Sample /g, '')
          .replace(/ \(نمونہ پتہ\)| \(نمونہ\)| · نمونہ|نمونہ /g, '');
    });
  const shot = async (n) => {
    await p.waitForTimeout(1500);
    await tidy();
    await p.screenshot({ path: `${out}/${n}.png` });
    log('shot', n, p.url());
  };
  const texts = () =>
    p.evaluate(() =>
      [...document.querySelectorAll('[role=button],button,a,[role=tab],[role=link],input')]
        .map((e) =>
          (
            e.getAttribute('aria-label') ||
            e.getAttribute('placeholder') ||
            e.textContent ||
            ''
          ).trim(),
        )
        .filter(Boolean)
        .slice(0, 60)
        .join(' | '),
    );
  if (process.env.ONLY) {
    await go('/quran');
    await p
      .getByText(ur ? /اوقاتِ? ?نماز/ : /^Prayer times$/)
      .first()
      .click()
      .catch(() => log('no prayer tab'));
    await p.waitForTimeout(7000);
    await p.mouse.move(5, 400);
    await shot('06-prayer');
    await b.close();
    return;
  }
  await go('/home');
  log(
    'lang',
    await p.evaluate(() => document.documentElement.lang + ' ' + document.documentElement.dir),
  );
  await shot('01-home');
  await go('/nearby');
  await shot('02-nearby');
  await go('/session/' + SESSION);
  log('session', await texts());
  await shot('03-session');
  await go('/sign-in');
  log('signin', await texts());
  await shot('04-sign-in');
  await go('/quran');
  await shot('05-quran');
  await p
    .getByText(ur ? /اوقاتِ? ?نماز/ : /^Prayer times$/)
    .first()
    .click()
    .catch(() => log('no prayer tab'));
  await p.waitForTimeout(2500);
  await shot('06-prayer');
  await b.close();
})();
