// Builds the UI kit showcase: the @qc/ui catalog wrapped in a themed page with mode and language filters.
//   pnpm --filter @qc/ui catalog && node showcase/build.mjs     (from v2/)
// Writes showcase/build/index.html, a page body ready to publish as an Artifact (no html/head/body tags).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = readFileSync(
  join(here, '..', 'packages', 'ui', 'build', 'catalog', 'index.html'),
  'utf8',
);

const rnStyles = catalog.match(/<style id="react-native-stylesheet">[\s\S]*?<\/style>/)?.[0] ?? '';
let body = catalog.slice(catalog.indexOf('<body>') + 6, catalog.lastIndexOf('</body>'));
// The catalog's own title and intro are replaced by the showcase header.
body = body.replace(/<h1>[\s\S]*?<\/h1><p class="note">[\s\S]*?<\/p>/, '');
const count = (body.match(/<section id=/g) ?? []).length - 2;

const shell = readFileSync(join(here, 'shell.html'), 'utf8')
  .replace('<!--RN_STYLES-->', rnStyles)
  .replace('<!--COUNT-->', String(count))
  .replace('<!--CATALOG-->', body);

mkdirSync(join(here, 'build'), { recursive: true });
writeFileSync(join(here, 'build', 'index.html'), shell);
process.stdout.write(
  `Showcase written (${Math.round(shell.length / 1024)} KB, ${count} components)\n`,
);
