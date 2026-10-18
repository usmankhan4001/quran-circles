// Module redirects for the Metro bundler (metro.config.cjs), kept apart so a test can check them.
// Node reads this file as CommonJS, where `module`, `require` and `__dirname` exist.
/* eslint-disable no-undef, @typescript-eslint/no-require-imports -- CommonJS, as Metro loads it */
const path = require('node:path');

/** An empty module that stands in for code the app never runs. */
const EMPTY = path.join(__dirname, 'src', 'platform', 'empty-module.js');

/**
 * zod's barrel files re-export every locale's error messages (`z.locales`, about 300 KB before
 * compression and 40 KB gzip). The app never reads them: zod sets up English itself from
 * `locales/en.js`, which is left alone, and the app shows its own messages from @qc/i18n.
 */
function isZodLocaleBarrel(moduleName, originModulePath) {
  return (
    moduleName === '../locales/index.js' &&
    /[\\/]zod[\\/]v4[\\/](classic|core|mini)[\\/][^\\/]+$/.test(originModulePath)
  );
}

/**
 * The file a request should load instead of its own, or null to resolve it as usual.
 * - The web build has no use for expo-notifications: reminders are phone-only, web push goes
 *   through the service worker, and every call is behind a platform check. On iOS and Android
 *   the real module loads.
 * - zod's locale barrel, on every platform.
 */
function redirect(moduleName, originModulePath, platform) {
  if (platform === 'web' && moduleName === 'expo-notifications') return EMPTY;
  if (isZodLocaleBarrel(moduleName, originModulePath)) return EMPTY;
  return null;
}

module.exports = { redirect, EMPTY };
