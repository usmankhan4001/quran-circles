import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index';
import { createMigratedDb, factory, type TestDb } from '../test/helpers';
import {
  countPendingUpdatePushes,
  fanOutPendingUpdatePushes,
  reachUserIds,
  updatePushKey,
  writeUpdatePushes,
} from './index';

/** The worker's half of `notify: true` (migration 0011), against a real migrated database. */

const NOW = new Date('2026-10-18T14:00:00Z');

let test: TestDb;
let f: ReturnType<typeof factory>;
let tokens = 0;

beforeAll(async () => {
  test = await createMigratedDb();
  f = factory(test);
});

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  await test.pg.exec(
    'TRUNCATE message_outbox, updates, devices, follows, users, venues, areas, cities, provinces RESTART IDENTITY CASCADE',
  );
  await test.pg.exec('DROP TRIGGER IF EXISTS outbox_fail ON message_outbox');
});

async function person(
  opts: { locale?: 'en' | 'ur'; devices?: number; revoked?: boolean; suspended?: boolean } = {},
) {
  const user = await f.user({
    locale: opts.locale ?? 'en',
    status: opts.suspended ? 'suspended' : 'active',
  });
  for (let i = 0; i < (opts.devices ?? 1); i++) {
    await test.db.insert(schema.devices).values({
      userId: user.id,
      platform: 'android',
      provider: 'fcm',
      token: `fake-fcm-token-${++tokens}`,
      locale: user.locale,
      revokedAt: opts.revoked ? NOW : null,
    });
  }
  return user;
}

