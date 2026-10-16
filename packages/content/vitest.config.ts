import { defineConfig } from 'vitest/config';

// Logic tests run in Node. Component tests (*.test.tsx) run in jsdom through react-native-web,
// the same way the @qc/ui kit is tested.
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
  },
});
