import { describe, expect, it } from 'vitest';
import { geocodeVenue } from './geocode';

const reply = (status: string, lat: number, lng: number, type: string, partial = false) =>
  Response.json({
    status,
    results: [
      { geometry: { location: { lat, lng }, location_type: type }, partial_match: partial },
    ],
  });

/** First call is the address, second is the city. */
const sequence = (...responses: (() => Response)[]) => {
  const urls: string[] = [];
  let i = 0;
  const fetchImpl = (async (url: URL) => {
    urls.push(String(url));
    return responses[i++]!();
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
};

describe('geocodeVenue', () => {
  it('accepts an exact street match near the city', async () => {
    const { fetchImpl } = sequence(
      () => reply('OK', 31.52, 74.36, 'ROOFTOP'),
      () => reply('OK', 31.55, 74.34, 'APPROXIMATE'),
    );
    expect(await geocodeVenue('House 1', 'Lahore', { key: 'k', fetchImpl })).toEqual({
      ok: true,
      point: { lat: 31.52, lng: 74.36 },
      locationType: 'ROOFTOP',
    });
  });
  it('accepts an interpolated match', async () => {
    const { fetchImpl } = sequence(
      () => reply('OK', 31.52, 74.36, 'RANGE_INTERPOLATED'),
      () => reply('OK', 31.55, 74.34, 'APPROXIMATE'),
    );
    expect((await geocodeVenue('House 1', 'Lahore', { key: 'k', fetchImpl })).ok).toBe(true);
  });
  it('lists an approximate or partial match for review, with a candidate, and does not accept it', async () => {
    for (const [type, partial] of [
      ['APPROXIMATE', false],
      ['ROOFTOP', true],
      ['GEOMETRIC_CENTER', false],
    ] as const) {
      const { fetchImpl } = sequence(
        () => reply('OK', 31.52, 74.36, type, partial),
        () => reply('OK', 31.55, 74.34, 'APPROXIMATE'),
      );
      expect(await geocodeVenue('x', 'Lahore', { key: 'k', fetchImpl })).toEqual({
        ok: false,
        reason: 'low_confidence',
        candidate: { lat: 31.52, lng: 74.36 },
      });
    }
  });
  it('rejects a result far from the stated city', async () => {
    const { fetchImpl } = sequence(
      () => reply('OK', 24.86, 67.0, 'ROOFTOP'),
      () => reply('OK', 32.08, 72.67, 'APPROXIMATE'),
    );
    expect(await geocodeVenue('x', 'Sargodha', { key: 'k', fetchImpl })).toMatchObject({
      ok: false,
      reason: 'far_from_city',
    });
  });
  it('rejects a result outside Pakistan', async () => {
    const { fetchImpl } = sequence(() => reply('OK', 51.5, -0.12, 'ROOFTOP'));
    expect(await geocodeVenue('x', 'Lahore', { key: 'k', fetchImpl })).toMatchObject({
      ok: false,
      reason: 'outside_pakistan',
    });
  });
  it('reports no key, no result, a denied key and a network failure', async () => {
    expect(await geocodeVenue('x', 'Lahore', { key: undefined })).toEqual({
      ok: false,
      reason: 'no_key',
    });
    const none = sequence(() => Response.json({ status: 'ZERO_RESULTS', results: [] }));
    expect(await geocodeVenue('x', 'Lahore', { key: 'k', fetchImpl: none.fetchImpl })).toEqual({
      ok: false,
      reason: 'no_result',
    });
    const denied = sequence(() => Response.json({ status: 'REQUEST_DENIED', results: [] }));
    expect(await geocodeVenue('x', 'Lahore', { key: 'k', fetchImpl: denied.fetchImpl })).toEqual({
      ok: false,
      reason: 'denied',
    });
    const down = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await geocodeVenue('x', 'Lahore', { key: 'k', fetchImpl: down })).toEqual({
      ok: false,
      reason: 'request_failed',
    });
  });
  it('restricts the search to Pakistan and sends only the address and city', async () => {
    const { fetchImpl, urls } = sequence(
      () => reply('OK', 31.52, 74.36, 'ROOFTOP'),
      () => reply('OK', 31.55, 74.34, 'APPROXIMATE'),
    );
    await geocodeVenue('House 1', 'Lahore', { key: 'k', fetchImpl });
    expect(urls[0]).toContain('components=country%3APK');
    expect(urls[0]).toContain('House+1%2C+Lahore%2C+Pakistan');
  });
});
