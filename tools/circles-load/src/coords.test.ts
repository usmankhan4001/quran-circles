import { describe, expect, it } from 'vitest';
import { parseCoords, inPakistan, distanceKm } from './coords';
import { parseCsv } from './csv';
import { locateVenues, countLocations, type VenueInput } from './locate';
import { resolveLink, type Resolution } from './resolve';

const KHI = { lat: 24.86, lng: 67.0 };

describe('parseCoords', () => {
  it('reads @lat,lng', () => {
    expect(parseCoords('https://www.google.com/maps/place/Synthetic/@31.5204,74.3587,17z')).toEqual(
      {
        lat: 31.5204,
        lng: 74.3587,
      },
    );
  });
  it('prefers the pinned place (!3d!4d) over the map centre', () => {
    expect(
      parseCoords('https://www.google.com/maps/place/X/@31.0,74.0,17z/data=!3d31.5204!4d74.3587'),
    ).toEqual({ lat: 31.5204, lng: 74.3587 });
  });
  it('reads q= and ll= in plain and encoded form', () => {
    expect(parseCoords('https://maps.google.com/?q=33.6844,73.0479')).toEqual({
      lat: 33.6844,
      lng: 73.0479,
    });
    expect(parseCoords('https://maps.google.com/?ll=33.6844%2C73.0479')).toEqual({
      lat: 33.6844,
      lng: 73.0479,
    });
  });
  it('returns null when there are no coordinates, and never guesses', () => {
    expect(parseCoords('https://www.google.com/search?q=Some+Mosque+Lahore')).toBeNull();
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('https://x/@999.1,74.1')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('handles quotes, commas, CRLF and a byte order mark', () => {
    const rows = parseCsv('﻿city,address\r\nLahore,"House 1, Street ""A"""\r\n');
    expect(rows).toEqual([{ city: 'Lahore', address: 'House 1, Street "A"' }]);
  });
});

describe('resolveLink', () => {
  const reply = (status: number, headers: Record<string, string> = {}, body = '') =>
    new Response(body, { status, headers });

  it('follows a short link to a position', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return url.includes('maps.app.goo.gl')
        ? reply(302, { location: 'https://www.google.com/maps/place/X/@31.5204,74.3587,17z' })
        : reply(200);
    }) as unknown as typeof fetch;
    const r = await resolveLink('https://maps.app.goo.gl/abc', { fetchImpl });
    expect(r).toEqual({ ok: true, point: { lat: 31.5204, lng: 74.3587 }, via: 'link' });
    expect(calls).toHaveLength(1);
  });
  it('refuses links to other hosts without contacting them', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return reply(200);
    }) as unknown as typeof fetch;
    expect(await resolveLink('https://evil.example/maps', { fetchImpl })).toEqual({
      ok: false,
      reason: 'not_a_map_link',
    });
    expect(called).toBe(false);
  });
  it('does not follow a redirect off Google', async () => {
    const fetchImpl = (async () =>
      reply(302, { location: 'https://evil.example/x' })) as unknown as typeof fetch;
    expect(await resolveLink('https://maps.app.goo.gl/abc', { fetchImpl })).toEqual({
      ok: false,
      reason: 'not_a_map_link',
    });
  });
  it('reports a search page with no position as unresolved', async () => {
    const fetchImpl = (async (url: string) =>
      url.includes('share.google')
        ? reply(302, { location: 'https://www.google.com/search?q=place' })
        : reply(200, {}, '<html>no position here</html>')) as unknown as typeof fetch;
    expect(await resolveLink('https://share.google/abc', { fetchImpl })).toEqual({
      ok: false,
      reason: 'no_coordinates',
    });
  });
  it('refuses a position outside Pakistan', async () => {
    const fetchImpl = (async () =>
      reply(302, {
        location: 'https://www.google.com/maps/@51.5,-0.12,15z',
      })) as unknown as typeof fetch;
    expect(await resolveLink('https://maps.app.goo.gl/abc', { fetchImpl })).toEqual({
      ok: false,
      reason: 'outside_pakistan',
    });
  });
  it('reports a network failure', async () => {
    const fetchImpl = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await resolveLink('https://maps.app.goo.gl/abc', { fetchImpl })).toEqual({
      ok: false,
      reason: 'fetch_failed',
    });
  });
});

