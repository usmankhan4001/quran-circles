import { readFileSync, writeFileSync } from 'node:fs';
import { cleanRows, type RawRow } from './clean';
import type { LatLng } from './coords';
import { parseCsv } from './csv';
import { geocodeVenue, type GeocodeOutcome } from './geocode';
import { Api, load, unload, type PlanFile } from './import';
import { placeRows, placesSql } from './places';
import { buildPlan, linksOf } from './plan';
import { resolveAll } from './resolve';

const USAGE = `circles-load <command> ...

  report  --in <file.csv> --out <report.json> [--offline] [--geocode]
  places  --in <file.csv> --out <places.sql>
  load    --plan <report.json> --api <url> --email <e> --phone <E.164> --code <6 digits>
          [--apply] [--starts-on YYYY-MM-DD] [--manifest <file.json>]
  unload  --manifest <file.json> --api <url> --email <e> --phone <E.164> --code <6 digits>

report: cleans the circles file, finds one map position per venue (map links, then coordinates
or a plus code in the note), checks each against its city, and writes the full report to --out.
Only counts are printed. --offline skips the network. --geocode looks up venues still unpinned
on Google (address and city are sent; key from CIRCLES_GEOCODE_KEY): exact street matches are
accepted, approximate ones are imported flagged (owner decision), the rest go to the review list.
places: idempotent SQL for the provinces, one city per distinct city in the file and one area per
city. The app has no endpoint for these, so a database owner runs the SQL.
load: signs in by email with a code and sends the report's importable venues, then their circles,
through the API's own bulk import. Always a dry run first; --apply writes only when no row is
invalid. Writes a manifest of the ids it created, which unload archives again.

Keep every data file outside the repository. No command prints a cell value or a phone number.`;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);
const need = (name: string): string => {
  const v = arg(name);
  if (!v) throw new Error(`--${name} is required\n\n${USAGE}`);
  return v;
};

function readRaw(file: string): RawRow[] {
  return parseCsv(readFileSync(file, 'utf8')) as unknown as RawRow[];
}

async function report(): Promise<void> {
  const rows = cleanRows(readRaw(need('in')));
  const output = need('out');
  const resolutions = await resolveAll(
    linksOf(rows),
    flag('offline')
      ? {
          fetchImpl: (async () => {
            throw new Error('offline');
          }) as unknown as typeof fetch,
        }
      : {},
  );
  let plan = buildPlan(rows, resolutions);
  const review: { venueKey: string; city: string; outcome: GeocodeOutcome }[] = [];
  if (flag('geocode')) {
    const key = process.env.CIRCLES_GEOCODE_KEY;
    if (!key)
      throw new Error('--geocode needs CIRCLES_GEOCODE_KEY in the environment (node --env-file).');
    const pins = new Map<string, LatLng>();
    const approx = new Map<string, LatLng>();
    for (const v of plan.venues.filter(
      (x) => !x.importable && x.sessionRows.length > 0 && x.location.status !== 'resolved',
    )) {
      const outcome = await geocodeVenue(v.address, v.city, { key });
      if (outcome.ok) pins.set(v.venueKey, outcome.point);
      else if (outcome.reason === 'low_confidence' && outcome.candidate)
        approx.set(v.venueKey, outcome.candidate);
      else review.push({ venueKey: v.venueKey, city: v.city, outcome });
    }
    plan = buildPlan(rows, resolutions, pins, approx);
  }
  writeFileSync(
    output,
    JSON.stringify({ counts: plan.counts, venues: plan.venues, rows, review }, null, 2),
  );
  console.log(JSON.stringify(plan.counts, null, 1));
}

function places(): void {
  const rows = placeRows(readRaw(need('in')).map((r) => r.city));
  writeFileSync(need('out'), placesSql(rows));
  const guessed = rows.filter((r) => !r.sure).map((r) => r.en);
  console.log(
    `cities: ${rows.length}; province guessed for ${guessed.length}: ${guessed.join(', ')}`,
  );
}

async function signedIn(): Promise<Api> {
  const api = new Api(need('api'));
  await api.signIn(need('email'), need('phone'), need('code'));
  return api;
}

async function loadCommand(): Promise<void> {
  const plan = JSON.parse(readFileSync(need('plan'), 'utf8')) as PlanFile;
  const api = await signedIn();
  const outcome = await load(api, plan, {
    apply: flag('apply'),
    startsOn: arg('starts-on') ?? new Date().toISOString().slice(0, 10),
    log: (line) => console.log(line),
  });
  const invalid = [outcome.venues, outcome.sessions]
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .flatMap((r) => r.rows.filter((row) => row.status === 'invalid'));
  if (invalid.length > 0) console.log(JSON.stringify(invalid.slice(0, 20), null, 1));
  if (outcome.unmappedCities.length > 0)
    console.log(
      `cities missing in the target (run places first): ${outcome.unmappedCities.join(', ')}`,
    );
  const manifestFile = arg('manifest');
  if (manifestFile && flag('apply')) {
    writeFileSync(
      manifestFile,
      JSON.stringify(
        { createdAt: new Date().toISOString(), api: api.base, ...outcome.manifest },
        null,
        2,
      ),
    );
    console.log(
      `manifest: ${outcome.manifest.venueIds.length} venues, ${outcome.manifest.sessionIds.length} sessions`,
    );
  }
}

async function unloadCommand(): Promise<void> {
  const manifest = JSON.parse(readFileSync(need('manifest'), 'utf8')) as {
    venueIds: string[];
    sessionIds: string[];
  };
  const api = await signedIn();
  await unload(api, manifest, (line) => console.log(line));
}

try {
  const command = process.argv[2];
  if (command === 'report') await report();
  else if (command === 'places') places();
  else if (command === 'load') await loadCommand();
  else if (command === 'unload') await unloadCommand();
  else {
    console.error(USAGE);
    process.exitCode = command ? 2 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
