/* global document, window, navigator */
/* Quran Circles start-up: runs before the app's scripts, while the start screen shows.
 *
 * It reads the saved choices (the same `qc.preferences.v1` the app reads, src/core/preferences.ts)
 * and puts the language, direction, colour mode and text size on the page, so the start screen
 * and the first frame of the app agree with them. For Urdu readers it also starts the Urdu font
 * now, alongside the scripts, because the first screen waits for it (@qc/ui/web-fonts).
 * Nothing here is personal data. It never throws: a missing or damaged value means the defaults.
 * src/boot/bootPage.test.ts runs it and checks its strings and URLs.
 */
(function () {
  var MEHR_WOFF2 =
    '/assets/__packages/ui/assets/fonts/web/MehrNastaliqWeb-Regular.0e85c7dc5bec1511dc82dc4eb8d1b37d.woff2';
  // `ui.loading` in @qc/i18n.
  var LOADING = { en: 'Loading', ur: 'لوڈ ہو رہا ہے' };

  function saved() {
    try {
      var value = JSON.parse(window.localStorage.getItem('qc.preferences.v1') || 'null');
      return value && typeof value === 'object' ? value : {};
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ES5: the binding is required
    } catch (e) {
      return {};
    }
  }

  // Urdu if chosen, or if the device's first language is Urdu and nothing was chosen.
  function localeOf(prefs) {
    if (prefs.locale === 'en' || prefs.locale === 'ur') return prefs.locale;
    var first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return String(first).toLowerCase().split(/[-_]/)[0] === 'ur' ? 'ur' : 'en';
  }

  try {
    var prefs = saved();
    var locale = localeOf(prefs);
    var root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'ur' ? 'rtl' : 'ltr';
    if (prefs.color === 'light' || prefs.color === 'dark' || prefs.color === 'highContrast') {
      root.setAttribute('data-qc-color', prefs.color);
    }
    if (prefs.textSize === 1 || prefs.textSize === 2 || prefs.textSize === 3) {
      root.setAttribute('data-qc-text-size', String(prefs.textSize));
    }
    var start = document.getElementById('qc-start');
    if (start) start.setAttribute('aria-label', LOADING[locale]);
    if (locale === 'ur') {
      var link = document.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'font');
      link.setAttribute('type', 'font/woff2');
      link.setAttribute('crossorigin', 'anonymous');
      link.setAttribute('href', MEHR_WOFF2);
      document.head.appendChild(link);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ES5: the binding is required
  } catch (e) {
    // The app sets all of this again once it runs.
  }
})();
