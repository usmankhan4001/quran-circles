import { PGlite } from '@electric-sql/pglite';
import type { SqlExecutor } from '@qc/db';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCli, type CliContext } from './cli';
import { ReportSchema } from './report';
import {
  phoneForms,
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';
import { clearMigrated, countRows, createSeededTarget, type TestTarget } from './test/db';

let target: TestTarget;
let v1: PGlite;
let cwd: string;
let out: string[];
let err: string[];

beforeAll(async () => {
  target = await createSeededTarget();
  v1 = new PGlite();
  await v1.exec(`
    CREATE TABLE registeration (id serial PRIMARY KEY, timestamp text, location text, read text, want text, name text, mobile text, age text, profession text, education text, area text);
    CREATE TABLE whatsapp_subscribers (phone text PRIMARY KEY, venue text, name text);`);
  for (const r of syntheticRegistrations()) {
    await v1.query(
      `INSERT INTO registeration (id, timestamp, location, read, want, name, mobile, age, profession, education, area) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.id,
        r.timestamp,
        r.location,
        r.read,
        r.want,
        r.name,
        r.mobile,
        r.age,
        r.profession,
        r.education,
        r.area,
      ],
    );
  }
  for (const s of syntheticSubscribers()) {
    await v1.query(`INSERT INTO whatsapp_subscribers (phone, venue, name) VALUES ($1,$2,$3)`, [
      s.phone,
      s.venue,
      s.name,
    ]);
  }
});
afterAll(async () => {
  await target.pg.close();
  await v1.close();
});
beforeEach(async () => {
  await clearMigrated(target);
  cwd = mkdtempSync(join(tmpdir(), 'qc-migration-test-'));
  out = [];
  err = [];
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

const NOW = new Date('2026-10-16T09:00:00Z');

function context(over: Partial<CliContext> = {}): CliContext {
  return {
    cwd,
    env: { DATABASE_URL: 'postgres://user:secret@db.example.test/qc' },
    now: () => NOW,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    connectTarget: async () => ({ db: target.exec, close: async () => {} }),
    connectV1: async () => ({ client: v1, close: async () => {} }),
    ...over,
  };
}
const cli = (args: string[], over: Partial<CliContext> = {}) => runCli(args, context(over));

function writeInputs() {
  mkdirSync(join(cwd, 'out/export'), { recursive: true });
  writeFileSync(join(cwd, 'out/export/venues.json'), JSON.stringify(syntheticVenues()));
  writeFileSync(
    join(cwd, 'out/export/registrations.json'),
    JSON.stringify(syntheticRegistrations()),
  );
  writeFileSync(join(cwd, 'out/export/subscribers.json'), JSON.stringify(syntheticSubscribers()));
  mkdirSync(join(cwd, 'out/mapping'), { recursive: true });
  writeFileSync(join(cwd, 'out/mapping/venues-mapping.csv'), syntheticMappingCsv());
}

const fingerprintFrom = (lines: string[]) =>
  lines.find((l) => l.startsWith('plan fingerprint: '))?.slice('plan fingerprint: '.length) ?? '';

const dryRun = (extra: string[] = []) =>
  cli(['migrate', '--mapping', 'out/mapping/venues-mapping.csv', '--create-areas', ...extra]);

const counts = async () => ({
  areas: await countRows(target, 'areas'),
  venues: await countRows(target, 'venues'),
  registrations: await countRows(target, 'legacy_registrations'),
  subscribers: await countRows(target, 'legacy_whatsapp_subscribers'),
});
const EMPTY = { areas: 0, venues: 0, registrations: 0, subscribers: 0 };

function reportFiles(): string[] {
  try {
    return readdirSync(join(cwd, 'out/reports')).sort();
  } catch {
    return [];
  }
}

describe('usage', () => {
  it('prints help and exits 2 with no command, 0 for --help', async () => {
    expect(await cli([])).toBe(2);
    expect(out.join('\n')).toContain('Usage');
    out.length = 0;
    expect(await cli(['--help'])).toBe(0);
  });
  it('rejects an unknown command and unknown options', async () => {
    expect(await cli(['frobnicate'])).toBe(2);
    expect(await cli(['migrate', '--nope'])).toBe(2);
    expect(err.join('\n')).toContain('error');
  });
  it('accepts the literal -- that pnpm may pass through', async () => {
    writeInputs();
    expect(
      await cli(['migrate', '--', '--offline', '--mapping', 'out/mapping/venues-mapping.csv']),
    ).toBe(0);
  });
});

describe('propose-mapping', () => {
  it('writes a CSV for review and never approves anything', async () => {
    writeInputs();
    expect(await cli(['propose-mapping', '--out', 'out/mapping/proposed.csv'])).toBe(0);
    const csv = readFileSync(join(cwd, 'out/mapping/proposed.csv'), 'utf8');
    expect(csv.split('\n')[0]).toContain('city_slug');
    expect(csv).toContain('rawalpindi');
    expect(
      csv
        .split('\n')
        .slice(1)
        .filter(Boolean)
        .every((l) => l.endsWith(',')),
    ).toBe(true); // approved is empty
    expect(out.join('\n')).toContain('proposed mapping for 14 venues');
  });
  it('will not overwrite a mapping a person may have reviewed, unless forced', async () => {
    writeInputs();
    const before = readFileSync(join(cwd, 'out/mapping/venues-mapping.csv'), 'utf8');
    expect(await cli(['propose-mapping'])).toBe(1);
    expect(readFileSync(join(cwd, 'out/mapping/venues-mapping.csv'), 'utf8')).toBe(before);
    expect(await cli(['propose-mapping', '--force'])).toBe(0);
    expect(readFileSync(join(cwd, 'out/mapping/venues-mapping.csv'), 'utf8')).not.toBe(before);
  });
  it('needs a venues file', async () => {
    mkdirSync(join(cwd, 'out/export'), { recursive: true });
    writeFileSync(join(cwd, 'out/export/subscribers.json'), '[]');
    expect(await cli(['propose-mapping'])).toBe(1);
  });
});

describe('migrate: dry run', () => {
  it('writes a counts-only report, a flagged-rows file and a fingerprint, and changes nothing', async () => {
    writeInputs();
    expect(await dryRun()).toBe(0);
    expect(await counts()).toEqual(EMPTY);
    const files = reportFiles();
    expect(files).toEqual([
      'dry-run-2026-10-16T09-00-00-000Z.flagged.csv',
      'dry-run-2026-10-16T09-00-00-000Z.json',
    ]);
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(cwd, 'out/reports', files[1]!), 'utf8')),
    );
    expect(report.mode).toBe('dry-run');
    expect(report.totals.venues.toInsert).toBe(9);
    expect(fingerprintFrom(out)).toMatch(/^[0-9a-f]{16}$/);
    const flagged = readFileSync(join(cwd, 'out/reports', files[0]!), 'utf8')
      .trim()
      .split('\n');
    expect(flagged[0]).toBe('dataset,row,source_id,reason,detail');
    const held = (c: Record<string, number>) => (c.read ?? 0) - (c.valid ?? 0);
    expect(flagged.length - 1).toBe(
      held(report.totals.venues) +
        held(report.totals.registrations) +
        held(report.totals.subscribers),
    );
    expect(out.some((l) => l.startsWith('rawalpindi'))).toBe(true);
    expect(out.some((l) => l.startsWith('TOTAL'))).toBe(true);
  });

  it('works offline with no database at all', async () => {
    writeInputs();
    const code = await cli(
      ['migrate', '--offline', '--mapping', 'out/mapping/venues-mapping.csv', '--create-areas'],
      {
        env: {},
        connectTarget: async () => {
          throw new Error('must not connect');
        },
      },
    );
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('dry-run (offline)');
  });

  it('needs a database unless offline', async () => {
    writeInputs();
    expect(await cli(['migrate'], { env: {} })).toBe(1);
    expect(err.join('\n')).toContain('DATABASE_URL is not set');
  });

  it('says so when there is no mapping, and counts every venue as not approved', async () => {
    writeInputs();
    expect(await cli(['migrate', '--offline'])).toBe(0);
    expect(out.join('\n')).toContain('no --mapping given');
    const file = reportFiles().find((f) => f.endsWith('.json'))!;
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(cwd, 'out/reports', file), 'utf8')),
    );
    expect(report.totals.venues.toInsert).toBe(0);
  });

  it('accepts exports saved as CSV', async () => {
    writeInputs();
    rmSync(join(cwd, 'out/export/subscribers.json'));
    writeFileSync(
      join(cwd, 'out/export/subscribers.csv'),
      `phone,venue,name\n${phoneForms(1).v1Digits},Sample Masjid Al-Noor,Sample Saddar\n`,
    );
    expect(await cli(['migrate', '--offline', '--mapping', 'out/mapping/venues-mapping.csv'])).toBe(
      0,
    );
    const file = reportFiles().find((f) => f.endsWith('.json'))!;
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(cwd, 'out/reports', file), 'utf8')),
    );
    expect(report.totals.subscribers.toInsert).toBe(1);
  });

  it('fails clearly on a missing folder, bad JSON, bad CSV and a missing mapping file', async () => {
    expect(await cli(['migrate', '--offline'])).toBe(1); // no inputs
    mkdirSync(join(cwd, 'out/export'), { recursive: true });
    writeFileSync(join(cwd, 'out/export/venues.json'), '{"not":"an array"}');
    expect(await cli(['migrate', '--offline'])).toBe(1);
    writeFileSync(join(cwd, 'out/export/venues.json'), '[');
    expect(await cli(['migrate', '--offline'])).toBe(1);
    rmSync(join(cwd, 'out/export/venues.json'));
    writeFileSync(join(cwd, 'out/export/venues.csv'), 'id,name\n1');
    expect(await cli(['migrate', '--offline'])).toBe(1);
    writeFileSync(join(cwd, 'out/export/venues.csv'), 'id,name\n1,x');
    expect(await cli(['migrate', '--offline', '--mapping', 'nope.csv'])).toBe(1);
    expect(err.join('\n')).toContain('missing_file');
  });

  it('refuses two files for one dataset', async () => {
    writeInputs();
    writeFileSync(join(cwd, 'out/export/venues.csv'), 'id\n1');
    expect(await cli(['migrate', '--offline'])).toBe(1);
    expect(err.join('\n')).toContain('ambiguous_input');
  });
});

describe('migrate: apply', () => {
  async function reviewedFingerprint() {
    expect(await dryRun()).toBe(0);
    const fp = fingerprintFrom(out);
    out.length = 0;
    return fp;
  }
  const apply = (confirm?: string) =>
    cli([
      'migrate',
      '--apply',
      '--mapping',
      'out/mapping/venues-mapping.csv',
      '--create-areas',
      ...(confirm ? ['--confirm', confirm] : []),
    ]);

  it('refuses without --confirm', async () => {
    writeInputs();
    expect(await apply()).toBe(1);
    expect(err.join('\n')).toContain('not_approved');
    expect(await counts()).toEqual(EMPTY);
  });

  it('refuses a fingerprint that is not the reviewed plan, without revealing the right one', async () => {
    writeInputs();
    const fp = await reviewedFingerprint();
    err.length = 0;
    expect(await apply('0123456789abcdef')).toBe(1);
    expect(await counts()).toEqual(EMPTY);
    expect([...out, ...err].join('\n')).not.toContain(fp);
  });

  it('refuses when the data changed after the review', async () => {
    writeInputs();
    const fp = await reviewedFingerprint();
    const subs = syntheticSubscribers();
    subs.push({
      phone: phoneForms(999).v1Digits,
      venue: 'Sample Masjid Al-Noor',
      name: 'Sample Saddar',
    });
    writeFileSync(join(cwd, 'out/export/subscribers.json'), JSON.stringify(subs));
    expect(await apply(fp)).toBe(1);
    expect(await counts()).toEqual(EMPTY);
  });

  it('refuses when the mapping changed after the review, even with the same counts', async () => {
    writeInputs();
    const fp = await reviewedFingerprint();
    const csv = readFileSync(join(cwd, 'out/mapping/venues-mapping.csv'), 'utf8');
    writeFileSync(
      join(cwd, 'out/mapping/venues-mapping.csv'),
      csv.replace('sample-saddar', 'sample-saddar-2'),
    );
    expect(await apply(fp)).toBe(1);
    expect(await counts()).toEqual(EMPTY);
  });

  it('cannot be combined with --offline', async () => {
    writeInputs();
    expect(await cli(['migrate', '--apply', '--offline', '--confirm', 'x'])).toBe(1);
  });

  it('applies the reviewed plan, then verify passes', async () => {
    writeInputs();
    const fp = await reviewedFingerprint();
    expect(await apply(fp)).toBe(0);
    expect(await counts()).toEqual({ areas: 9, venues: 9, registrations: 10, subscribers: 4 });
    const files = reportFiles();
    expect(files.some((f) => f.startsWith('apply-') && f.endsWith('.before.json'))).toBe(true);
    const applyReport = files.find(
      (f) => f.startsWith('apply-') && f.endsWith('.json') && !f.endsWith('.before.json'),
    )!;

    out.length = 0;
    expect(await cli(['verify', '--report', `out/reports/${applyReport}`])).toBe(0);
    expect(out.join('\n')).toContain('verification passed');
    expect(out.filter((l) => l.startsWith('FAIL'))).toEqual([]);
  });

  it('applying the same data again changes nothing, and verify still passes', async () => {
    writeInputs();
    expect(await apply(await reviewedFingerprint())).toBe(0);
    const after = await counts();
    // New day, new report names.
    const later = new Date('2026-10-17T09:00:00Z');
    out.length = 0;
    expect(await dryRun().then(() => 0)).toBe(0);
    const second = fingerprintFrom(out);
    out.length = 0;
    expect(
      await runCli(
        [
          'migrate',
          '--apply',
          '--mapping',
          'out/mapping/venues-mapping.csv',
          '--create-areas',
          '--confirm',
          second,
        ],
        context({ now: () => later }),
      ),
    ).toBe(0);
    expect(await counts()).toEqual(after);
    const applyReport = reportFiles().find(
      (f) => f.startsWith('apply-2026-10-17') && !f.includes('.before') && !f.includes('.flagged'),
    )!;
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(cwd, 'out/reports', applyReport), 'utf8')),
    );
    expect(report.applied?.inserted).toEqual({
      areas: 0,
      venues: 0,
      registrations: 0,
      subscribers: 0,
    });
    out.length = 0;
    expect(await cli(['verify', '--report', `out/reports/${applyReport}`])).toBe(0);
  });

  it('leaves the database untouched when the apply fails part way', async () => {
    writeInputs();
    const fp = await reviewedFingerprint();
    const failing: SqlExecutor = {
      exec: (sql) => target.exec.exec(sql),
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO legacy_whatsapp_subscribers')) {
          throw Object.assign(new Error('Failing row contains (Test Person 1, +923000000101)'), {
            code: '23514',
            table: 'legacy_whatsapp_subscribers',
            constraint: 'some_chk',
          });
        }
        return target.exec.query(sql, params);
      },
    };
    expect(
      await runCli(
        [
          'migrate',
          '--apply',
          '--mapping',
          'out/mapping/venues-mapping.csv',
          '--create-areas',
          '--confirm',
          fp,
        ],
        context({ connectTarget: async () => ({ db: failing, close: async () => {} }) }),
      ),
    ).toBe(1);
    expect(await counts()).toEqual(EMPTY);
    expect(err.join('\n')).toBe(
      'error: database error 23514, table legacy_whatsapp_subscribers, constraint some_chk',
    );
  });
});

describe('verify', () => {
  it('fails when the database does not match what the apply report says', async () => {
    writeInputs();
    expect(await dryRun()).toBe(0);
    const fp = fingerprintFrom(out);
    expect(
      await cli([
        'migrate',
        '--apply',
        '--mapping',
        'out/mapping/venues-mapping.csv',
        '--create-areas',
        '--confirm',
        fp,
      ]),
    ).toBe(0);
    const applyReport = reportFiles().find(
      (f) => f.startsWith('apply-') && !f.includes('.before') && !f.includes('.flagged'),
    )!;
    await target.pg.query(
      `DELETE FROM legacy_whatsapp_subscribers WHERE ctid IN (SELECT ctid FROM legacy_whatsapp_subscribers LIMIT 1)`,
    );
    out.length = 0;
    expect(await cli(['verify', '--report', `out/reports/${applyReport}`])).toBe(1);
    expect(out.join('\n')).toContain('verification FAILED');
    expect(out.some((l) => l.startsWith('FAIL legacy subscribers added'))).toBe(true);
  });

  it('wants an apply report, not a dry run, and says what is missing', async () => {
    writeInputs();
    await dryRun();
    const dry = reportFiles().find((f) => f.endsWith('.json'))!;
    expect(await cli(['verify', '--report', `out/reports/${dry}`])).toBe(1);
    expect(await cli(['verify'])).toBe(1);
  });
});

describe('snapshot', () => {
  it('writes row counts only', async () => {
    writeInputs();
    expect(await cli(['snapshot', '--out', 'out/reports/s.json'])).toBe(0);
    const snapshot = JSON.parse(readFileSync(join(cwd, 'out/reports/s.json'), 'utf8'));
    expect(snapshot.totals).toMatchObject({ venues: 0, users: 0, legacyRegistrations: 0 });
    expect(Object.keys(snapshot.cities)).toHaveLength(9);
  });
});

describe('export', () => {
  const venuesFetch = (async () =>
    new Response(JSON.stringify(syntheticVenues()), { status: 200 })) as typeof fetch;
  const env = {
    V1_SUPABASE_URL: 'https://v1.example.test',
    V1_SUPABASE_ANON_KEY: 'dummy-public-key',
    V1_NEON_DATABASE_URL: 'postgres://user:secret@v1-neon.example.test/db',
  };

  it('writes private files and prints counts only', async () => {
    expect(await cli(['export'], { env, fetchImpl: venuesFetch })).toBe(0);
    for (const name of ['venues', 'registrations', 'subscribers']) {
      const path = join(cwd, `out/export/${name}.json`);
      expect(statSync(path).mode & 0o077).toBe(0); // nobody but the owner
    }
    expect(statSync(join(cwd, 'out/export')).mode & 0o077).toBe(0);
    expect(out).toContain('exported venues: 14 rows');
    expect(out).toContain('exported registrations: 17 rows');
    expect(out).toContain('exported subscribers: 6 rows');
  });

  it('can export one dataset', async () => {
    expect(await cli(['export', '--only', 'subscribers'], { env })).toBe(0);
    expect(readdirSync(join(cwd, 'out/export'))).toEqual(['subscribers.json']);
  });

  it('says which variable is missing, never what it was', async () => {
    expect(await cli(['export'], { env: {} })).toBe(1);
    expect(err.join('\n')).toContain('V1_SUPABASE_URL');
    err.length = 0;
    expect(await cli(['export', '--only', 'registrations'], { env: {} })).toBe(1);
    expect(err.join('\n')).toContain('V1_NEON_DATABASE_URL');
  });

  it('the exported files plan cleanly', async () => {
    await cli(['export'], { env, fetchImpl: venuesFetch });
    writeFileSync(join(cwd, 'out/mapping.csv'), syntheticMappingCsv());
    out.length = 0;
    expect(
      await cli(['migrate', '--offline', '--mapping', 'out/mapping.csv', '--create-areas'], {
        env: {},
      }),
    ).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// No personal data in anything the tool prints or writes.
// ------------------------------------------------------------------------------------------------
describe('no phone numbers or names in logs, reports or errors', () => {
  const people = syntheticRegistrations()
    .map((r) => r.name)
    .filter(Boolean);
  const venueText = syntheticVenues()
    .flatMap((v) => [v.name, v.venue, v.address])
    .filter(Boolean);
  // The seven digits that make each registrant's and subscriber's number unique, however typed.
  // (Venue contact numbers are public and share digits with venue ids, so they are not listed.)
  const asAscii = (text: string) =>
    text.replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const tails = [
    ...syntheticRegistrations().map((r) => r.mobile),
    ...syntheticSubscribers().map((s) => s.phone),
  ]
    .map((raw) => asAscii(raw).replace(/\D/g, '').slice(-7))
    .filter((tail) => tail.length === 7);
  const phoneLike = /\+\d{8,}|\b0?3\d{2}[ -]?\d{7}\b|\b92\d{10,}\b|\b0?3\d{9}\b/;

  function everythingWritten(): { path: string; text: string }[] {
    const files: { path: string; text: string }[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push({ path: full, text: readFileSync(full, 'utf8') });
      }
    };
    walk(join(cwd, 'out/reports'));
    return files;
  }

  async function fullRun() {
    writeInputs();
    await dryRun();
    const fp = fingerprintFrom(out);
    await cli([
      'migrate',
      '--apply',
      '--mapping',
      'out/mapping/venues-mapping.csv',
      '--create-areas',
      '--confirm',
      fp,
    ]);
    const applyReport = reportFiles().find(
      (f) => f.startsWith('apply-') && !f.includes('.before') && !f.includes('.flagged'),
    )!;
    await cli(['verify', '--report', `out/reports/${applyReport}`]);
    await cli(['migrate', '--offline']);
    await cli(['snapshot']);
  }

  it('the scan would notice a leak: the inputs do contain the names and numbers it looks for', () => {
    writeInputs();
    const input = ['venues', 'registrations', 'subscribers']
      .map((name) => readFileSync(join(cwd, `out/export/${name}.json`), 'utf8'))
      .join('\n');
    expect(tails.length).toBeGreaterThan(15);
    expect(people.every((name) => input.includes(name))).toBe(true);
    expect(venueText.some((text) => input.includes(text))).toBe(true);
    expect(tails.filter((tail) => input.includes(tail)).length).toBeGreaterThan(10);
    expect(phoneLike.test(input)).toBe(true);
  });

  it('the console output of a full run contains none', async () => {
    await fullRun();
    const lines = [...out, ...err].filter((l) => !l.startsWith('plan fingerprint:'));
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) {
      for (const secret of [...people, ...venueText]) expect(line).not.toContain(secret);
      for (const tail of tails) expect(line).not.toContain(tail);
      expect(line).not.toMatch(phoneLike);
    }
    expect(lines.join('\n')).not.toMatch(/secret|example\.test/); // connection details never echoed
  });

  it('the report, flagged-rows file and snapshots contain none', async () => {
    await fullRun();
    const files = everythingWritten();
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const { path, text } of files) {
      for (const secret of [...people, ...venueText]) expect(text, path).not.toContain(secret);
      for (const tail of tails) expect(text, path).not.toContain(tail);
      expect(text, path).not.toMatch(phoneLike);
    }
  });

  it('reports hold counts and city slugs only', async () => {
    await fullRun();
    for (const { path, text } of everythingWritten().filter(
      (f) => f.path.endsWith('.json') && !f.path.includes('before') && !f.path.includes('snapshot'),
    )) {
      ReportSchema.parse(JSON.parse(text)); // strict: any extra key or text would throw
      expect(path).toBeTruthy();
    }
  });

  it('error output never echoes data, even when the failure carries it', async () => {
    writeInputs();
    const leaky = Object.assign(
      new Error(
        'password authentication failed for user "alice" at db.example.test: Test Person 1 +923000000101',
      ),
      { code: '28P01' },
    );
    const code = await cli(['migrate'], {
      connectTarget: async () => {
        throw leaky;
      },
    });
    expect(code).toBe(1);
    expect(err.join('\n')).toBe('error: database error 28P01');
    err.length = 0;
    await cli(['migrate'], {
      connectTarget: async () => {
        throw new Error('boom Test Person 1 +923000000101 db.example.test');
      },
    });
    expect(err.join('\n')).not.toMatch(/Test Person|923000000101|example/);
  });

  it('malformed input errors do not echo the file', async () => {
    mkdirSync(join(cwd, 'out/export'), { recursive: true });
    writeFileSync(
      join(cwd, 'out/export/registrations.json'),
      '[{"name": "Test Person 1", "mobile": "+923000000101"',
    );
    await cli(['migrate', '--offline']);
    expect([...out, ...err].join('\n')).not.toMatch(/Test Person|923000000101/);
  });
});
