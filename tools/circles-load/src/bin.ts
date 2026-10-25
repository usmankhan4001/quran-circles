import { readFileSync, writeFileSync } from 'node:fs';
import { cleanRows, type RawRow } from './clean';
import { parseCsv } from './csv';
import { geocodeVenue, type GeocodeOutcome } from './geocode';
import { buildPlan, linksOf } from './plan';
import type { LatLng } from './coords';
import { resolveAll } from './resolve';

const USAGE = `circles-load report --in <file.csv> --out <report.json> [--offline]

Cleans the circles file, finds one map position per venue (map links, then coordinates or a
plus code in the note), checks each against its city, and writes the full report to --out.
Only counts are printed. Keep both files outside the repository. The only network traffic is
the map links, which go to Google's own hosts; --offline skips it and uses only what the file
itself says. Rows that cannot be cleaned or pinned are listed in the report and are not imported.
With --geocode, venues still unpinned are looked up on Google (the address and city are sent, with the key from CIRCLES_GEOCODE_KEY); only exact street matches near the city are accepted, the rest go to the review list in the report. This command never writes to a database.`;

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
  let plan = buildPlan(rows, resolutions);
  const review: { venueKey: string; city: string; outcome: GeocodeOutcome }[] = [];
  if (process.argv.includes('--geocode')) {
    const key = process.env.CIRCLES_GEOCODE_KEY;
    if (!key) {
      console.error(
        '--geocode needs CIRCLES_GEOCODE_KEY in the environment (use node --env-file).',
      );
      process.exitCode = 2;
      return;
    }
    const pins = new Map<string, LatLng>();
    for (const v of plan.venues.filter(
      (x) => !x.importable && x.sessionRows.length > 0 && x.location.status !== 'resolved',
    )) {
      const outcome = await geocodeVenue(v.address, v.city, { key });
      if (outcome.ok) pins.set(v.venueKey, outcome.point);
      else review.push({ venueKey: v.venueKey, city: v.city, outcome });
    }
    plan = buildPlan(rows, resolutions, pins);
  }
  writeFileSync(
    output,
    JSON.stringify({ counts: plan.counts, venues: plan.venues, rows, review }, null, 2),
  );
  console.log(JSON.stringify(plan.counts, null, 1));
}

const command = process.argv[2];
if (command === 'report') await report();
else {
  console.error(USAGE);
  process.exitCode = command ? 2 : 0;
}
