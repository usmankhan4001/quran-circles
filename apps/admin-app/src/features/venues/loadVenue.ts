import type { ApiClient, Venue } from '@qc/contracts';
import { isErrorCode } from '../../api/errors';

/**
 * One venue for a staff screen. The public call reads published venues; a draft or archived one
 * comes from the admin list (there is no admin read of one venue). Not found in either: the
 * public call's `not_found` is thrown.
 */
export async function loadVenue(api: ApiClient, venueId: string): Promise<Venue> {
  try {
    return await api.venues.get({ params: { venueId } });
  } catch (error) {
    if (!isErrorCode(error, 'not_found')) throw error;
    const page = await api.adminVenues.list({ query: { includeArchived: 'true', limit: 100 } });
    const found = page.items.find((v) => v.id === venueId);
    if (!found) throw error;
    return found;
  }
}
