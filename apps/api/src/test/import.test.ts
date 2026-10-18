import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { IMPORT_MAX_ROWS, IMPORT_SERVER_ISSUE_CODES, type ImportResult } from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, createSession, outboxRows } from './fixtures';

let h: Harness;
let admin: Actor;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
});

const nil = '00000000-0000-4000-8000-000000000000';
let phoneCounter = 0;
const newPhone = () => `+9230020${String(++phoneCounter).padStart(5, '0')}`;

type Kind = 'venues' | 'sessions' | 'coordinators';
const run = (kind: Kind, as: Actor | null, rows: unknown[], dryRun = false) =>
  h.api(
    kind === 'venues'
      ? 'adminImport.venues'
      : kind === 'sessions'
        ? 'adminImport.sessions'
        : 'adminImport.coordinators',
    { ...(as ? { as } : {}), body: { dryRun, rows } },
  );
const result = (res: { json<T>(): T }) => res.json<ImportResult>();
const statuses = (r: ImportResult) => r.rows.map((row) => row.status);
const codes = (r: ImportResult, index: number) => r.rows[index]?.issues.map((i) => i.code) ?? [];
const importAudits = async () => (await auditRows(h)).filter((r) => r.action.startsWith('import.'));

const venueRow = (over: Record<string, unknown> = {}) => ({
  cityId: h.world.cityA.id,
  areaId: h.world.cityA.areaId,
  name: { en: 'Imported Masjid' },
  address: { en: '5 Road' },
  lat: 31.5,
  lng: 74.3,
  ...over,
});

const sessionRow = (over: Record<string, unknown> = {}) => ({
  kind: 'recurring',
  venueId: h.world.venueA1,
  program: 'circles',
  title: { en: 'Imported circle' },
  section: 'family',
  language: 'en',
  localStartTime: '19:00',
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  startsOn: '2026-10-19',
  ...over,
});

const coordinatorRow = (over: Record<string, unknown> = {}) => ({
  role: 'venue_coordinator',
  venueId: h.world.venueA1,
  phone: newPhone(),
  ...over,
});

