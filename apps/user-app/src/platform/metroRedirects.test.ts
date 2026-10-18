import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Redirects {
  redirect: (
    moduleName: string,
    originModulePath: string,
    platform: string | null,
  ) => string | null;
  EMPTY: string;
}

const { redirect, EMPTY } = createRequire(import.meta.url)(
  '../../metro.redirects.cjs',
) as Redirects;
const zod = (folder: string) =>
  `/repo/node_modules/.pnpm/zod@4/node_modules/zod/v4/${folder}/index.js`;

describe('metro redirects', () => {
  it("drops zod's locale barrel on every platform, from each of zod's entry folders", () => {
    for (const platform of ['web', 'ios', 'android']) {
      for (const folder of ['classic', 'core', 'mini']) {
        expect(redirect('../locales/index.js', zod(folder), platform)).toBe(EMPTY);
      }
    }
    expect(EMPTY).toMatch(/src[\\/]platform[\\/]empty-module\.js$/);
  });

  it('leaves the English locale, other locale imports and other packages alone', () => {
    expect(redirect('../locales/en.js', zod('classic'), 'web')).toBeNull();
    expect(redirect('../locales/index.js', '/repo/src/app/thing.ts', 'web')).toBeNull();
    expect(redirect('../locales/index.js', zod('locales'), 'web')).toBeNull();
    expect(redirect('react', '/repo/src/app/_layout.tsx', 'web')).toBeNull();
  });
});

describe('metro redirects in the user app', () => {
  it('stubs expo-notifications on the web only', () => {
    expect(redirect('expo-notifications', '/repo/src/app/_layout.tsx', 'web')).toBe(EMPTY);
    expect(redirect('expo-notifications', '/repo/src/app/_layout.tsx', 'ios')).toBeNull();
    expect(redirect('expo-notifications', '/repo/src/app/_layout.tsx', 'android')).toBeNull();
  });
});
