import { readFileSync, writeFileSync } from 'node:fs';
import { cleanRows, type RawRow } from './clean';
import { parseCsv } from './csv';
import { buildPlan, linksOf } from './plan';
import { resolveAll } from './resolve';

const USAGE = `circles-load report --in <file.csv> --out <report.json> [--offline]

Cleans the circles file, finds one map position per venue (map links, then coordinates or a
plus code in the note), checks each against its city, and writes the full report to --out.
Only counts are printed. Keep both files outside the repository. The only network traffic is
the map links, which go to Google's own hosts; --offline skips it and uses only what the file
itself says. Rows that cannot be cleaned or pinned are listed in the report and are not imported.
This command never writes to a database.`;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function report(): Promise<void> {
  const input = arg('in');
  const output = arg('out');
  if (!input || !output) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const raw = parseCsv(readFileSync(input, 'utf8')) as unknown as RawRow[];
  const rows = cleanRows(raw);
  const offline = process.argv.includes('--offline');
  const resolutions = await resolveAll(
    linksOf(rows),
    offline
      ? {
          fetchImpl: (async () => {
            throw new Error('offline');
          }) as unknown as typeof fetch,
        }
      : {},
  );
  const plan = buildPlan(rows, resolutions);
  writeFileSync(
    output,
    JSON.stringify({ counts: plan.counts, venues: plan.venues, rows }, null, 2),
  );
  console.log(JSON.stringify(plan.counts, null, 1));
}

const command = process.argv[2];
if (command === 'report') await report();
else {
  console.error(USAGE);
  process.exitCode = command ? 2 : 0;
}
