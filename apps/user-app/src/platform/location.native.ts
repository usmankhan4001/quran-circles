import type { LocateResult } from './location';

export type { LocateResult } from './location';

/**
 * Phones need a location module (and its permission text in the store listing) before they can
 * ask; until then the map's "Use my location" button is not shown there and the person's chosen
 * area stands in, as it does everywhere else.
 */
export function canLocate(): boolean {
  return false;
}

export function locate(): Promise<LocateResult> {
  return Promise.resolve({ ok: false, reason: 'unavailable' });
}
