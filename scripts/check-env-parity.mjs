// Checks that every variable named in .env.example and infra/.env.example is documented in
// infra/ENV.md. Run with `pnpm env:check`. Uses only Node, so it needs no install.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

// Expo build-time variables are public and documented in the app READMEs, not in ENV.md.
const documentedElsewhere = /^EXPO_PUBLIC_/;

// Expands `QC_{PROXY,API}_{CPUS,MEMORY}` style patterns that ENV.md uses to save rows.
function expand(pattern) {
  const match = pattern.match(/\{([^}]+)\}/);
  if (!match) return [pattern];
  return match[1].split(',').flatMap((part) => expand(pattern.replace(match[0], part.trim())));
}

const envMd = read('infra/ENV.md');
const documented = new Set();
for (const token of envMd.matchAll(/`([A-Z][A-Z0-9_{},]*[A-Z0-9}])`/g)) {
  for (const name of expand(token[1])) documented.add(name);
}

let missing = 0;
for (const file of ['.env.example', 'infra/.env.example']) {
  const names = new Set(
    [...read(file).matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]),
  );
  for (const name of [...names].sort()) {
    if (documented.has(name) || documentedElsewhere.test(name)) continue;
    // A name that appears in ENV.md prose or a longer table cell still counts as documented.
    if (new RegExp(`\\b${name}\\b`).test(envMd)) continue;
    console.error(`${file}: ${name} is not documented in infra/ENV.md`);
    missing += 1;
  }
}

if (missing > 0) process.exit(1);
console.log(
  'env parity ok: every variable in the .env.example files is documented in infra/ENV.md',
);
