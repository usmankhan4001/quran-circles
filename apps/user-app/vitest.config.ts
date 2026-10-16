import { defineConfig } from 'vitest/config';

// Screens are written against `react-native` and rendered in tests through `react-native-web`
// in jsdom, the same way as the component kit. See docs/engineering/decisions/0003-ui-tooling.md.
export default defineConfig({
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    dedupe: ['react', 'react-dom', 'react-native-web'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: [/react-native-web/, /@qc\//] } },
    css: false,
    testTimeout: 15000,
  },
});
