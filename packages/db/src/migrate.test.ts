import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATIONS_DIR,
  MIGRATIONS_TABLE,
  MigrationError,
  listMigrations,
  migrateDown,
  migrateUp,
  migrationStatus,
} from './migrate';
import { parseRollbackArgs } from './cli/args';
import { buildWorld, createEmptyDb, resetDb } from './test/helpers';

// One PGlite for the whole file: booting costs seconds, resetting costs milliseconds.
const shared = createEmptyDb();
/** An empty database: the shared instance with its public schema wiped. */
const freshDb = async () => {
  await resetDb(shared);
  return shared;
};

const publicTables = async (db: ReturnType<typeof createEmptyDb>) => {
  const { rows } = await db.exec.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
};

const publicIndexes = async (db: ReturnType<typeof createEmptyDb>) => {
  const { rows } = await db.exec.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
  );
  return rows.map((r) => r.indexname);
};

/** Writes a migrations directory from `{ "0001_a.up.sql": "...", ... }`. */
function writeMigrations(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'qc-migrations-'));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

describe('migration files', () => {
  it('ships a matching up and down for every numbered migration', () => {
    const migrations = listMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    const files = readdirSync(DEFAULT_MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files).toHaveLength(migrations.length * 2);
    migrations.forEach((m, i) => {
      expect(m.name.startsWith(String(i + 1).padStart(4, '0'))).toBe(true);
      expect(m.checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it('rejects a missing down file', () => {
    const dir = writeMigrations({ '0001_a.up.sql': 'SELECT 1;' });
    expect(() => listMigrations(dir)).toThrow(/no \.down\.sql/);
  });

  it('rejects a missing up file', () => {
    const dir = writeMigrations({ '0001_a.down.sql': 'SELECT 1;' });
    expect(() => listMigrations(dir)).toThrow(/no \.up\.sql/);
  });

  it('rejects gaps and repeated numbers', () => {
    const gap = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      '0003_c.up.sql': 'SELECT 1;',
      '0003_c.down.sql': 'SELECT 1;',
    });
    expect(() => listMigrations(gap)).toThrow(/without gaps/);
    const repeat = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      '0001_b.up.sql': 'SELECT 1;',
      '0001_b.down.sql': 'SELECT 1;',
    });
    expect(() => listMigrations(repeat)).toThrow(/without gaps/);
  });

  it('rejects badly named and empty files', () => {
    expect(() => listMigrations(writeMigrations({ 'init.sql': 'SELECT 1;' }))).toThrow(
      /must be named/,
    );
    expect(() =>
      listMigrations(writeMigrations({ '0001_a.up.sql': '  \n', '0001_a.down.sql': 'SELECT 1;' })),
    ).toThrow(/empty/);
  });

  it('rejects files that manage their own transactions', () => {
    const dir = writeMigrations({
      '0001_a.up.sql': 'BEGIN;\nCREATE TABLE a (id int);\nCOMMIT;',
      '0001_a.down.sql': 'DROP TABLE a;',
    });
    expect(() => listMigrations(dir)).toThrow(/must not manage transactions/);
  });

  it('ignores files that are not SQL', () => {
    const dir = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      'README.txt': 'notes',
    });
    expect(listMigrations(dir).map((m) => m.name)).toEqual(['0001_a']);
  });

  it('gives the same checksum for LF and CRLF files', () => {
    const lf = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;\nSELECT 2;\n',
      '0001_a.down.sql': 'SELECT 1;',
    });
    const crlf = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;\r\nSELECT 2;\r\n',
      '0001_a.down.sql': 'SELECT 1;',
    });
    expect(listMigrations(lf)[0]?.checksum).toBe(listMigrations(crlf)[0]?.checksum);
  });
});

