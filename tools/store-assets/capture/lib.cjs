const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const clean = (t) =>
  t
    .replace(/ \(sample address\)/g, '')
    .replace(/ \(sample\)/g, '')
    .replace(/Sample Teacher/g, 'Ustadh Ahmad Ali')
    .replace(/ · Sample/g, '')
    .replace(/Sample /g, '')
    .replace(/ \(نمونہ پتہ\)/g, '')
    .replace(/ \(نمونہ\)/g, '')
    .replace(/نمونہ /g, '');
exports.open = async (locale, dsf = 1) => {
  const state = {};
  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const ctx = await b.newContext({
    viewport: { width: 390, height: 790 },
    deviceScaleFactor: dsf,
    locale,
    timezoneId: 'Asia/Karachi',
    geolocation: { latitude: 31.5204, longitude: 74.3587 },
    permissions: ['geolocation'],
  });
  await ctx.route('http://localhost:4010/**', async (route) => {
    const res = await route.fetch();
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return route.fulfill({ response: res });
    const url = route.request().url();
    const method = route.request().method();
    let body = clean(await res.text());
    // Demo state: My Journey lists the seat just reserved and follows its masjid.
    if (method === 'POST' && /\/v1\/registrations$/.test(url)) state.reg = JSON.parse(body);
    if (/\/v1\/registrations\/mine/.test(url) && state.reg)
      body = JSON.stringify({ ...JSON.parse(body), items: [state.reg] });
    if (/\/v1\/me\/follows/.test(url) && state.reg) {
      const j = JSON.parse(body);
      const v = state.reg.session.venue;
      j.items = j.items
        .slice(0, 1)
        .map((f) => ({ ...f, venueId: v.id, circleId: null, name: v.name, alertsEnabled: true }));
      body = JSON.stringify(j);
    }
    route.fulfill({ response: res, body });
  });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2027-02-15T08:00:00Z') });
  return { b, ctx, p };
};
exports.go = async (p, path) => {
  await p
    .goto('http://localhost:8081' + path, { waitUntil: 'networkidle', timeout: 120000 })
    .catch(() => {});
  await p.waitForTimeout(2500);
};
exports.texts = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[role=button],button,a,[role=tab],[role=link]')]
      .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 60)
      .join(' | '),
  );