describe('importing venues', () => {
  it('checks every row on a dry run and writes nothing', async () => {
    const res = await run(
      'venues',
      admin,
      [venueRow(), venueRow({ name: { en: 'Second Masjid' } }), { name: 'not a venue' }],
      true,
    );
    expect(res.status).toBe(200);
    const r = result(res);
    expect(r).toMatchObject({
      dryRun: true,
      applied: false,
      counts: { created: 2, duplicate: 0, invalid: 1 },
    });
    expect(statuses(r)).toEqual(['created', 'created', 'invalid']);
    expect(r.rows[2]?.issues.length).toBeGreaterThan(0);
    expect(await h.db.select().from(schema.venues)).toHaveLength(3);
    expect(await importAudits()).toEqual([]);
  });

  it('applies every new row in one go, with one audit row that holds only counts', async () => {
    const res = await run('venues', admin, [
      venueRow(),
      venueRow({ name: { en: 'Venue A1' } }), // already there
      venueRow({ name: { en: 'imported masjid' } }), // repeated above, other case
      venueRow({ cityId: h.world.cityB.id, areaId: h.world.cityB.areaId, name: { en: 'B Hall' } }),
    ]);
    const r = result(res);
    expect(r).toMatchObject({ applied: true, counts: { created: 2, duplicate: 2, invalid: 0 } });
    expect(statuses(r)).toEqual(['created', 'duplicate', 'duplicate', 'created']);
    const names = (await h.db.select().from(schema.venues)).map((v) => v.nameEn).sort();
    expect(names).toEqual(['B Hall', 'Imported Masjid', 'Venue A1', 'Venue A2', 'Venue B1']);
    const audits = await importAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'import.venues',
      actorUserId: admin.userId,
      entityType: 'import',
      scopeType: 'national',
      meta: { kind: 'venues', created: 2, duplicate: 2, invalid: 0 },
    });
    expect(JSON.stringify(audits)).not.toContain('Imported Masjid');
  });

  it('writes nothing at all when one row is invalid', async () => {
    const res = await run('venues', admin, [
      venueRow(),
      venueRow({ name: { en: 'Area elsewhere' }, areaId: h.world.cityB.areaId }),
      venueRow({ name: { en: 'No city' }, cityId: nil }),
    ]);
    const r = result(res);
    expect(r.applied).toBe(false);
    expect(statuses(r)).toEqual(['created', 'invalid', 'invalid']);
    expect(codes(r, 1)).toEqual(['area_not_in_city']);
    expect(codes(r, 2)).toContain('invalid_reference');
    expect(await h.db.select().from(schema.venues)).toHaveLength(3);
    expect(await importAudits()).toEqual([]);
  });

  it('decides each row by the caller scope: a city coordinator imports into their city only', async () => {
    const city = await h.cityCoordinator(h.world.cityA.id);
    const r = result(
      await run(
        'venues',
        city,
        [venueRow(), venueRow({ cityId: h.world.cityB.id, areaId: h.world.cityB.areaId })],
        true,
      ),
    );
    expect(statuses(r)).toEqual(['created', 'invalid']);
    expect(r.rows[1]?.issues).toEqual([{ path: 'cityId', code: 'forbidden' }]);
    // An unknown city reads as forbidden to someone who cannot act there, never as unknown.
    expect(codes(result(await run('venues', city, [venueRow({ cityId: nil })], true)), 0)).toEqual([
      'forbidden',
    ]);
  });

  it('refuses callers with no qualifying role at all', async () => {
    expect(
      (await run('venues', await h.venueCoordinator(h.world.venueA1), [venueRow()])).status,
    ).toBe(403);
    expect((await run('venues', await h.person(), [venueRow()])).status).toBe(403);
    expect((await run('venues', null, [venueRow()])).status).toBe(401);
  });

  it('refuses an empty list or one over the limit as a whole', async () => {
    expect((await run('venues', admin, [])).status).toBe(400);
    const tooMany = Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => ({}));
    expect((await run('venues', admin, tooMany)).status).toBe(400);
  });
});

describe('importing sessions', () => {
  it('creates sessions with their occurrences, skipping duplicates', async () => {
    await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Existing',
      localStartTime: '18:00',
      daysOfWeek: [5],
    });
    const res = await run('sessions', admin, [
      sessionRow(),
      sessionRow({ title: { en: 'existing' }, localStartTime: '18:00', daysOfWeek: [5] }),
      sessionRow({ daysOfWeek: [3, 1] }), // same days in another order: a repeat
      sessionRow({
        kind: 'one_off',
        date: '2026-11-01',
        daysOfWeek: undefined,
        startsOn: undefined,
      }),
    ]);
    const r = result(res);
    expect(r).toMatchObject({ applied: true, counts: { created: 2, duplicate: 2, invalid: 0 } });
    const rows = await h.db.select().from(schema.sessions);
    expect(rows.map((s) => s.titleEn).sort()).toEqual([
      'Existing',
      'Imported circle',
      'Imported circle',
    ]);
    const imported = rows.find((s) => s.kind === 'recurring' && s.titleEn === 'Imported circle');
    const occurrences = await h.db
      .select()
      .from(schema.occurrences)
      .where(eq(schema.occurrences.sessionId, imported!.id));
    expect(occurrences.length).toBeGreaterThan(0);
    const audits = await importAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'import.sessions',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { kind: 'sessions', created: 2, duplicate: 2, invalid: 0 },
    });
  });

  it('reports bad references row by row and writes nothing', async () => {
    const r = result(
      await run('sessions', admin, [
        sessionRow(),
        sessionRow({ venueId: nil }),
        sessionRow({ circleId: nil }),
        sessionRow({ seasonId: nil }),
        sessionRow({ endsOn: '2026-10-01' }),
      ]),
    );
    expect(r.applied).toBe(false);
    expect(statuses(r)).toEqual(['created', 'invalid', 'invalid', 'invalid', 'invalid']);
    expect(codes(r, 1)).toEqual(['invalid_reference']);
    expect(codes(r, 2)).toEqual(['invalid_reference']);
    expect(codes(r, 3)).toEqual(['invalid_reference']);
    expect(codes(r, 4)).toEqual(['invalid_range']);
    expect(await h.db.select().from(schema.sessions)).toHaveLength(0);
  });

  it('lets a venue coordinator import at their venue only', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const r = result(
      await run('sessions', coordinator, [
        sessionRow(),
        sessionRow({ venueId: h.world.venueA2 }),
        sessionRow({ venueId: nil }),
      ]),
    );
    expect(statuses(r)).toEqual(['created', 'invalid', 'invalid']);
    expect(codes(r, 1)).toEqual(['forbidden']);
    expect(codes(r, 2)).toEqual(['forbidden']);
    expect(await h.db.select().from(schema.sessions)).toHaveLength(0);

    const city = await h.cityCoordinator(h.world.cityA.id);
    const cityResult = result(
      await run(
        'sessions',
        city,
        [sessionRow({ venueId: h.world.venueA2 }), sessionRow({ venueId: h.world.venueB1 })],
        true,
      ),
    );
    expect(statuses(cityResult)).toEqual(['created', 'invalid']);
    expect((await run('sessions', await h.person(), [sessionRow()])).status).toBe(403);
  });
});