describe('migrate up and down', () => {
  it('applies everything, undoes everything, and applies again cleanly', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);

    expect(await migrateUp(test.exec)).toEqual(names);
    const tablesAfterFirstUp = await publicTables(test);
    const indexesAfterFirstUp = await publicIndexes(test);
    expect(tablesAfterFirstUp).toContain(MIGRATIONS_TABLE);
    expect(tablesAfterFirstUp.length).toBeGreaterThan(30);

    // A second run has nothing to do.
    expect(await migrateUp(test.exec)).toEqual([]);

    expect(await migrateDown(test.exec, { all: true })).toEqual([...names].reverse());
    expect(await publicTables(test)).toEqual([MIGRATIONS_TABLE]);
    // Only the tracking table's own primary key index may remain.
    expect(await publicIndexes(test)).toEqual([`${MIGRATIONS_TABLE}_pkey`]);

    expect(await migrateUp(test.exec)).toEqual(names);
    expect(await publicTables(test)).toEqual(tablesAfterFirstUp);
    expect(await publicIndexes(test)).toEqual(indexesAfterFirstUp);
  });

  it('leaves no functions, types or sequences behind after a full rollback', async () => {
    const test = await freshDb();
    await migrateUp(test.exec);
    await migrateDown(test.exec, { all: true });
    const sequences = await test.exec.query(
      `SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'`,
    );
    const types = await test.exec.query(
      `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd', 'c')
          AND t.typname <> '${MIGRATIONS_TABLE}'`,
    );
    const functions = await test.exec.query(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'`,
    );
    expect(sequences.rows).toEqual([]);
    expect(types.rows).toEqual([]);
    expect(functions.rows).toEqual([]);
  });

  it('undoes each migration on its own, restoring the shape before it', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);
    // shapes[i] is the table list with the first i migrations applied.
    const shapes: string[][] = [[MIGRATIONS_TABLE]];
    for (let i = 1; i <= names.length; i++) {
      await migrateUp(test.exec, { dir: prefixDir(i) });
      shapes.push(await publicTables(test));
    }
    for (let i = names.length; i >= 1; i--) {
      expect(await migrateDown(test.exec)).toEqual([names[i - 1]]);
      expect(await publicTables(test)).toEqual(shapes[i - 1]);
    }
  });

  it('rolls back one step by default and honours steps', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);
    await migrateUp(test.exec);
    expect(await migrateDown(test.exec)).toEqual([names.at(-1)]);
    expect(await migrateDown(test.exec, { steps: 2 })).toEqual(names.slice(-3, -1).reverse());
    expect((await migrationStatus(test.exec)).filter((s) => s.applied)).toHaveLength(
      names.length - 3,
    );
    expect(await migrateDown(test.exec, { steps: 99 })).toHaveLength(names.length - 3);
    expect(await migrateDown(test.exec)).toEqual([]);
  });

  it('refuses invalid rollback options', async () => {
    const test = await freshDb();
    await expect(migrateDown(test.exec, { all: true, steps: 1 })).rejects.toThrow(
      /either steps or all/,
    );
    await expect(migrateDown(test.exec, { steps: 0 })).rejects.toThrow(/at least 1/);
    await expect(migrateDown(test.exec, { steps: 1.5 })).rejects.toThrow(/whole number/);
  });

  it('reports status with applied times', async () => {
    const test = await freshDb();
    expect((await migrationStatus(test.exec)).every((s) => !s.applied)).toBe(true);
    await migrateUp(test.exec);
    const status = await migrationStatus(test.exec);
    expect(status.every((s) => s.applied && s.appliedAt instanceof Date)).toBe(true);
  });

  it('records name, checksum and time for each applied migration', async () => {
    const test = await freshDb();
    await migrateUp(test.exec);
    const { rows } = await test.exec.query<{ name: string; checksum: string; applied_at: Date }>(
      `SELECT name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY name`,
    );
    const files = listMigrations();
    expect(rows.map((r) => r.name)).toEqual(files.map((f) => f.name));
    expect(rows.map((r) => r.checksum)).toEqual(files.map((f) => f.checksum));
    expect(rows.every((r) => r.applied_at instanceof Date)).toBe(true);
  });
});