describe('locateVenues', () => {
  const ok = (lat: number, lng: number): Resolution => ({
    ok: true,
    point: { lat, lng },
    via: 'link',
  });
  const venue = (
    key: string,
    city: string,
    link: string,
    given: VenueInput['given'] = null,
  ): VenueInput => ({
    venueKey: key,
    city,
    given,
    links: link ? [link] : [],
  });

  it('flags a pin far from the rest of its city (a Karachi address filed under Sargodha)', () => {
    const venues = [
      venue('a', 'Sargodha', 'l1'),
      venue('b', 'Sargodha', 'l2'),
      venue('c', 'Sargodha', 'l3'),
      venue('d', 'Sargodha', 'l4'),
    ];
    const res = new Map<string, Resolution>([
      ['l1', ok(32.08, 72.67)],
      ['l2', ok(32.09, 72.68)],
      ['l3', ok(32.07, 72.66)],
      ['l4', ok(KHI.lat, KHI.lng)],
    ]);
    const locs = locateVenues(venues, res);
    expect(locs.map((l) => l.status)).toEqual(['resolved', 'resolved', 'resolved', 'outlier']);
    expect(locs[3]!.reason).toBe('far_from_city');
    expect(locs[3]!.offsetKm).toBeGreaterThan(900);
  });
  it('never invents a pin: no file coordinates and no link means needs_geocoding', () => {
    const [loc] = locateVenues([venue('a', 'Lahore', '')], new Map());
    expect(loc).toMatchObject({
      status: 'needs_geocoding',
      point: null,
      source: 'none',
      reason: 'no_link',
    });
  });
  it('uses coordinates from the file before any link', () => {
    const [loc] = locateVenues(
      [venue('a', 'Lahore', 'l', { lat: 31.5, lng: 74.3 })],
      new Map([['l', ok(1, 1)]]),
    );
    expect(loc).toMatchObject({
      status: 'resolved',
      source: 'file',
      point: { lat: 31.5, lng: 74.3 },
    });
  });
  it('tries the next link when the first does not resolve', () => {
    const v: VenueInput = { venueKey: 'a', city: 'Lahore', given: null, links: ['bad', 'good'] };
    const res = new Map<string, Resolution>([
      ['bad', { ok: false, reason: 'no_coordinates' }],
      ['good', ok(31.5, 74.3)],
    ]);
    expect(locateVenues([v], res)[0]!.status).toBe('resolved');
  });
  it('does not trust one pin shared by two venues with different addresses', () => {
    const venues = [venue('a', 'Arifwala', 'l1'), venue('b', 'Sahiwal', 'l1')];
    const res = new Map<string, Resolution>([['l1', ok(30.3, 73.1)]]);
    const locs = locateVenues(venues, res);
    expect(locs.map((l) => l.status)).toEqual(['needs_geocoding', 'needs_geocoding']);
    expect(locs[0]!.reason).toBe('shared_pin');
  });
  it('counts by source', () => {
    const venues = [
      venue('a', 'X', '', { lat: 31.5, lng: 74.3 }),
      venue('b', 'X', 'l'),
      venue('c', 'X', 'm'),
      venue('d', 'X', ''),
    ];
    const res = new Map<string, Resolution>([
      ['l', ok(31.51, 74.31)],
      ['m', { ok: false, reason: 'no_coordinates' }],
    ]);
    const c = countLocations(locateVenues(venues, res));
    expect(c).toMatchObject({
      venues: 4,
      resolvedFromFile: 1,
      resolvedFromLinks: 1,
      needsGeocoding: 2,
      outliers: 0,
    });
  });
});

describe('helpers', () => {
  it('knows Pakistan from London', () => {
    expect(inPakistan(KHI)).toBe(true);
    expect(inPakistan({ lat: 51.5, lng: -0.12 })).toBe(false);
  });
  it('measures a known distance', () => {
    expect(Math.round(distanceKm(KHI, { lat: 31.52, lng: 74.36 }))).toBeGreaterThan(1000);
  });
});
