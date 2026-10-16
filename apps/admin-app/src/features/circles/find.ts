import type { AdminCircle, ApiClient } from '@qc/contracts';
import { ApiClientError } from '@qc/contracts';

const MAX_PAGES = 10;

/**
 * The contract lists circles but has no call for one, so the editor pages through the list in
 * scope until it finds the circle. A change request asks for `adminCircles.get`.
 */
export async function findCircle(api: ApiClient, circleId: string): Promise<AdminCircle> {
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await api.adminCircles.list({
      query: { limit: 100, ...(cursor ? { cursor } : {}) },
    });
    const found = res.items.find((c) => c.id === circleId);
    if (found) return found;
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  throw new ApiClientError(404, 'not_found', null);
}