describe('migration safety', () => {
  const twoTables = {
    '0001_a.up.sql': 'CREATE TABLE a (id int PRIMARY KEY);',
    '0001_a.down.sql': 'DROP TABLE a;',
    '0002_b.up.sql': 'CREATE TABLE b (id int PRIMARY KEY);',
    '0002_b.down.sql': 'DROP TABLE b;',
  };

  it('refuses to run when an applied migration file changed', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    writeFileSync(join(dir, '0001_a.up.sql'), 'CREATE TABLE a (id int PRIMARY KEY, extra int);');
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(/changed after it was applied/);
    await expect(migrateDown(test.exec, { dir })).rejects.toThrow(/changed after it was applied/);
    await expect(migrationStatus(test.exec, { dir })).rejects.toThrow(MigrationError);
    // Nothing was touched.
    expect(await publicTables(test)).toEqual(['a', 'b', MIGRATIONS_TABLE]);
  });

  it('refuses to run when an applied migration lost its file', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    const smaller = writeMigrations({
      '0001_a.up.sql': twoTables['0001_a.up.sql'],
      '0001_a.down.sql': twoTables['0001_a.down.sql'],
    });
    await expect(migrateUp(test.exec, { dir: smaller })).rejects.toThrow(/has no file/);
  });

  it('applies new migrations added after earlier ones were applied', async () => {
    const dir = writeMigrations({
      '0001_a.up.sql': twoTables['0001_a.up.sql'],
      '0001_a.down.sql': twoTables['0001_a.down.sql'],
    });
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    writeFileSync(join(dir, '0002_b.up.sql'), twoTables['0002_b.up.sql']);
    writeFileSync(join(dir, '0002_b.down.sql'), twoTables['0002_b.down.sql']);
    expect(await migrateUp(test.exec, { dir })).toEqual(['0002_b']);
  });

  it('rolls a failing migration back completely and records nothing for it', async () => {
    const dir = writeMigrations({
      ...twoTables,
      '0002_b.up.sql':
        'CREATE TABLE b (id int PRIMARY KEY);\nCREATE TABLE c (id int REFERENCES missing(id));',
    });
    const test = await freshDb();
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(
      /0002_b failed and was rolled back/,
    );
    expect(await publicTables(test)).toEqual(['a', MIGRATIONS_TABLE]);
    const applied = await test.exec.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
    expect(applied.rows).toEqual([{ name: '0001_a' }]);
    // The connection is usable afterwards: fix the file and carry on.
    writeFileSync(join(dir, '0002_b.up.sql'), twoTables['0002_b.up.sql']);
    expect(await migrateUp(test.exec, { dir })).toEqual(['0002_b']);
  });

  it('keeps the migration applied when its down fails', async () => {
    const dir = writeMigrations({ ...twoTables, '0002_b.down.sql': 'DROP TABLE does_not_exist;' });
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    await expect(migrateDown(test.exec, { dir })).rejects.toThrow(
      /0002_b failed and was rolled back/,
    );
    expect((await migrationStatus(test.exec, { dir })).map((s) => s.applied)).toEqual([true, true]);
    expect(await publicTables(test)).toEqual(['a', 'b', MIGRATIONS_TABLE]);
  });

  it('refuses applied migrations that are not a continuous run', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    await test.exec.exec(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = '0001_a'`);
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(/not a continuous run/);
  });
});

describe('migration 0008: change requests of 2026-10-17', () => {
  const NAME = '0008_auth_grace_outbox_legacy_keys';
  const upTo = (count: number) => prefixDir(count);

  it('is the eighth migration', () => {
    expect(listMigrations()[7]?.name).toBe(NAME);
  });

  it('applies on top of 0007 with data in place and keeps that data', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(7) });
    await test.exec.exec(
      `INSERT INTO users (phone_e164, phone_verified_at, display_name) VALUES ('+923000000801', now(), 'Kept');
       INSERT INTO legacy_whatsapp_subscribers (phone_raw) VALUES ('+923000000802');`,
    );
    expect(await migrateUp(test.exec, { dir: upTo(8) })).toEqual([NAME]);
    const users = await test.exec.query<{ display_name: string }>(`SELECT display_name FROM users`);
    expect(users.rows).toEqual([{ display_name: 'Kept' }]);
    const subscribers = await test.exec.query(`SELECT city_id FROM legacy_whatsapp_subscribers`);
    expect(subscribers.rows).toEqual([{ city_id: null }]);
  });

  it('refuses to apply while legacy subscribers hold duplicates or non-E.164 phones', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(7) });
    await test.exec.exec(
      `INSERT INTO legacy_whatsapp_subscribers (phone_raw) VALUES ('+923000000803'), ('+923000000803');`,
    );
    await expect(migrateUp(test.exec, { dir: upTo(8) })).rejects.toThrow(
      /duplicate \(season_tag, phone_raw\)/,
    );
    await test.exec.exec(`DELETE FROM legacy_whatsapp_subscribers WHERE true;
      INSERT INTO legacy_whatsapp_subscribers (phone_raw) VALUES ('0300-0000001');`);
    await expect(migrateUp(test.exec, { dir: upTo(8) })).rejects.toThrow(/not E\.164/);
    // Nothing half-applied: fix the data and it goes through.
    await test.exec.exec(`DELETE FROM legacy_whatsapp_subscribers WHERE true;`);
    expect(await migrateUp(test.exec, { dir: upTo(8) })).toEqual([NAME]);
  });

  it('refuses to roll back while any account has no name, and rolls back once all have one', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(8) });
    await test.exec.exec(
      `INSERT INTO users (phone_e164, phone_verified_at) VALUES ('+923000000804', now());
       INSERT INTO users (phone_e164, phone_verified_at, display_name) VALUES ('+923000000805', now(), 'Named');`,
    );
    await expect(migrateDown(test.exec, { dir: upTo(8) })).rejects.toThrow(
      /1 account\(s\) have no display_name/,
    );
    // Still applied, nothing changed.
    const status = await migrationStatus(test.exec, { dir: upTo(8) });
    expect(status.at(-1)).toMatchObject({ name: NAME, applied: true });
    await test.exec.exec(`UPDATE users SET display_name = 'Now Named' WHERE display_name IS NULL`);
    expect(await migrateDown(test.exec, { dir: upTo(8) })).toEqual([NAME]);
    // The old rules are back: the name is required and may not be blank.
    await expect(
      test.exec.exec(
        `INSERT INTO users (phone_e164, phone_verified_at) VALUES ('+923000000806', now())`,
      ),
    ).rejects.toThrow(/display_name/);
    await expect(
      test.exec.exec(
        `INSERT INTO users (phone_e164, phone_verified_at, display_name) VALUES ('+923000000807', now(), ' ')`,
      ),
    ).rejects.toThrow(/users_display_name_chk/);
  });

  it('adds and removes exactly the columns, constraints and index it promises', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(7) });
    const columns = async () => {
      const { rows } = await test.exec.query<{ c: string }>(
        `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name <> '${MIGRATIONS_TABLE}' ORDER BY 1`,
      );
      return rows.map((r) => r.c);
    };
    const before = await columns();
    await migrateUp(test.exec, { dir: upTo(8) });
    const after = await columns();
    expect(after.filter((c) => !before.includes(c))).toEqual([
      'auth_sessions.previous_refresh_token_hash',
      'auth_sessions.rotated_at',
      'coordinator_invites.replaces_assignment_id',
      'legacy_whatsapp_subscribers.city_id',
      'message_outbox.provider_message_id',
      'message_outbox.venue_id',
      'otp_challenges.locale',
    ]);
    expect(before.filter((c) => !after.includes(c))).toEqual([]);
    await migrateDown(test.exec, { dir: upTo(8) });
    expect(await columns()).toEqual(before);
    const leftovers = await test.exec.query(
      `SELECT conname FROM pg_constraint WHERE conname IN (
         'otp_challenges_locale_chk', 'message_outbox_venue_id_venues_id_fk',
         'legacy_whatsapp_subscribers_season_phone_unique', 'legacy_whatsapp_subscribers_phone_raw_chk',
         'legacy_whatsapp_subscribers_city_id_cities_id_fk', 'coordinator_invites_replaces_assignment_fk')`,
    );
    expect(leftovers.rows).toEqual([]);
    expect(await publicIndexes(test)).not.toContain('message_outbox_provider_message_id_idx');
  });
});

describe('migration 0009: next features (contract 1.0.0-rc.4)', () => {
  const NAME = '0009_reading_ayah_memorisation';
  const upTo = (count: number) => prefixDir(count);
  const NEW_TABLES = ['community_days', 'daily_ayahs', 'memorisation', 'reading_days'];

  const columns = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    const { rows } = await test.exec.query<{ c: string }>(
      `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> '${MIGRATIONS_TABLE}' ORDER BY 1`,
    );
    return rows.map((r) => r.c);
  };
  const purposeCheck = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    const { rows } = await test.exec.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'consents_purpose_chk'`,
    );
    return [...rows[0]!.def.matchAll(/'([^']*)'::text/g)].map((m) => m[1]).sort();
  };

  it('is the ninth migration', () => {
    expect(listMigrations()[8]?.name).toBe(NAME);
  });

  it('applies on top of 0008 with people, profiles and consents in place, and keeps them', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(8) });
    await test.exec.exec(
      `INSERT INTO users (id, phone_e164, phone_verified_at, display_name)
         VALUES ('00000000-0000-4000-8000-0a0000000901', '+923000000901', now(), 'Kept');
       INSERT INTO profiles (user_id, profession) VALUES ('00000000-0000-4000-8000-0a0000000901', 'Teacher');
       INSERT INTO consents (user_id, channel, purpose, source)
         VALUES ('00000000-0000-4000-8000-0a0000000901', 'push', 'session_reminders', 'test');`,
    );
    expect(await migrateUp(test.exec, { dir: upTo(9) })).toEqual([NAME]);
    const profile = await test.exec.query(
      `SELECT profession, daily_goal_unit, daily_goal_amount, memorisation_revise_after_days FROM profiles`,
    );
    expect(profile.rows).toEqual([
      {
        profession: 'Teacher',
        daily_goal_unit: null,
        daily_goal_amount: null,
        memorisation_revise_after_days: null,
      },
    ]);
    const consents = await test.exec.query(`SELECT purpose FROM consents`);
    expect(consents.rows).toEqual([{ purpose: 'session_reminders' }]);
  });

  it('adds exactly the tables and profile columns it promises, and takes them away again', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(8) });
    const tablesBefore = await publicTables(test);
    const columnsBefore = await columns(test);
    const indexesBefore = await publicIndexes(test);
    await migrateUp(test.exec, { dir: upTo(9) });
    expect((await publicTables(test)).filter((t) => !tablesBefore.includes(t))).toEqual(NEW_TABLES);
    const added = (await columns(test)).filter((c) => !columnsBefore.includes(c));
    expect(added.filter((c) => c.startsWith('profiles.'))).toEqual([
      'profiles.daily_goal_amount',
      'profiles.daily_goal_unit',
      'profiles.memorisation_revise_after_days',
    ]);
    expect(
      added.every((c) => c.startsWith('profiles.') || NEW_TABLES.includes(c.split('.')[0]!)),
    ).toBe(true);
    // No column anywhere holds Quran text: picks and logs are numbers only.
    expect(added.filter((c) => /text|translation|arabic/.test(c))).toEqual([]);
    expect(await purposeCheck(test)).toContain('ayah_daily');

    expect(await migrateDown(test.exec, { dir: upTo(9) })).toEqual([NAME]);
    expect(await publicTables(test)).toEqual(tablesBefore);
    expect(await columns(test)).toEqual(columnsBefore);
    expect(await publicIndexes(test)).toEqual(indexesBefore);
    expect(await purposeCheck(test)).toEqual(
      ['announcements', 'registration_updates', 'session_reminders', 'venue_alerts'].sort(),
    );
    const leftovers = await test.exec.query(
      `SELECT conname FROM pg_constraint WHERE conname LIKE 'profiles_daily_goal%'
          OR conname = 'profiles_memorisation_revise_after_days_range_chk'`,
    );
    expect(leftovers.rows).toEqual([]);
  });

  it('rolls back with feature data in place: removes it and the ayah_daily preferences only', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(9) });
    await test.exec.exec(
      `INSERT INTO users (id, phone_e164, phone_verified_at, display_name)
         VALUES ('00000000-0000-4000-8000-0a0000000902', '+923000000902', now(), 'Reader');
       INSERT INTO profiles (user_id, daily_goal_unit, daily_goal_amount)
         VALUES ('00000000-0000-4000-8000-0a0000000902', 'pages', 2);
       INSERT INTO reading_days (user_id, day, source, pages)
         VALUES ('00000000-0000-4000-8000-0a0000000902', '2027-02-15', 'reader', 2);
       INSERT INTO community_days (day, readers, pages) VALUES ('2027-02-15', 1, 2);
       INSERT INTO daily_ayahs (day, scope_type, surah, ayah) VALUES ('2027-02-15', 'national', 2, 255);
       INSERT INTO memorisation (user_id, surah, status)
         VALUES ('00000000-0000-4000-8000-0a0000000902', 1, 'memorised');
       INSERT INTO consents (user_id, channel, purpose, source) VALUES
         ('00000000-0000-4000-8000-0a0000000902', 'push', 'ayah_daily', 'test'),
         ('00000000-0000-4000-8000-0a0000000902', 'push', 'session_reminders', 'test');`,
    );
    expect(await migrateDown(test.exec, { dir: upTo(9) })).toEqual([NAME]);
    const consents = await test.exec.query(`SELECT purpose FROM consents`);
    expect(consents.rows).toEqual([{ purpose: 'session_reminders' }]);
    const users = await test.exec.query(`SELECT display_name FROM users`);
    expect(users.rows).toEqual([{ display_name: 'Reader' }]);
    await expect(
      test.exec.exec(
        `INSERT INTO consents (user_id, channel, purpose, source)
           VALUES ('00000000-0000-4000-8000-0a0000000902', 'push', 'ayah_daily', 'test')`,
      ),
    ).rejects.toThrow(/consents_purpose_chk/);
    // And forward again cleanly.
    expect(await migrateUp(test.exec, { dir: upTo(9) })).toEqual([NAME]);
  });
});

