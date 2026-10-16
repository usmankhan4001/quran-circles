// Builds the static component catalog: every component in every mode, as one HTML page.
//   pnpm --filter @qc/ui catalog        writes packages/ui/build/catalog/index.html
// It bundles scripts/catalog-entry.tsx with esbuild (react-native is aliased to
// react-native-web, as in the tests), runs it in Node and writes the page it returns.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const cache = join(pkg, 'node_modules', '.cache', 'catalog');
const bundle = join(cache, 'catalog-entry.cjs');
const outDir = join(pkg, 'build', 'catalog');

mkdirSync(cache, { recursive: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(here, 'catalog-entry.tsx')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  alias: { 'react-native': 'react-native-web' },
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
  logLevel: 'warning',
});

const require = createRequire(import.meta.url);
const { renderCatalog } = require(bundle);
const html = renderCatalog();
const target = join(outDir, 'index.html');
writeFileSync(target, html);
process.stdout.write(`Catalog written to ${target} (${Math.round(html.length / 1024)} KB)\n`);
