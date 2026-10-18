// Module redirects for the Metro bundler (metro.config.cjs), kept apart so a test can check them.
// Node reads this file as CommonJS, where `module`, `require` and `__dirname` exist.
/* eslint-disable no-undef, @typescript-eslint/no-require-imports -- CommonJS, as Metro loads it */
const path = require('node:path');

/** An empty module that stands in for code the app never runs. */
const EMPTY = path.join(__dirname, 'src', 'platform', 'empty-module.js');

/**
 * `@qc/i18n/client`: the catalogue with the same exports as `@qc/i18n`, filled one language at a
 * time from the app's own tables (`src/i18n/languages.web.ts`). The full catalogue has both
 * languages of every app (about 55 KB gzip); one language of this app's table is 10 to 12 KB.
 */
const I18N_CLIENT = require.resolve('@qc/i18n/client');

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

/** Stands in for zod's JSON Schema and `z.compile` modules (see the file). */
const ZOD_LEFT_OUT = path.join(__dirname, 'src', 'platform', 'zod-left-out.js');

/**
 * zod's modules for JSON Schema and for ahead-of-time compiling, by the file a request resolves
 * to. Only zod's barrels (`core/index.js`, `classic/external.js`) and lazy methods on each schema
 * (`toJSONSchema()`, `~standard`'s `jsonSchema`, the `minLength`-style getters, which read checks
 * through JSON Schema code) reach them. Parsing never does, so every response is still checked
 * against its contract.
 */
const ZOD_LEFT_OUT_FILES =
  /[\\/]zod[\\/]v4[\\/](core[\\/](compile|to-json-schema|json-schema-processors|json-schema-generator|json-schema)|classic[\\/]from-json-schema)\.js$/;

function isZodLeftOut(moduleName, originModulePath) {
  if (!moduleName.startsWith('.')) return false;
  if (!/[\\/]zod[\\/]v4[\\/]/.test(originModulePath)) return false;
  return ZOD_LEFT_OUT_FILES.test(path.resolve(path.dirname(originModulePath), moduleName));
}

/**
 * The file a request should load instead of its own, or null to resolve it as usual.
 * - The web build has no use for expo-notifications: reminders are phone-only, web push goes
 *   through the service worker, and every call is behind a platform check. On iOS and Android
 *   the real module loads.
 * - zod's locale barrel, on every platform.
 * - On the web, zod's JSON Schema and `z.compile` modules (`isZodLeftOut`). A phone's bundle is
 *   in the binary, so it keeps them.
 * - On the web, `@qc/i18n` is the live catalogue (`@qc/i18n/client`) for every importer: the
 *   app, the kit and `@qc/content`. iOS and Android keep the full catalogue in the binary.
 */
function redirect(moduleName, originModulePath, platform) {
  if (platform === 'web' && moduleName === 'expo-notifications') return EMPTY;
  if (platform === 'web' && moduleName === '@qc/i18n') return I18N_CLIENT;
  if (platform === 'web' && isZodLeftOut(moduleName, originModulePath)) return ZOD_LEFT_OUT;
  if (isZodLocaleBarrel(moduleName, originModulePath)) return EMPTY;
  return null;
}

module.exports = { redirect, EMPTY, I18N_CLIENT, ZOD_LEFT_OUT };
