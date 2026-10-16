import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, type AdminCircle, type ApiClient } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { findCircle } from './find';

type Page = { items: AdminCircle[]; nextCursor: string | null };

function apiWith(pages: Page[]) {
  const list = vi.fn(async ({ query }: { query: { cursor?: string } }) => {
    const index = query.cursor ? Number(query.cursor) : 0;
    return pages[index]!;
  });
  return { api: { adminCircles: { list } } as unknown as ApiClient, list };
}

describe('findCircle', () => {
  it('finds a circle on the first page', async () => {
    const { api, list } = apiWith([{ items: fx.circles, nextCursor: null }]);
    expect((await findCircle(api, fx.circles[1]!.id)).id).toBe(fx.circles[1]!.id);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('follows the cursor to later pages', async () => {
    const { api, list } = apiWith([
      { items: [fx.circles[0]!], nextCursor: '1' },
      { items: [fx.circles[1]!], nextCursor: null },
    ]);
    expect((await findCircle(api, fx.circles[1]!.id)).id).toBe(fx.circles[1]!.id);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('throws not_found when no page has it', async () => {
    const { api } = apiWith([{ items: [fx.circles[0]!], nextCursor: null }]);
    await expect(findCircle(api, 'missing')).rejects.toMatchObject({ code: 'not_found' });
    await expect(findCircle(api, 'missing')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('gives up after ten pages instead of looping', async () => {
    const forever: Page = { items: [], nextCursor: '0' };
    const { api, list } = apiWith([forever]);
    await expect(findCircle(api, 'missing')).rejects.toMatchObject({ code: 'not_found' });
    expect(list).toHaveBeenCalledTimes(10);
  });
});
