import { defineConfig } from 'vitest/config';

// Screens are written against `react-native` and rendered in tests through `react-native-web`
// in jsdom, the same way the ui lane tests the kit. Nothing here needs a device or a network:
// the API is the contract's mock handler.
export default defineConfig({
  resolve: {
    alias: { 'react-native': 'react-native-web' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: [/react-native-web/, /@qc\/ui/] } },
    css: false,
    testTimeout: 35000,
    maxWorkers: 2,
  },
});