describe('migration 0010: posters (contract 1.0.0-rc.5)', () => {
  const NAME = '0010_posters';
  const upTo = (count: number) => prefixDir(count);
  const columns = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    const { rows } = await test.exec.query<{ c: string }>(
      `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> '${MIGRATIONS_TABLE}' ORDER BY 1`,
    );
    return rows.map((r) => r.c);
  };
  const constraints = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    const { rows } = await test.exec.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid IN ('posters'::regclass, 'poster_templates'::regclass) AND contype IN ('c', 'f', 'u', 'p')
        ORDER BY conname`,
    );
    return rows.map((r) => r.conname);
  };
  /** One template and one poster, made before 0010. Returns the session id. */
  const posterBefore = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    // Places and sessions have not changed since 0009, so the typed factory still fits.
    const world = await buildWorld(test);
    await test.exec.query(
      `INSERT INTO poster_templates (id, key, name_en, name_ur, formats)
         VALUES ('00000000-0000-4000-8000-0a0000001007', 'cloud', 'Cloud', 'ہلکا', '{story}')`,
    );
    await test.exec.query(
      `INSERT INTO posters (template_id, session_id, format, locale, source_snapshot, status, storage_key)
         VALUES ('00000000-0000-4000-8000-0a0000001007', $1, 'story', 'en', '{}', 'ready', 'posters/x.png')`,
      [world.session.id],
    );
    return world.session.id;
  };

  it('is the tenth migration', () => {
    expect(listMigrations()[9]?.name).toBe(NAME);
  });

  it('applies on top of 0009 with posters in place and keeps them, with the new columns empty', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(9) });
    await posterBefore(test);
    expect(await migrateUp(test.exec, { dir: upTo(10) })).toEqual([NAME]);
    const posters = await test.exec.query(
      `SELECT status, storage_key, language, failure_code, alt_text, replaces_poster_id FROM posters`,
    );
    expect(posters.rows).toEqual([
      {
        status: 'ready',
        storage_key: 'posters/x.png',
        language: null,
        failure_code: null,
        alt_text: null,
        replaces_poster_id: null,
      },
    ]);
    const templates = await test.exec.query(`SELECT key, provisional FROM poster_templates`);
    expect(templates.rows).toEqual([{ key: 'cloud', provisional: true }]);
  });

  it('adds exactly the columns and constraints it promises, and takes them away again', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(9) });
    const tablesBefore = await publicTables(test);
    const columnsBefore = await columns(test);
    const constraintsBefore = await constraints(test);
    const indexesBefore = await publicIndexes(test);
    await migrateUp(test.exec, { dir: upTo(10) });
    expect(await publicTables(test)).toEqual(tablesBefore);
    expect((await columns(test)).filter((c) => !columnsBefore.includes(c))).toEqual([
      'poster_templates.provisional',
      'posters.alt_text',
      'posters.failure_code',
      'posters.language',
      'posters.replaces_poster_id',
    ]);
    expect((await constraints(test)).filter((c) => !constraintsBefore.includes(c))).toEqual([
      'posters_alt_text_object_chk',
      'posters_failure_code_chk',
      'posters_failure_code_status_chk',
      'posters_language_chk',
      'posters_language_locale_chk',
      'posters_replaces_poster_id_posters_id_fk',
    ]);
    expect(await publicIndexes(test)).toEqual(indexesBefore);

    expect(await migrateDown(test.exec, { dir: upTo(10) })).toEqual([NAME]);
    expect(await columns(test)).toEqual(columnsBefore);
    expect(await constraints(test)).toEqual(constraintsBefore);
  });

  it('rolls back with rc.5 poster data in place: keeps the posters, drops the new fields', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(9) });
    const sessionId = await posterBefore(test);
    await migrateUp(test.exec, { dir: upTo(10) });
    await test.exec.query(
      `INSERT INTO posters (template_id, session_id, format, locale, language, source_snapshot, status, failure_code)
         VALUES ('00000000-0000-4000-8000-0a0000001007', $1, 'story', 'ur', 'ur_en', '{}', 'failed', 'text_too_long')`,
      [sessionId],
    );
    await test.exec.exec(
      `INSERT INTO posters (template_id, session_id, format, locale, language, source_snapshot, alt_text, replaces_poster_id)
         SELECT template_id, session_id, 'story', 'en', 'en', '{}', '{"en":"Poster"}', id FROM posters WHERE storage_key = 'posters/x.png';`,
    );
    expect(await migrateDown(test.exec, { dir: upTo(10) })).toEqual([NAME]);
    const kept = await test.exec.query<{ n: number }>(`SELECT count(*)::int AS n FROM posters`);
    expect(kept.rows).toEqual([{ n: 3 }]);
    // And forward again cleanly.
    expect(await migrateUp(test.exec, { dir: upTo(10) })).toEqual([NAME]);
  });
});

describe('migration 0011: update push fan-out (load test finding)', () => {
  const NAME = '0011_update_push_fanout';
  const upTo = (count: number) => prefixDir(count);
  const updateColumns = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    const { rows } = await test.exec.query<{ c: string }>(
      `SELECT column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'updates' ORDER BY 1`,
    );
    return rows.map((r) => r.c);
  };

  it('adds the nullable mark and its partial index, and takes them away again', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(10) });
    const tablesBefore = await publicTables(test);
    const columnsBefore = await updateColumns(test);
    const indexesBefore = await publicIndexes(test);
    await migrateUp(test.exec, { dir: upTo(11) });
    expect(await publicTables(test)).toEqual(tablesBefore);
    expect((await updateColumns(test)).filter((c) => !columnsBefore.includes(c))).toEqual([
      'push_pending_since',
    ]);
    expect((await publicIndexes(test)).filter((i) => !indexesBefore.includes(i))).toEqual([
      'updates_push_pending_idx',
    ]);
    const { rows } = await test.exec.query<{ def: string }>(
      `SELECT indexdef AS def FROM pg_indexes WHERE indexname = 'updates_push_pending_idx'`,
    );
    expect(rows[0]?.def).toContain('WHERE (push_pending_since IS NOT NULL)');

    expect(await migrateDown(test.exec, { dir: upTo(11) })).toEqual([NAME]);
    expect(await updateColumns(test)).toEqual(columnsBefore);
    expect(await publicIndexes(test)).toEqual(indexesBefore);
    expect(await migrateUp(test.exec, { dir: upTo(11) })).toEqual([NAME]);
  });
});

describe('migration 0012: occurrence start floor (Gate 5 load test)', () => {
  const NAME = '0012_occurrence_start_floor';
  const upTo = (count: number) => prefixDir(count);
  /** The API's lookup of occurrences longer than a day (`occurrenceStartFloor`), as planned. */
  const floorPlan = async (test: Awaited<ReturnType<typeof freshDb>>) => {
    await test.exec.query('SET enable_seqscan = off');
    try {
      const { rows } = await test.exec.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT min(l.starts_at) FROM occurrences l
          WHERE l.ends_at - l.starts_at > interval '1 day' AND l.ends_at >= now()`,
      );
      return rows.map((r) => r['QUERY PLAN']).join('\n');
    } finally {
      await test.exec.query('RESET enable_seqscan');
    }
  };

  it('is the twelfth migration', () => {
    expect(listMigrations()[11]?.name).toBe(NAME);
  });

  it('applies on top of 0011 with occurrences in place and keeps them', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(11) });
    const world = await buildWorld(test);
    await test.exec.query(
      `INSERT INTO occurrences (session_id, starts_at, ends_at) VALUES
         ($1, '2026-03-01T15:00:00Z', '2026-03-01T16:00:00Z'),
         ($1, '2026-03-02T15:00:00Z', '2026-03-05T15:00:00Z')`,
      [world.session.id],
    );
    const before = await test.exec.query(`SELECT * FROM occurrences ORDER BY starts_at`);
    expect(await migrateUp(test.exec, { dir: upTo(12) })).toEqual([NAME]);
    expect((await test.exec.query(`SELECT * FROM occurrences ORDER BY starts_at`)).rows).toEqual(
      before.rows,
    );
    // Read through the new index (seq scans off): exactly the occurrence longer than a day.
    await test.exec.query('SET enable_seqscan = off');
    try {
      const { rows } = await test.exec.query<{ starts_at: Date }>(
        `SELECT starts_at FROM occurrences WHERE ends_at - starts_at > interval '1 day'`,
      );
      expect(rows.map((r) => new Date(r.starts_at).toISOString())).toEqual([
        '2026-03-02T15:00:00.000Z',
      ]);
    } finally {
      await test.exec.query('RESET enable_seqscan');
    }
  });

  it('adds exactly the partial index the API lookup uses, and takes it away again', async () => {
    const test = await freshDb();
    await migrateUp(test.exec, { dir: upTo(11) });
    const tablesBefore = await publicTables(test);
    const indexesBefore = await publicIndexes(test);
    expect(await floorPlan(test)).not.toContain('occurrences_multiday_starts_idx');
    await migrateUp(test.exec, { dir: upTo(12) });
    expect(await publicTables(test)).toEqual(tablesBefore);
    expect((await publicIndexes(test)).filter((i) => !indexesBefore.includes(i))).toEqual([
      'occurrences_multiday_starts_idx',
    ]);
    const { rows } = await test.exec.query<{ def: string }>(
      `SELECT indexdef AS def FROM pg_indexes WHERE indexname = 'occurrences_multiday_starts_idx'`,
    );
    expect(rows[0]?.def).toContain('(starts_at)');
    expect(rows[0]?.def).toContain("WHERE ((ends_at - starts_at) > '1 day'::interval)");
    // The predicate must match the API's lookup word for word, or Postgres cannot use the index.
    expect(await floorPlan(test)).toContain('occurrences_multiday_starts_idx');

    expect(await migrateDown(test.exec, { dir: upTo(12) })).toEqual([NAME]);
    expect(await publicIndexes(test)).toEqual(indexesBefore);
    expect(await migrateUp(test.exec, { dir: upTo(12) })).toEqual([NAME]);
  });
});