describe('importing coordinators', () => {
  it('creates invites, queues their invitations after the write, and skips holders and repeats', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const phone = newPhone();
    const res = await run('coordinators', admin, [
      coordinatorRow({ phone }),
      coordinatorRow({ phone }), // repeated in the file
      coordinatorRow({ phone: holder.phone }), // already holds the role there
      coordinatorRow({ role: 'city_coordinator', venueId: undefined, cityId: h.world.cityB.id }),
    ]);
    const r = result(res);
    expect(r).toMatchObject({ applied: true, counts: { created: 2, duplicate: 2, invalid: 0 } });
    const invites = await h.db.select().from(schema.coordinatorInvites);
    expect(invites).toHaveLength(2);
    expect(invites.every((i) => i.status === 'pending' && i.invitedBy === admin.userId)).toBe(true);
    const keys = (await outboxRows(h)).map((o) => o.idempotencyKey);
    for (const i of invites) expect(keys).toContain(`coordinator_invite:${i.id}:whatsapp`);
    const audits = await importAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta).toEqual({ kind: 'coordinators', created: 2, duplicate: 2, invalid: 0 });
    expect(JSON.stringify(audits)).not.toContain(phone);
    expect(h.logs.join('\n')).not.toContain(phone);

    // Sending the same file again finds everything already invited.
    const again = result(await run('coordinators', admin, [coordinatorRow({ phone })]));
    expect(statuses(again)).toEqual(['duplicate']);
  });

  it('writes no invite and queues no message when a row is invalid or on a dry run', async () => {
    const r = result(
      await run('coordinators', admin, [
        coordinatorRow(),
        coordinatorRow({ venueId: nil }),
        coordinatorRow({ replacesAssignmentId: nil }),
        coordinatorRow({ phone: '0300 1234567' }),
      ]),
    );
    expect(statuses(r)).toEqual(['created', 'invalid', 'invalid', 'invalid']);
    expect(codes(r, 1)).toEqual(['invalid_reference']);
    expect(codes(r, 2)).toEqual(['invalid_reference']);
    expect(await h.db.select().from(schema.coordinatorInvites)).toHaveLength(0);
    expect(await outboxRows(h)).toHaveLength(0);

    const dry = result(await run('coordinators', admin, [coordinatorRow()], true));
    expect(dry).toMatchObject({ dryRun: true, applied: false, counts: { created: 1 } });
    expect(await h.db.select().from(schema.coordinatorInvites)).toHaveLength(0);
    expect(await outboxRows(h)).toHaveLength(0);
  });

  it('stores a handover on an imported invite', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await h.db
      .select()
      .from(schema.roleAssignments)
      .where(eq(schema.roleAssignments.userId, holder.userId));
    const r = result(
      await run('coordinators', admin, [coordinatorRow({ replacesAssignmentId: old!.id })]),
    );
    expect(r.applied).toBe(true);
    const [invite] = await h.db.select().from(schema.coordinatorInvites);
    expect(invite?.replacesAssignmentId).toBe(old!.id);
  });

  it('follows the role rules row by row for every kind of caller', async () => {
    const rows = [
      coordinatorRow({ venueId: h.world.venueA2 }),
      coordinatorRow({ venueId: h.world.venueB1 }),
      coordinatorRow({ role: 'city_coordinator', venueId: undefined, cityId: h.world.cityA.id }),
      coordinatorRow({ role: 'national_admin', venueId: undefined }),
    ];
    const city = await h.cityCoordinator(h.world.cityA.id);
    expect(statuses(result(await run('coordinators', admin, rows, true)))).toEqual([
      'created',
      'created',
      'created',
      'created',
    ]);
    const cityResult = result(await run('coordinators', city, rows, true));
    expect(statuses(cityResult)).toEqual(['created', 'invalid', 'invalid', 'invalid']);
    expect([1, 2, 3].map((i) => codes(cityResult, i))).toEqual([
      ['forbidden'],
      ['forbidden'],
      ['forbidden'],
    ]);
    expect(
      (await run('coordinators', await h.venueCoordinator(h.world.venueA1), rows, true)).status,
    ).toBe(403);
    expect((await run('coordinators', await h.person(), rows, true)).status).toBe(403);
    expect((await run('coordinators', null, rows, true)).status).toBe(401);
  });
});

