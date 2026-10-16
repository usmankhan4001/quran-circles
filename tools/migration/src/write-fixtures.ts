import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';

/** Regenerates `fixtures/` from `synthetic.ts`. Run: pnpm --filter @qc/migration fixtures:write */
const dir = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

writeFileSync(dir('venues.json'), json(syntheticVenues()));
writeFileSync(dir('registrations.json'), json(syntheticRegistrations()));
writeFileSync(dir('subscribers.json'), json(syntheticSubscribers()));
writeFileSync(dir('mapping.csv'), syntheticMappingCsv());
process.stdout.write('fixtures written\n');
