// Captures the store screens from the running user app (web build, mock API, demo data).
// Navigation stays inside the app after sign-in, because a page reload signs the web app out.
const { open, go, texts } = require('./lib.cjs');
const locale = process.argv[2];
const out = process.argv[3];
const dsf = Number(process.argv[4] || 3);
const ur = locale.startsWith('ur');
const log = (...a) => console.log(locale, ...a);
const tidy = (p) =>
  p.evaluate((ur) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let prev = null;
    for (let n; (n = w.nextNode()); prev = n)
      if (/^\s*(Sample|sample|نمونہ)\s*$/.test(n.nodeValue)) {
        n.nodeValue = '';
        if (prev) prev.nodeValue = prev.nodeValue.replace(/\s*·\s*$/, '');
      }
    const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w2.nextNode());)
      n.nodeValue = n.nodeValue
        .replace(/^Person$/, ur ? 'احمد رضا' : 'Ahmed Raza')
        .replace(/ · Sample| · نمونہ|\(sample\)|Sample /g, '');
  }, ur);
(async () => {
  const { b, p } = await open(locale, dsf);
  const shot = async (n) => {
    await p.waitForTimeout(1200);
    await tidy(p);
    await p.screenshot({ path: `${out}/${n}.png` });
    log('shot', n);
  };
  const tab = async (i) => {
    const t = p.locator('[role=tab]:visible');
    if ((await t.count()) >= 5) await t.nth(i).click();
    else log('no tabs');
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.mouse.move(195, 300);
    await p.waitForTimeout(2500);
  };
  await go(p, '/home');
  log(
    'lang',
    await p.evaluate(() => document.documentElement.lang + ' ' + document.documentElement.dir),
  );
  // City and area
  await p.locator('[aria-label]').first().click();
  await p.waitForTimeout(1200);
  await p
    .getByText(ur ? 'لاہور' : 'Lahore', { exact: true })
    .first()
    .click()
    .catch(() => log('no lahore'));
  await p.waitForTimeout(1200);
  await p
    .getByText(ur ? 'جوہر ٹاؤن' : 'Johar Town', { exact: true })
    .first()
    .click()
    .catch(() => log('no area'));
  await p.waitForTimeout(2000);
  // Session page from Home's next-circle card
  await p
    .getByRole('button')
    .filter({ hasText: ur ? /تفصیل/ : 'See details' })
    .first()
    .click()
    .catch(() => log('no details'));
  await p.waitForTimeout(2500);
  log('session', p.url());
  await shot('03-session');
  // Reserve, sign in, register
  await p
    .getByRole('button')
    .filter({ hasText: ur ? /نشست/ : /Reserve a free seat/ })
    .first()
    .click()
    .catch(() => log('no reserve'));
  await p.waitForTimeout(2000);
  await p.locator('input').first().fill('03001234567');
  await p
    .getByRole('button')
    .filter({ hasText: ur ? /کوڈ/ : 'Send code' })
    .first()
    .click()
    .catch(() => log('no send'));
  await p.waitForTimeout(2000);
  const code = p.locator('input').first();
  await code.click();
  await p.keyboard.type('123456', { delay: 80 });
  await p.waitForTimeout(1500);
  if (p.url().includes('sign-in'))
    await p
      .getByRole('button')
      .filter({ hasText: ur ? /سائن|داخل/ : /^Sign in$/ })
      .first()
      .click()
      .catch(() => log('no sign-in btn'));
  await p.waitForTimeout(3500);
  log('register', p.url());
  await p
    .getByLabel(ur ? /بڑھائیں/ : 'More people')
    .first()
    .click()
    .catch(() => log('no plus'));
  await p.mouse.click(5, 140);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot('04-reserve-seat');
  await p
    .getByRole('button')
    .filter({ hasText: ur ? /تصدیق/ : /^Confirm/ })
    .last()
    .click()
    .catch(() => log('no confirm'));
  await p.waitForTimeout(3500);
  log('after confirm', p.url());
  await shot('x-after-confirm');
  log(await texts(p));
  await p
    .getByRole('button')
    .filter({ hasText: ur ? /سفر/ : 'See it in My Journey' })
    .first()
    .click()
    .catch(() => log('no see-journey'));
  await p.waitForTimeout(3000);
  await shot('07-journey');
  await tab(0);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot('01-home');
  await tab(1);
  await p
    .getByText(ur ? 'لاہور' : 'Lahore', { exact: true })
    .first()
    .click()
    .catch(() => log('no chip'));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/x-chip.png` });
  log('chip', await texts(p));
  await p
    .getByText(ur ? /تمام شہر/ : 'All cities', { exact: false })
    .last()
    .click()
    .catch(() => log('no all'));
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await shot('02-nearby');
  await tab(2);
  await p
    .getByText(ur ? 'قرآن مجید' : 'Quran', { exact: true })
    .first()
    .click()
    .catch(() => {});
  await p.waitForTimeout(1500);
  await shot('05-quran');
  await p
    .getByText(ur ? 'اوقات' : 'Waqt', { exact: true })
    .first()
    .click()
    .catch(() => log('no waqt'));
  await p.waitForTimeout(1500);
  const cc = p.getByRole('button').filter({ hasText: ur ? /شہر/ : 'Choose city' });
  if (await cc.count()) {
    await cc.first().click();
    await p.waitForTimeout(1200);
    await p
      .getByText(ur ? 'لاہور' : 'Lahore', { exact: true })
      .last()
      .click()
      .catch(() => log('no lahore2'));
    await p.waitForTimeout(2000);
  }
  await shot('06-prayer-schedule');
  await b.close();
})();
