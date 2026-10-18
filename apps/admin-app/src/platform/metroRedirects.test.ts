import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Redirects {
  redirect: (
    moduleName: string,
    originModulePath: string,
    platform: string | null,
  ) => string | null;
  EMPTY: string;
  I18N_CLIENT: string;
  ZOD_LEFT_OUT: string;
}

const { redirect, EMPTY, I18N_CLIENT, ZOD_LEFT_OUT } = createRequire(import.meta.url)(
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

describe('the message catalogue', () => {
  it('is the live one-language catalogue on the web, for the app and the packages alike', () => {
    expect(I18N_CLIENT).toMatch(/packages[\\/]i18n[\\/]src[\\/]client\.ts$/);
    for (const from of [
      '/repo/apps/admin-app/src/i18n/translate.ts',
      '/repo/packages/ui/src/i18n.ts',
    ]) {
      expect(redirect('@qc/i18n', from, 'web')).toBe(I18N_CLIENT);
    }
  });

  it('keeps the full catalogue on phones, and leaves the subpaths alone', () => {
    expect(redirect('@qc/i18n', '/repo/src/i18n/translate.ts', 'ios')).toBeNull();
    expect(redirect('@qc/i18n', '/repo/src/i18n/translate.ts', 'android')).toBeNull();
    expect(redirect('@qc/i18n/client', '/repo/src/i18n/languages.web.ts', 'web')).toBeNull();
    expect(
      redirect('@qc/i18n/tables/admin-app/ur', '/repo/src/i18n/languages.web.ts', 'web'),
    ).toBeNull();
  });
});

describe("zod's JSON Schema and compile modules", () => {
  const leftOut = [
    ['core', 'compile.js'],
    ['core', 'to-json-schema.js'],
    ['core', 'json-schema-processors.js'],
    ['core', 'json-schema-generator.js'],
    ['core', 'json-schema.js'],
    ['classic', 'from-json-schema.js'],
  ] as const;

  it('are left out of the web bundle, however zod spells the import', () => {
    expect(ZOD_LEFT_OUT).toMatch(/src[\\/]platform[\\/]zod-left-out\.js$/);
    expect(redirect('../core/json-schema-processors.js', zod('classic'), 'web')).toBe(ZOD_LEFT_OUT);
    expect(redirect('../core/to-json-schema.js', zod('classic'), 'web')).toBe(ZOD_LEFT_OUT);
    expect(redirect('./from-json-schema.js', zod('classic'), 'web')).toBe(ZOD_LEFT_OUT);
    for (const name of [
      'compile',
      'to-json-schema',
      'json-schema-processors',
      'json-schema-generator',
      'json-schema',
    ]) {
      expect(redirect(`./${name}.js`, zod('core'), 'web')).toBe(ZOD_LEFT_OUT);
    }
  });

  it('keep everything parsing needs, the phones, and files outside zod', () => {
    for (const name of [
      './schemas.js',
      './parse.js',
      './core.js',
      './memoizer.js',
      './doc.js',
      './checks.js',
    ]) {
      expect(redirect(name, zod('core'), 'web')).toBeNull();
    }
    expect(redirect('../core/index.js', zod('classic'), 'web')).toBeNull();
    expect(redirect('./compile.js', zod('core'), 'ios')).toBeNull();
    expect(redirect('./from-json-schema.js', zod('classic'), 'android')).toBeNull();
    expect(redirect('./compile.js', '/repo/apps/admin-app/src/api/client.ts', 'web')).toBeNull();
  });

  it("has every name zod's own files export, and says why when one is called", async () => {
    const zodDir = dirname(createRequire(import.meta.url).resolve('zod/v4/core'));
    const stub = (await import(/* @vite-ignore */ ZOD_LEFT_OUT)) as Record<string, unknown>;
    for (const [folder, file] of leftOut) {
      const real = (await import(join(zodDir, '..', folder, file))) as Record<string, unknown>;
      for (const name of Object.keys(real))
        expect(stub, `${folder}/${file}: ${name}`).toHaveProperty(name);
    }
    expect(stub.INVALID).toBe(Symbol.for('zod.compile.invalid'));
    expect(() => (stub.toJSONSchema as () => void)()).toThrow(/left out of the web bundle/);
    const method = (stub.createStandardJSONSchemaMethod as () => () => void)();
    expect(() => method()).toThrow(/left out of the web bundle/);
  });
});
