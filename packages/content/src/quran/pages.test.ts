import { describe, expect, it } from 'vitest';
import { createFakeQuranApi, createClock } from '../test/fakes';
import { createMemoryStorage } from '../storage/memory';
import { createMushafPageSource, isMushafPage, MUSHAF_PAGE_COUNT } from './pages';
import { QuranSourceError } from './types';

// The text here is invented (see ../test/fakes); nothing is real Quran text.

function setup(options: { cache?: boolean } = {}) {
  const api = createFakeQuranApi();
  const storage = createMemoryStorage();
  const clock = createClock();
  const source = createMushafPageSource({
    fetch: api.fetch,
    storage,
    now: clock.now,
    ...(options.cache === undefined ? {} : { cache: options.cache }),
  });
  return { api, storage, source };
}

describe('mushaf pages', () => {
  it('knows the 604 pages of the Madani mushaf', () => {
    expect(MUSHAF_PAGE_COUNT).toBe(604);
    expect(isMushafPage(1)).toBe(true);
    expect(isMushafPage(604)).toBe(true);
    expect(isMushafPage(0)).toBe(false);
    expect(isMushafPage(605)).toBe(false);
    expect(isMushafPage(1.5)).toBe(false);
  });

  it('reads a page: its ayahs in order, with the surah of each', async () => {
    const { source } = setup();
    const page = await source.getPage(2);
    expect(page.page).toBe(2);
    expect(page.fromCache).toBe(false);
    expect(page.ayahs[0]).toMatchObject({ surah: 2, ayah: 1 });
    expect(page.ayahs).toHaveLength(8);
    expect(page.juz).toBe(1);
  });

  it('keeps a page on the device, so the second read needs no network', async () => {
    const { api, source } = setup();
    await source.getPage(3);
    const calls = api.calls.length;
    api.offline = true;
    const again = await source.getPage(3);
    expect(again.fromCache).toBe(true);
    expect(api.calls.length).toBe(calls);
  });

  it('does not keep pages when caching is off (rights not cleared)', async () => {
    const { api, source } = setup({ cache: false });
    await source.getPage(3);
    api.offline = true;
    await expect(source.getPage(3)).rejects.toMatchObject({ code: 'offline' });
  });

  it('says offline when a page was never read and there is no connection', async () => {
    const { api, source } = setup();
    api.offline = true;
    await expect(source.getPage(5)).rejects.toBeInstanceOf(QuranSourceError);
    await expect(source.getPage(5)).rejects.toMatchObject({ code: 'offline' });
  });

  it('refuses a page that does not exist without asking the network', async () => {
    const { api, source } = setup();
    await expect(source.getPage(0)).rejects.toMatchObject({ code: 'not_found' });
    await expect(source.getPage(605)).rejects.toMatchObject({ code: 'not_found' });
    expect(api.calls).toHaveLength(0);
  });

  it('rejects an answer in the wrong shape', async () => {
    const { api, source } = setup();
    api.garbage = true;
    await expect(source.getPage(2)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('reports a server error as unavailable', async () => {
    const { api, source } = setup();
    api.failNextWith = 503;
    await expect(source.getPage(2)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('finds the page an ayah is on, and remembers it', async () => {
    const { api, source } = setup();
    expect(await source.pageOf(18, 60)).toBe(18);
    const calls = api.calls.length;
    expect(await source.pageOf(18, 60)).toBe(18);
    expect(api.calls.length).toBe(calls);
  });

  it('refuses an ayah that does not exist', async () => {
    const { api, source } = setup();
    await expect(source.pageOf(1, 8)).rejects.toMatchObject({ code: 'not_found' });
    await expect(source.pageOf(115, 1)).rejects.toMatchObject({ code: 'not_found' });
    expect(api.calls).toHaveLength(0);
  });
});
