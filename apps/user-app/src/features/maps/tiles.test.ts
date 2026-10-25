import { describe, expect, it } from 'vitest';
import { fitView, panBy, project, tileUrl, tilesFor, toView, unproject } from './tiles';

const LAHORE = { lat: 31.5204, lng: 74.3587 };
const RAWALPINDI = { lat: 33.5651, lng: 73.0169 };

describe('tile map arithmetic', () => {
  it('projects and unprojects to the same place', () => {
    const back = unproject(project(LAHORE, 12), 12);
    expect(back.lat).toBeCloseTo(LAHORE.lat, 6);
    expect(back.lng).toBeCloseTo(LAHORE.lng, 6);
  });

  it('puts Lahore on the tile OpenStreetMap numbers 11/1447/834', () => {
    const p = project(LAHORE, 11);
    expect([Math.floor(p.x / 256), Math.floor(p.y / 256)]).toEqual([1447, 834]);
  });

  it('covers the whole view with tiles and centres the middle one on the centre', () => {
    const tiles = tilesFor(LAHORE, 11, 360, 280);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.left)) + 256).toBeGreaterThanOrEqual(360);
    expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.top)) + 256).toBeGreaterThanOrEqual(280);
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length);
    const centre = toView(LAHORE, LAHORE, 11, 360, 280);
    expect(centre).toEqual({ x: 180, y: 140 });
  });

  it('wraps tile addresses around the date line and stops at the poles', () => {
    const wrapped = tilesFor({ lat: 0, lng: 179.9 }, 3, 600, 300);
    expect(wrapped.every((t) => t.x >= 0 && t.x < 8)).toBe(true);
    const north = tilesFor({ lat: 85, lng: 0 }, 3, 300, 600);
    expect(north.every((t) => t.y >= 0 && t.y < 8)).toBe(true);
    expect(tilesFor(LAHORE, 11, 0, 0)).toEqual([]);
  });

  it('drags the map the way the finger moves', () => {
    const next = panBy(LAHORE, 11, 100, 0);
    expect(next.lng).toBeLessThan(LAHORE.lng);
    const down = panBy(LAHORE, 11, 0, 100);
    expect(down.lat).toBeGreaterThan(LAHORE.lat);
  });

  it('fits every place in the view', () => {
    const fit = fitView([LAHORE, RAWALPINDI], 360, 280)!;
    for (const place of [LAHORE, RAWALPINDI]) {
      const p = toView(place, fit.center, fit.zoom, 360, 280);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(360);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(280);
    }
  });

  it('opens one place close up, and nothing at all as no view', () => {
    expect(fitView([LAHORE], 360, 280)).toEqual({ center: expect.anything(), zoom: 14 });
    expect(fitView([], 360, 280)).toBeNull();
  });

  it('fills the address template', () => {
    expect(tileUrl('https://t/{z}/{x}/{y}.png', { z: 11, x: 1429, y: 859 })).toBe(
      'https://t/11/1429/859.png',
    );
    expect(tileUrl('https://{s}.t/{z}/{x}/{y}.png', { z: 1, x: 0, y: 1 })).toBe(
      'https://b.t/1/0/1.png',
    );
  });
});