async function update(v: Partial<schema.NewUpdateRow> = {}) {
  const author = await f.user();
  const [row] = await test.db
    .insert(schema.updates)
    .values({
      scopeType: 'national',
      authorId: author.id,
      kind: 'announcement',
      titleEn: 'Taraweeh tonight',
      titleUr: 'آج تراویح',
      bodyEn: 'Synthetic announcement.',
      bodyUr: null,
      publishAt: NOW,
      pushPendingSince: NOW,
      ...v,
    })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

const outbox = () => test.db.select().from(schema.messageOutbox);
const pendingOf = async (id: string) =>
  (
    await test.db
      .select({ at: schema.updates.pushPendingSince })
      .from(schema.updates)
      .where(eq(schema.updates.id, id))
  )[0]?.at ?? null;

describe('fanOutPendingUpdatePushes', () => {
  it('writes one push per active person with a working device, and clears the mark', async () => {
    const en = await person();
    const ur = await person({ locale: 'ur' });
    const twoPhones = await person({ devices: 2 });
    await person({ devices: 0 });
    await person({ revoked: true });
    await person({ suspended: true });
    const u = await update();

    expect(await countPendingUpdatePushes(test.db)).toBe(1);
    expect(await fanOutPendingUpdatePushes(test.db, { webBase: 'https://qc.test' })).toEqual({
      updates: 1,
      rows: 3,
    });
    expect(await pendingOf(u.id)).toBeNull();
    expect(await countPendingUpdatePushes(test.db)).toBe(0);

    const rows = await outbox();
    expect(rows.map((r) => r.recipientUserId).sort()).toEqual([en.id, ur.id, twoPhones.id].sort());
    for (const r of rows) {
      expect(r).toMatchObject({
        idempotencyKey: updatePushKey(u.id, r.recipientUserId!),
        channel: 'push',
        status: 'queued',
        costCategory: 'free',
        updateId: u.id,
        sentBy: u.authorId,
        cityId: null,
        venueId: null,
        recipientPhoneE164: null,
        attempts: 0,
      });
    }
    const byUser = new Map(rows.map((r) => [r.recipientUserId, r.payload]));
    expect(byUser.get(en.id)).toEqual({
      channel: 'push',
      push: {
        title: 'Taraweeh tonight',
        body: 'Synthetic announcement.',
        data: { type: 'update', deepLink: expect.stringContaining(u.id) as string, updateId: u.id },
        collapseKey: `update:${u.id}`,
        ttlSeconds: 6 * 3600,
      },
    });
    // Urdu title where given; the English body where no Urdu body was written.
    expect(byUser.get(ur.id)).toMatchObject({
      push: { title: 'آج تراویح', body: 'Synthetic announcement.' },
    });
  });

  it('is idempotent: a second run, or a run after the mark is set again, writes nothing new', async () => {
    await person();
    await person();
    const u = await update();
    expect(await fanOutPendingUpdatePushes(test.db)).toEqual({ updates: 1, rows: 2 });
    expect(await fanOutPendingUpdatePushes(test.db)).toEqual({ updates: 0, rows: 0 });
    // As if a worker wrote the rows and died before clearing the mark.
    await test.db
      .update(schema.updates)
      .set({ pushPendingSince: NOW })
      .where(eq(schema.updates.id, u.id));
    expect(await fanOutPendingUpdatePushes(test.db)).toEqual({ updates: 1, rows: 0 });
    expect(await outbox()).toHaveLength(2);
  });

  it('writes nothing for updates without the mark', async () => {
    await person();
    await update({ pushPendingSince: null });
    expect(await fanOutPendingUpdatePushes(test.db)).toEqual({ updates: 0, rows: 0 });
    expect(await outbox()).toEqual([]);
  });

  it('takes the oldest pending update first, at most `limit` per call', async () => {
    await person();
    const later = await update({ pushPendingSince: new Date(NOW.getTime() + 60_000) });
    const earlier = await update({ pushPendingSince: NOW });
    expect(await fanOutPendingUpdatePushes(test.db, { limit: 1 })).toEqual({ updates: 1, rows: 1 });
    expect(await pendingOf(earlier.id)).toBeNull();
    expect(await pendingOf(later.id)).not.toBeNull();
    expect(await fanOutPendingUpdatePushes(test.db, { limit: 5 })).toEqual({ updates: 1, rows: 1 });
  });

  it('works through a large reach in chunks', async () => {
    for (let i = 0; i < 7; i++) await person({ locale: i % 2 ? 'ur' : 'en' });
    const u = await update();
    expect(await fanOutPendingUpdatePushes(test.db, { chunkSize: 2 })).toEqual({
      updates: 1,
      rows: 7,
    });
    const keys = (await outbox()).map((r) => r.idempotencyKey);
    expect(new Set(keys).size).toBe(7);
    expect(keys.every((k) => k.startsWith(`update:${u.id}:`))).toBe(true);
  });

  it('rolls an update back whole when a write fails, keeps the mark, and finishes on the next run', async () => {
    const a = await person();
    const b = await person();
    const u = await update();
    // A failure on the second chunk's insert, after the first chunk was written.
    await test.pg.exec(`
      CREATE OR REPLACE FUNCTION outbox_fail() RETURNS trigger AS $$
      BEGIN
        IF NEW.recipient_user_id = '${b.id}' THEN RAISE EXCEPTION 'synthetic failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER outbox_fail BEFORE INSERT ON message_outbox
        FOR EACH ROW EXECUTE FUNCTION outbox_fail();`);
    await expect(fanOutPendingUpdatePushes(test.db, { chunkSize: 1 })).rejects.toThrow();
    expect(await outbox()).toEqual([]);
    expect(await pendingOf(u.id)).not.toBeNull();

    await test.pg.exec('DROP TRIGGER outbox_fail ON message_outbox');
    expect(await fanOutPendingUpdatePushes(test.db, { chunkSize: 1 })).toEqual({
      updates: 1,
      rows: 2,
    });
    expect((await outbox()).map((r) => r.recipientUserId).sort()).toEqual([a.id, b.id].sort());
  });

  it('two workers at once write each update once', async () => {
    for (let i = 0; i < 3; i++) await person();
    await update();
    await update();
    const [x, y] = await Promise.all([
      fanOutPendingUpdatePushes(test.db, { limit: 5 }),
      fanOutPendingUpdatePushes(test.db, { limit: 5 }),
    ]);
    expect(x!.updates + y!.updates).toBe(2);
    expect(x!.rows + y!.rows).toBe(6);
    expect(await outbox()).toHaveLength(6);
  });

  it('a venue update reaches the people connected to the venue, with its city and venue', async () => {
    const province = await f.province();
    const city = await f.city({ provinceId: province.id });
    const area = await f.area(city.id);
    const venue = await f.venue(city.id, area.id);
    const other = await f.venue(city.id, area.id);
    const follower = await person();
    const elsewhere = await person();
    await person();
    await test.db.insert(schema.follows).values([
      { userId: follower.id, venueId: venue.id },
      { userId: elsewhere.id, venueId: other.id },
    ]);
    const u = await update({ scopeType: 'venue', cityId: city.id, venueId: venue.id });
    expect(
      await reachUserIds(test.db, { type: 'venue', venueId: venue.id, cityId: city.id }),
    ).toEqual([follower.id]);
    expect(await fanOutPendingUpdatePushes(test.db)).toEqual({ updates: 1, rows: 1 });
    const [row] = await outbox();
    expect(row).toMatchObject({
      recipientUserId: follower.id,
      cityId: city.id,
      venueId: venue.id,
      updateId: u.id,
    });
  });

  it('writeUpdatePushes reports the reach as well as the new rows', async () => {
    await person();
    await person({ devices: 0 });
    const u = await update({ pushPendingSince: null });
    expect(await writeUpdatePushes(test.db, u)).toEqual({ recipients: 3, rows: 1 });
  });
});
