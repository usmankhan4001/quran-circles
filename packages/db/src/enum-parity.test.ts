import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ACCOUNT_STATUSES,
  AGE_BANDS,
  BOOKMARK_KINDS,
  CIRCLE_REQUEST_STATUSES,
  CIRCLE_STATUSES,
  CONSENT_CHANNELS,
  CONSENT_PURPOSES,
  CONTENT_STATUSES,
  COST_CATEGORIES,
  DEVICE_PLATFORMS,
  INVITE_STATUSES,
  LOCALES,
  MESSAGE_CHANNELS,
  OCCURRENCE_STATUSES,
  OTP_CHANNELS,
  OUTBOX_STATUSES,
  PORTION_KINDS,
  POSTER_FORMATS,
  POSTER_STATUSES,
  PRIOR_READING,
  PROGRAMS,
  PUSH_PROVIDERS,
  REGISTRATION_STATUSES,
  ROLES,
  SCOPE_TYPES,
  SECTIONS,
  SESSION_KINDS,
  SESSION_STATUSES,
  TEMPLATE_STATUSES,
  UPDATE_KINDS,
  VENUE_STATUSES,
} from '@qc/contracts';
import {
  CHECK_VIOLATION,
  allTables,
  buildWorld,
  createMigratedDb,
  nextPhone,
  violation,
  type TestDb,
} from './test/helpers';

const tables = allTables;

/** Which contract vocabulary each enum column must use. Adding an enum column means adding a line. */
const EXPECTED: ReadonlyArray<readonly [table: string, column: string, values: readonly string[]]> =
  [
    ['venues', 'status', VENUE_STATUSES],
    ['programs', 'key', PROGRAMS],
    ['circles', 'language', LOCALES],
    ['circles', 'section', SECTIONS],
    ['circles', 'status', CIRCLE_STATUSES],
    ['sessions', 'kind', SESSION_KINDS],
    ['sessions', 'section', SECTIONS],
    ['sessions', 'language', LOCALES],
    ['sessions', 'status', SESSION_STATUSES],
    ['occurrences', 'status', OCCURRENCE_STATUSES],
    ['occurrences', 'recap_locale', LOCALES],
    ['users', 'locale', LOCALES],
    ['users', 'status', ACCOUNT_STATUSES],
    ['profiles', 'age_band', AGE_BANDS],
    ['profiles', 'prior_reading', PRIOR_READING],
    ['profiles', 'preferred_language', LOCALES],
    ['role_assignments', 'role', ROLES],
    ['role_assignments', 'scope_type', SCOPE_TYPES],
    ['devices', 'platform', DEVICE_PLATFORMS],
    ['devices', 'provider', PUSH_PROVIDERS],
    ['devices', 'locale', LOCALES],
    ['otp_challenges', 'channel', OTP_CHANNELS],
    ['otp_challenges', 'locale', LOCALES],
    ['coordinator_invites', 'role', ROLES],
    ['coordinator_invites', 'scope_type', SCOPE_TYPES],
    ['coordinator_invites', 'status', INVITE_STATUSES],
    ['registrations', 'section', SECTIONS],
    ['registrations', 'status', REGISTRATION_STATUSES],
    ['consents', 'channel', CONSENT_CHANNELS],
    ['consents', 'purpose', CONSENT_PURPOSES],
    ['circle_progress', 'kind', PORTION_KINDS],
    ['circle_requests', 'section', SECTIONS],
    ['circle_requests', 'language', LOCALES],
    ['circle_requests', 'status', CIRCLE_REQUEST_STATUSES],
    ['bookmarks', 'kind', BOOKMARK_KINDS],
    ['updates', 'scope_type', SCOPE_TYPES],
    ['updates', 'kind', UPDATE_KINDS],
    ['message_templates', 'channel', MESSAGE_CHANNELS],
    ['message_templates', 'locale', LOCALES],
    ['message_templates', 'cost_category', COST_CATEGORIES],
    ['message_templates', 'status', TEMPLATE_STATUSES],
    ['message_outbox', 'channel', MESSAGE_CHANNELS],
    ['message_outbox', 'locale', LOCALES],
    ['message_outbox', 'status', OUTBOX_STATUSES],
    ['message_outbox', 'cost_category', COST_CATEGORIES],
    ['posters', 'format', POSTER_FORMATS],
    ['posters', 'locale', LOCALES],
    ['posters', 'status', POSTER_STATUSES],
    ['content_pages', 'status', CONTENT_STATUSES],
    ['audit_log', 'scope_type', SCOPE_TYPES],
  ];

/** The quoted literals in a CHECK definition, e.g. 'a'::text, 'b'::text. */
const literalsOf = (definition: string) =>
  [...definition.matchAll(/'([^']*)'::text/g)].map((m) => m[1]!);

