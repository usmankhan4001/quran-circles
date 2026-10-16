import { describe, expect, it } from 'vitest';
import type { ContentApi } from '../account/api';
import { juzStart } from '../meta/juz';
import { SURAHS } from '../meta/surahs';
import { createReaderPrefsStore, DEFAULT_READER_PREFS } from '../quran/prefs';
import { createReadingPositionService } from '../reading/position';
import { createMemoryStorage } from '../storage/memory';
import { createFakeAccountServer } from '../test/fakeAccount';
import { createClock } from '../test/fakes';
import { createBookmarkService } from './service';
import {
  createV1Importer,
  IMPORT_MAX_ITEMS,
  mapV1Bookmarks,
  mapV1LastRead,
  readV1,
  summariseV1,
  V1_KEYS,
} from './v1Import';

describe('mapV1Bookmarks', () => {
  it('maps "surah:ayah" strings to ayah bookmarks', () => {
    const result = mapV1Bookmarks('["2:255","36:1","114:6"]');
    expect(result).toEqual({
      items: [
        { kind: 'ayah', surah: 2, ayah: 255 },
        { kind: 'ayah', surah: 36, ayah: 1 },
        { kind: 'ayah', surah: 114, ayah: 6 },
      ],
      invalid: 0,
      duplicates: 0,
    });
  });

  it('counts and drops duplicates and entries that are not an ayah that exists', () => {
    const result = mapV1Bookmarks('["2:255","2:255","1:8","0:1","x","",5,null,"3:7"]');
    expect(result.items.map((i) => `${i.surah}:${i.ayah}`)).toEqual(['2:255', '3:7']);
    expect(result.duplicates).toBe(1);
    expect(result.invalid).toBe(6);
  });

  it('gives an empty result for missing, malformed or wrongly shaped data', () => {
    for (const raw of [null, '', 'not json', '{"a":1}', '"2:255"', '42']) {
      expect(mapV1Bookmarks(raw).items).toEqual([]);
    }
  });
});

describe('mapV1LastRead', () => {
  it('turns a surah into its first ayah', () => {
    expect(mapV1LastRead('{"mode":"surah","id":18,"name":"x","detail":"y"}')).toEqual({
      surah: 18,
      ayah: 1,
    });
  });

  it('turns a juz into the ayah it starts at', () => {
    expect(mapV1LastRead('{"mode":"juz","id":2,"name":"Juz 2","detail":""}')).toEqual(juzStart(2));
  });

  it('rejects anything else', () => {
    for (const raw of [
      null,
      'nope',
      '{"mode":"surah","id":115}',
      '{"mode":"juz","id":31}',
      '{"mode":"page","id":1}',
      '{"mode":"surah","id":"2"}',
    ]) {
      expect(mapV1LastRead(raw)).toBeNull();
    }
  });
});

describe('summariseV1 and readV1', () => {
  it('reads the four V1 keys through any reader, sync or async', async () => {
    const data: Record<string, string> = {
      [V1_KEYS.bookmarks]: '["1:1"]',
      [V1_KEYS.fontSize]: '3.6',
      [V1_KEYS.showTranslation]: 'false',
    };
    const raw = await readV1((key) => Promise.resolve(data[key] ?? null));
    expect(raw).toEqual({
      bookmarks: '["1:1"]',
      lastRead: null,
      fontSize: '3.6',
      showTranslation: 'false',
    });
    expect(summariseV1(raw)).toMatchObject({
      fontSizeRem: 3.6,
      showTranslation: false,
      lastRead: null,
    });
  });

  it('survives a reader that throws', async () => {
    const raw = await readV1(() => {
      throw new Error('SecurityError');
    });
    expect(raw).toEqual({ bookmarks: null, lastRead: null, fontSize: null, showTranslation: null });
  });

  it('ignores a nonsense font size and translation flag', () => {
    expect(
      summariseV1({ bookmarks: null, lastRead: null, fontSize: 'big', showTranslation: '"yes"' }),
    ).toMatchObject({ fontSizeRem: null, showTranslation: null });
    expect(
      summariseV1({ bookmarks: null, lastRead: null, fontSize: '-2', showTranslation: null })
        .fontSizeRem,
    ).toBeNull();
  });
});

const setup = (v1: Record<string, string> = {}, signedIn = true) => {
  const clock = createClock();
  const server = createFakeAccountServer(clock.now);
  const storage = createMemoryStorage();
  let current: ContentApi | null = signedIn ? server.api : null;
  const getApi = () => current;
  const bookmarks = createBookmarkService({ storage, getApi, now: clock.now });
  const readingPosition = createReadingPositionService({ storage, getApi, now: clock.now });
  const prefs = createReaderPrefsStore(storage);
  const importer = createV1Importer({
    readV1: (key) => v1[key] ?? null,
    storage,
    getApi,
    bookmarks,
    readingPosition,
    prefs,
    now: clock.now,
  });
  return {
    server,
    storage,
    bookmarks,
    readingPosition,
    prefs,
    importer,
    signIn: () => {
      current = server.api;
    },
  };
};

const v1Data: Record<string, string> = {
  [V1_KEYS.bookmarks]: '["2:255","18:10","18:10","bad"]',
  [V1_KEYS.lastRead]: '{"mode":"surah","id":18,"name":"Al-Kahf","detail":"18 . 110 Ayahs"}',
  [V1_KEYS.fontSize]: '3.6',
  [V1_KEYS.showTranslation]: 'false',
};