describe('rollback arguments', () => {
  it('defaults to one migration', () => {
    expect(parseRollbackArgs([])).toEqual({ all: false });
  });
  it('reads --all', () => {
    expect(parseRollbackArgs(['--all'])).toEqual({ all: true });
  });
  it('reads --steps in both spellings and -n', () => {
    expect(parseRollbackArgs(['--steps', '3'])).toEqual({ all: false, steps: 3 });
    expect(parseRollbackArgs(['--steps=2'])).toEqual({ all: false, steps: 2 });
    expect(parseRollbackArgs(['-n', '4'])).toEqual({ all: false, steps: 4 });
  });
  it('ignores a bare -- from the package manager', () => {
    expect(parseRollbackArgs(['--', '--all'])).toEqual({ all: true });
  });
  it('rejects bad input', () => {
    expect(() => parseRollbackArgs(['--steps'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--steps', '0'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--steps=abc'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--all', '--steps', '2'])).toThrow(/not both/);
    expect(() => parseRollbackArgs(['--force'])).toThrow(/Unknown argument/);
  });
});

/** A temp directory holding only the first `count` real migrations, so they can be applied one by one. */
function prefixDir(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'qc-prefix-'));
  mkdirSync(dir, { recursive: true });
  for (const migration of listMigrations().slice(0, count)) {
    for (const direction of ['up', 'down'] as const) {
      const file = `${migration.name}.${direction}.sql`;
      writeFileSync(join(dir, file), readFileSync(join(DEFAULT_MIGRATIONS_DIR, file)));
    }
  }
  return dir;
}