let test: TestDb;
beforeAll(async () => {
  test = await createMigratedDb();
});

interface CheckRow {
  tbl: string;
  conname: string;
  def: string;
}

async function checksInDb(): Promise<CheckRow[]> {
  const { rows } = await test.exec.query<CheckRow>(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'c'`,
  );
  return rows;
}

describe('enum parity: contract vocabularies against database CHECK constraints', () => {
  it('declares a contract vocabulary for every enum column, and no others', () => {
    const declared = tables.flatMap((table) =>
      getTableConfig(table)
        .columns.filter((c) => c.enumValues !== undefined)
        .map((c) => `${getTableName(table)}.${c.name}`),
    );
    expect(declared.sort()).toEqual(EXPECTED.map(([t, c]) => `${t}.${c}`).sort());
  });

  it('uses the intended vocabulary on each Drizzle column', () => {
    for (const [tableName, columnName, values] of EXPECTED) {
      const table = tables.find((t) => getTableName(t) === tableName)!;
      const column = getTableConfig(table).columns.find((c) => c.name === columnName)!;
      expect(column.enumValues, `${tableName}.${columnName}`).toEqual([...values]);
    }
  });

  it('has a CHECK on every enum column whose allowed values equal the contract tuple', async () => {
    const checks = await checksInDb();
    for (const [table, column, values] of EXPECTED) {
      const name = `${table}_${column}_chk`;
      const found = checks.find((c) => c.tbl === table && c.conname === name);
      expect(found, `${name} is missing in the database`).toBeDefined();
      expect(literalsOf(found!.def).sort(), name).toEqual([...values].sort());
    }
  });

  it('has no other value-list CHECKs in the database than the enum columns and the poster formats', async () => {
    const checks = await checksInDb();
    const valueLists = checks
      .filter((c) => /= ANY \(\(?ARRAY\[|<@ ARRAY\[/.test(c.def) && literalsOf(c.def).length > 0)
      .map((c) => c.conname)
      .sort();
    expect(valueLists).toEqual(
      [...EXPECTED.map(([t, c]) => `${t}_${c}_chk`), 'poster_templates_formats_chk'].sort(),
    );
  });

  it('restricts poster template formats to the contract tuple', async () => {
    const checks = await checksInDb();
    const found = checks.find((c) => c.conname === 'poster_templates_formats_chk');
    expect(literalsOf(found!.def).sort()).toEqual([...POSTER_FORMATS].sort());
    const make = await test.pg.query(
      `INSERT INTO poster_templates (key, name_en, name_ur, formats) VALUES ($1, 'n', 'n', $2) RETURNING id`,
      ['tpl-ok', ['story', 'print_a4']],
    );
    expect(make.rows).toHaveLength(1);
    const bad = await violation(
      test.pg.query(
        `INSERT INTO poster_templates (key, name_en, name_ur, formats) VALUES ($1, 'n', 'n', $2)`,
        ['tpl-bad', ['story', 'billboard']],
      ),
    );
    expect(bad).toEqual({ code: CHECK_VIOLATION, constraint: 'poster_templates_formats_chk' });
    const empty = await violation(
      test.pg.query(
        `INSERT INTO poster_templates (key, name_en, name_ur, formats) VALUES ($1, 'n', 'n', '{}')`,
        ['tpl-empty'],
      ),
    );
    expect(empty.constraint).toBe('poster_templates_formats_nonempty_chk');
  });
});

describe('enum parity: the database really accepts the contract values and rejects the rest', () => {
  /** Rows to poke at: [table, id column, id, columns to exercise]. Built in beforeAll. */
  let targets: Array<{ table: string; idColumn: string; id: string; columns: string[] }>;

  beforeAll(async () => {
    const world = await buildWorld(test);
    const user = await world.make.user();
    const insert = async (sql: string, params: unknown[] = []) => {
      const { rows } = await test.pg.query<{ id: string }>(sql, params);
      return rows[0]!.id;
    };
    const occurrence = await world.make.occurrence(world.session.id);
    const circle = await world.make.circle(world.venue.id);
    const registration = await world.make.registration(user.id, world.session.id, world.area.id);
    const update = await insert(
      `INSERT INTO updates (scope_type, kind, title_en, body_en) VALUES ('national', 'announcement', 't', 'b') RETURNING id`,
    );
    const outbox = await insert(
      `INSERT INTO message_outbox (idempotency_key, channel, cost_category) VALUES ('enum-1', 'push', 'free') RETURNING id`,
    );
    const template = await insert(
      `INSERT INTO message_templates (key, channel, locale, body, cost_category)
       VALUES ('enum.tpl', 'whatsapp', 'en', 'b', 'utility') RETURNING id`,
    );
    const device = await insert(
      `INSERT INTO devices (user_id, platform, provider, token, locale) VALUES ($1, 'android', 'fcm', 'tok-enum', 'en') RETURNING id`,
      [user.id],
    );
    const consent = await insert(
      `INSERT INTO consents (user_id, channel, purpose, source) VALUES ($1, 'whatsapp', 'registration_updates', 'test') RETURNING id`,
      [user.id],
    );
    const request = await insert(
      `INSERT INTO circle_requests (user_id, area_id, expires_at) VALUES ($1, $2, now() + interval '30 days') RETURNING id`,
      [user.id, world.area.id],
    );
    const otp = await insert(
      `INSERT INTO otp_challenges (phone_e164, channel, code_hash, expires_at)
       VALUES ($1, 'whatsapp', 'hash', now() + interval '5 minutes') RETURNING id`,
      [nextPhone()],
    );
    const page = await insert(
      `INSERT INTO content_pages (slug, title_en, body_en) VALUES ('enum-page', 't', 'b') RETURNING id`,
    );
    const progress = await insert(
      `INSERT INTO circle_progress (circle_id, kind, label) VALUES ($1, 'para', 'Para 1') RETURNING id`,
      [circle.id],
    );
    targets = [
      { table: 'venues', idColumn: 'id', id: world.venue.id, columns: ['status'] },
      { table: 'programs', idColumn: 'id', id: world.program.id, columns: ['key'] },
      {
        table: 'circles',
        idColumn: 'id',
        id: circle.id,
        columns: ['language', 'section', 'status'],
      },
      {
        table: 'sessions',
        idColumn: 'id',
        id: world.session.id,
        columns: ['section', 'language', 'status'],
      },
      {
        table: 'occurrences',
        idColumn: 'id',
        id: occurrence.id,
        columns: ['status', 'recap_locale'],
      },
      { table: 'users', idColumn: 'id', id: user.id, columns: ['locale', 'status'] },
      {
        table: 'registrations',
        idColumn: 'id',
        id: registration.id,
        columns: ['section', 'status'],
      },
      { table: 'updates', idColumn: 'id', id: update, columns: ['kind'] },
      {
        table: 'message_outbox',
        idColumn: 'id',
        id: outbox,
        columns: ['channel', 'locale', 'status', 'cost_category'],
      },
      {
        table: 'message_templates',
        idColumn: 'id',
        id: template,
        columns: ['channel', 'locale', 'cost_category', 'status'],
      },
      { table: 'devices', idColumn: 'id', id: device, columns: ['platform', 'provider', 'locale'] },
      { table: 'consents', idColumn: 'id', id: consent, columns: ['channel', 'purpose'] },
      {
        table: 'circle_requests',
        idColumn: 'id',
        id: request,
        columns: ['section', 'language', 'status'],
      },
      { table: 'otp_challenges', idColumn: 'id', id: otp, columns: ['channel', 'locale'] },
      { table: 'content_pages', idColumn: 'id', id: page, columns: ['status'] },
      { table: 'circle_progress', idColumn: 'id', id: progress, columns: ['kind'] },
    ];
  });

  it('accepts every contract value and rejects an unknown one, column by column', async () => {
    let exercised = 0;
    for (const { table, idColumn, id, columns } of targets) {
      for (const column of columns) {
        const values = EXPECTED.find(([t, c]) => t === table && c === column)![2];
        const update = (value: string) =>
          test.pg.query(`UPDATE "${table}" SET "${column}" = $1 WHERE "${idColumn}" = $2`, [
            value,
            id,
          ]);
        for (const value of values) {
          await update(value);
          exercised++;
        }
        const rejected = await violation(update('not_a_value'));
        expect(rejected, `${table}.${column}`).toEqual({
          code: CHECK_VIOLATION,
          constraint: `${table}_${column}_chk`,
        });
        // Case and whitespace matter: vocabularies are exact.
        const first = [...values][0]!;
        expect((await violation(update(first.toUpperCase() + ' '))).code).toBe(CHECK_VIOLATION);
      }
    }
    expect(exercised).toBeGreaterThan(80);
  });

  it('lets nullable enum columns stay empty', async () => {
    const circleRequest = targets.find((t) => t.table === 'circle_requests')!;
    await test.pg.query(
      `UPDATE circle_requests SET section = NULL, language = NULL WHERE id = $1`,
      [circleRequest.id],
    );
    const occurrence = targets.find((t) => t.table === 'occurrences')!;
    await test.pg.query(`UPDATE occurrences SET recap_locale = NULL WHERE id = $1`, [
      occurrence.id,
    ]);
  });
});
