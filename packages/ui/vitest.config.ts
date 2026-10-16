import { defineConfig } from 'vitest/config';

// Components are written against `react-native` and rendered in tests through
// `react-native-web` in jsdom. See docs/engineering/decisions/0003-ui-tooling.md.
export default defineConfig({
  resolve: {
    alias: { 'react-native': 'react-native-web' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: [/react-native-web/] } },
    css: false,
  },
});
