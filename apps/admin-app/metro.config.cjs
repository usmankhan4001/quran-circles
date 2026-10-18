// Metro, the bundler behind `expo start` and `expo export`. Expo's defaults plus the redirects in
// metro.redirects.cjs, which keep code the app never runs out of the downloaded bundle.
// Node reads this file as CommonJS, where `module`, `require` and `__dirname` exist.
/* eslint-disable no-undef, @typescript-eslint/no-require-imports -- CommonJS, as Metro loads it */
const { getDefaultConfig } = require('expo/metro-config');
const { redirect } = require('./metro.redirects.cjs');

const config = getDefaultConfig(__dirname);
const resolveNext = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const filePath = redirect(moduleName, context.originModulePath, platform);
  if (filePath) return { type: 'sourceFile', filePath };
  return resolveNext
    ? resolveNext(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// The minifier writes non-ASCII text (the Urdu strings) as UTF-8 instead of `\uXXXX` escapes,
// which are up to six times longer: about 137 KB smaller before compression and 6 KB after. The
// page is served as UTF-8 (`<meta charset="utf-8">`), so the text reads the same.
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  output: { ...config.transformer.minifierConfig?.output, ascii_only: false },
};
module.exports = config;