describe('V1 importer', () => {
  it('has nothing to offer when the browser holds no V1 data', async () => {
    expect(await setup().importer.status()).toEqual({ state: 'none' });
  });

  it('offers the import when V1 data exists and the person is signed in', async () => {
    expect(await setup(v1Data).importer.status()).toEqual({
      state: 'available',
      bookmarks: 2,
      hasLastRead: true,
    });
  });

  it('waits for sign-in when nobody is signed in', async () => {
    const { importer, signIn } = setup(v1Data, false);
    expect(await importer.status()).toMatchObject({ state: 'waiting_for_sign_in', bookmarks: 2 });
    expect(await importer.run()).toEqual({ ok: false, reason: 'signed_out' });
    signIn();
    expect(await importer.status()).toMatchObject({ state: 'available' });
  });

  it('imports the bookmarks into the account and onto the device', async () => {
    const { importer, server, bookmarks } = setup(v1Data);
    const outcome = await importer.run();
    expect(outcome).toMatchObject({ ok: true, imported: 2, skipped: 2 }); // one duplicate, one bad
    expect(server.bookmarks.map((b) => `${b.surah}:${b.ayah}`).sort()).toEqual(['18:10', '2:255']);
    expect((await bookmarks.list()).map((b) => `${b.surah}:${b.ayah}`).sort()).toEqual([
      '18:10',
      '2:255',
    ]);
  });

  it('carries over the last read place and the reader settings', async () => {
    const { importer, readingPosition, prefs } = setup(v1Data);
    const outcome = await importer.run();
    expect(outcome).toMatchObject({ ok: true, positionSet: true });
    expect(await readingPosition.getLocal()).toMatchObject({ surah: 18, ayah: 1 });
    expect(await prefs.load()).toEqual({ showTranslation: false, arabicZoomIndex: 3 });
  });

  it('does not overwrite a reading position the person already has', async () => {
    const { importer, readingPosition } = setup(v1Data);
    await readingPosition.save(55, 4);
    const outcome = await importer.run();
    expect(outcome).toMatchObject({ ok: true, positionSet: false });
    expect(await readingPosition.getLocal()).toMatchObject({ surah: 55, ayah: 4 });
  });

  it('leaves the reader settings alone when V1 had none', async () => {
    const { importer, prefs } = setup({ [V1_KEYS.bookmarks]: '["1:1"]' });
    await importer.run();
    expect(await prefs.load()).toEqual(DEFAULT_READER_PREFS);
  });

  it('happens only once', async () => {
    const { importer, server } = setup(v1Data);
    await importer.run();
    expect(await importer.status()).toEqual({ state: 'none' });
    const before = server.requests.length;
    expect(await importer.status()).toEqual({ state: 'none' });
    expect(server.requests.length).toBe(before);
  });

  it('stays available after a failed attempt and can be repeated safely', async () => {
    const { importer, server } = setup(v1Data);
    server.offline = true;
    expect(await importer.run()).toEqual({ ok: false, reason: 'offline' });
    expect(await importer.status()).toMatchObject({ state: 'available' });
    server.offline = false;
    expect(await importer.run()).toMatchObject({ ok: true, imported: 2 });
    // Running the same import again adds nothing: the endpoint is idempotent.
    const again = await createV1Importer({
      readV1: (key) => v1Data[key] ?? null,
      storage: createMemoryStorage(),
      getApi: () => server.api,
      bookmarks: createBookmarkService({
        storage: createMemoryStorage(),
        getApi: () => server.api,
      }),
      readingPosition: createReadingPositionService({
        storage: createMemoryStorage(),
        getApi: () => server.api,
      }),
    }).run();
    expect(again).toMatchObject({ ok: true, imported: 0, skipped: 4 });
    expect(server.bookmarks).toHaveLength(2);
  });

  it('reports a rejected sign-in and other failures', async () => {
    const a = setup(v1Data);
    a.server.failNext = { status: 401, code: 'token_expired' };
    expect(await a.importer.run()).toEqual({ ok: false, reason: 'signed_out' });
    const b = setup(v1Data);
    b.server.failNext = { status: 400, code: 'validation_failed' };
    expect(await b.importer.run()).toEqual({ ok: false, reason: 'failed' });
  });

  it('can be skipped, and then does not come back', async () => {
    const { importer, server } = setup(v1Data);
    await importer.skip();
    expect(await importer.status()).toEqual({ state: 'none' });
    expect(server.requests).toEqual([]);
    expect(await importer.run()).toMatchObject({ ok: true }); // an explicit run still works
  });

  it('splits more than 500 bookmarks across calls', async () => {
    const valid: string[] = [];
    for (const surah of SURAHS) {
      for (let ayah = 1; ayah <= surah.ayahCount; ayah++) valid.push(`${surah.id}:${ayah}`);
      if (valid.length > IMPORT_MAX_ITEMS + 20) break;
    }
    expect(valid.length).toBeGreaterThan(IMPORT_MAX_ITEMS);
    const { importer, server } = setup({ [V1_KEYS.bookmarks]: JSON.stringify(valid) });
    const outcome = await importer.run();
    expect(outcome).toMatchObject({ ok: true, imported: valid.length });
    expect(server.requests.filter((r) => r === 'POST /v1/me/bookmarks/import')).toHaveLength(2);
  });
});