describe('issue codes and races (contract rc.3)', () => {
  const zodCodes = new Set([
    'invalid_type',
    'invalid_format',
    'too_small',
    'too_big',
    'invalid_value',
    'invalid_union',
    'unrecognized_keys',
    'custom',
  ]);

  it('reports only codes the contract lists, with invalid_range for a backwards session range', async () => {
    const r = result(
      await run(
        'sessions',
        admin,
        [
          sessionRow({ endsOn: '2026-10-18' }), // the day before startsOn
          sessionRow({ endsOn: '2026-10-19', title: { en: 'One day only' } }), // same day: fine
          sessionRow({ venueId: nil }),
          sessionRow({ localStartTime: 'soon' }),
        ],
        true,
      ),
    );
    expect(statuses(r)).toEqual(['invalid', 'created', 'invalid', 'invalid']);
    expect(r.rows[0]?.issues).toEqual([{ path: 'endsOn', code: 'invalid_range' }]);
    const server = new Set<string>(IMPORT_SERVER_ISSUE_CODES);
    for (const row of r.rows) {
      for (const i of row.issues) {
        expect(server.has(i.code) || zodCodes.has(i.code), i.code).toBe(true);
      }
    }
  });

  /** Makes every insert into `table` fail as a unique index would, as if someone else won a race. */
  async function withRace(table: string, work: () => Promise<void>) {
    await h.pg.exec(`
      CREATE OR REPLACE FUNCTION qc_test_race() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'raced' USING ERRCODE = 'unique_violation'; END $$;
      CREATE TRIGGER qc_test_race BEFORE INSERT ON ${table}
        FOR EACH ROW EXECUTE FUNCTION qc_test_race();
    `);
    try {
      await work();
    } finally {
      await h.pg.exec(`DROP TRIGGER qc_test_race ON ${table}; DROP FUNCTION qc_test_race();`);
    }
  }

  const expectConflict = (res: { status: number; json<T>(): T }) => {
    expect(res.status).toBe(409);
    const body = res.json<{ error: { code: string; issues?: unknown } }>();
    expect(body.error.code).toBe('conflict');
    expect(body.error.issues).toBeUndefined();
  };

  it('refuses a venue import that races another write with conflict, and writes nothing', async () => {
    await withRace('venues', async () => {
      // The dry run writes nothing, so it cannot race.
      expect(result(await run('venues', admin, [venueRow()], true)).counts.created).toBe(1);
      expectConflict(await run('venues', admin, [venueRow(), venueRow({ name: { en: 'Other' } })]));
    });
    expect(
      await h.db.select().from(schema.venues).where(eq(schema.venues.nameEn, 'Imported Masjid')),
    ).toHaveLength(0);
    expect(await importAudits()).toHaveLength(0);
    // Sending the file again once the race is over works.
    expect(result(await run('venues', admin, [venueRow()])).applied).toBe(true);
  });

  it('refuses a session import that races another write with conflict, and writes nothing', async () => {
    await withRace('sessions', async () => {
      expectConflict(await run('sessions', admin, [sessionRow()]));
    });
    expect(await h.db.select().from(schema.sessions)).toHaveLength(0);
    expect(await importAudits()).toHaveLength(0);
  });

  it('refuses a coordinator import that races another write with conflict, and queues no message', async () => {
    await withRace('coordinator_invites', async () => {
      expectConflict(await run('coordinators', admin, [coordinatorRow()]));
    });
    expect(await h.db.select().from(schema.coordinatorInvites)).toHaveLength(0);
    expect(await outboxRows(h)).toHaveLength(0);
    expect(await importAudits()).toHaveLength(0);
  });
});

