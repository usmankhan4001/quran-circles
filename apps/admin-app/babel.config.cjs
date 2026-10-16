// Babel reads this file as CommonJS, where `module` exists.
// eslint-disable-next-line no-undef
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