describe('invitation ceilings (SEC-03)', () => {
  type ErrorBody = { error: { code: string; issues?: { path: string; code: string }[] } };
  const issuesOf = (res: { json<T>(): T }) => res.json<ErrorBody>().error.issues ?? [];

  it('refuses a coordinator file over the per-import ceiling as a whole, dry run or not', async () => {
    const rows = Array.from({ length: 101 }, () => coordinatorRow());
    for (const dryRun of [true, false]) {
      const res = await run('coordinators', admin, rows, dryRun);
      expect(res.status).toBe(400);
      expect(res.json<ErrorBody>().error.code).toBe('validation_failed');
      expect(issuesOf(res)).toEqual([{ path: 'rows', code: 'too_big' }]);
    }
    expect(await h.db.select().from(schema.coordinatorInvites)).toHaveLength(0);
    expect(await outboxRows(h)).toHaveLength(0);
    // Venue and session files keep the contract's own maximum.
    expect(
      (
        await run(
          'venues',
          admin,
          Array.from({ length: 101 }, () => venueRow()),
          true,
        )
      ).status,
    ).toBe(200);
  });

  it('caps the invitations one person sends in a day, across imports and single invites', async () => {
    const tight = await createHarness({
      config: { inviteLimits: { perImport: 3, perActorPerDay: 5 } },
    });
    try {
      await tight.reset();
      const boss = await tight.nationalAdmin();
      const row = () => ({
        role: 'venue_coordinator',
        venueId: tight.world.venueA1,
        phone: newPhone(),
      });
      const imp = (as: Actor, rows: unknown[], dryRun = false) =>
        tight.api('adminImport.coordinators', { as, body: { dryRun, rows } });
      const invite = (as: Actor) => tight.api('adminRoles.invite', { as, body: row() });
      const invites = async () => tight.db.select().from(schema.coordinatorInvites);
      const messages = async () =>
        (await tight.db.select().from(schema.messageOutbox)).filter(
          (o) => o.templateKey === 'coordinator_invite',
        );

      expect((await imp(boss, [row(), row(), row(), row()], true)).status).toBe(400);
      expect(result(await imp(boss, [row(), row(), row()])).counts.created).toBe(3);

      // Three more would make six: refused whole, dry run included, nothing written or queued.
      for (const dryRun of [true, false]) {
        const over = await imp(boss, [row(), row(), row()], dryRun);
        expect(over.status).toBe(400);
        expect(issuesOf(over)).toEqual([{ path: 'rows', code: 'invite_daily_limit' }]);
      }
      expect(await invites()).toHaveLength(3);
      expect(await messages()).toHaveLength(3);

      // Rows that are duplicates send nothing, so they do not count.
      const firstPhone = (await invites())[0]!.phoneE164;
      const dup = { role: 'venue_coordinator', venueId: tight.world.venueA1, phone: firstPhone };
      expect(result(await imp(boss, [dup, row()])).counts).toMatchObject({
        created: 1,
        duplicate: 1,
      });
      expect((await invite(boss)).status).toBe(201);

      // Five sent: the next single invite is refused, naming the field and not the number.
      const sixth = await invite(boss);
      expect(sixth.status).toBe(400);
      expect(issuesOf(sixth)).toEqual([{ path: 'phone', code: 'invite_daily_limit' }]);
      expect(await messages()).toHaveLength(5);
      expect(tight.logs.join('\n')).not.toContain(firstPhone);

      // Another person's allowance is their own; the window passing frees the first one.
      const other = await tight.nationalAdmin();
      expect((await invite(other)).status).toBe(201);
      tight.clock.advanceDays(1);
      expect((await invite(boss)).status).toBe(201);
    } finally {
      await tight.close();
    }
  });

  it('lets parallel invites and imports by one person take the last slots only once', async () => {
    // The check and the insert run in one transaction under the inviter's advisory lock, so
    // requests on different API processes count one after the other. (PGlite runs one transaction
    // at a time anyway; on Postgres the lock is what keeps the count exact.)
    const tight = await createHarness({
      config: { inviteLimits: { perImport: 3, perActorPerDay: 4 } },
    });
    try {
      await tight.reset();
      const boss = await tight.nationalAdmin();
      const row = () => ({
        role: 'venue_coordinator',
        venueId: tight.world.venueA1,
        phone: newPhone(),
      });
      expect((await tight.api('adminRoles.invite', { as: boss, body: row() })).status).toBe(201);
      expect((await tight.api('adminRoles.invite', { as: boss, body: row() })).status).toBe(201);
      // Two slots left; five single invites and a two-row import arrive at once.
      const answers = await Promise.all([
        ...Array.from({ length: 5 }, () =>
          tight.api('adminRoles.invite', { as: boss, body: row() }),
        ),
        tight.api('adminImport.coordinators', {
          as: boss,
          body: { dryRun: false, rows: [row(), row()] },
        }),
      ]);
      const sent = await tight.db
        .select()
        .from(schema.coordinatorInvites)
        .where(eq(schema.coordinatorInvites.invitedBy, boss.principal.userId!));
      expect(sent).toHaveLength(4);
      const refused = answers.filter((a) => a.status === 400);
      expect(refused.length).toBeGreaterThanOrEqual(4);
      for (const a of refused) {
        expect(issuesOf(a)[0]?.code).toBe('invite_daily_limit');
      }
    } finally {
      await tight.close();
    }
  });

  it('holds every role to the ceiling in its own scope, and refuses the rest as before', async () => {
    const tight = await createHarness({
      config: { inviteLimits: { perImport: 2, perActorPerDay: 2 } },
    });
    try {
      await tight.reset();
      const row = (venueId = tight.world.venueA1) => ({
        role: 'venue_coordinator',
        venueId,
        phone: newPhone(),
      });
      const imp = (as: Actor | null, rows: unknown[], dryRun = false) =>
        tight.api('adminImport.coordinators', {
          ...(as ? { as } : {}),
          body: { dryRun, rows },
        });
      for (const who of [
        await tight.nationalAdmin(),
        await tight.cityCoordinator(tight.world.cityA.id),
      ]) {
        expect((await imp(who, [row(), row(), row()], true)).status).toBe(400);
        expect(result(await imp(who, [row(), row()])).counts.created).toBe(2);
        const over = await imp(who, [row()]);
        expect(issuesOf(over)).toEqual([{ path: 'rows', code: 'invite_daily_limit' }]);
      }
      // An out-of-scope row is still invalid row by row, and is not counted as an invite.
      const fresh = await tight.cityCoordinator(tight.world.cityA.id);
      const mixed = result(await imp(fresh, [row(), row(tight.world.venueB1)], true));
      expect(statuses(mixed)).toEqual(['created', 'invalid']);
      // No qualifying role, or no account: refused before any ceiling.
      expect((await imp(await tight.venueCoordinator(tight.world.venueA1), [row()])).status).toBe(
        403,
      );
      expect((await imp(await tight.person(), [row()])).status).toBe(403);
      expect((await imp(null, [row()])).status).toBe(401);
    } finally {
      await tight.close();
    }
  });
});
