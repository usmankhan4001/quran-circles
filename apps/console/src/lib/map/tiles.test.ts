import { describe, expect, it } from 'vitest';
import { clampZoom, panBy, project, tileUrl, tilesFor, unproject } from './tiles';

const karachi = { lat: 24.8607, lng: 67.0011 };

describe('map maths', () => {
  it('projects and unprojects to the same place', () => {
    const back = unproject(project(karachi, 15), 15);
    expect(back.lat).toBeCloseTo(karachi.lat, 6);
    expect(back.lng).toBeCloseTo(karachi.lng, 6);
  });

  it('moves the centre the opposite way to a drag', () => {
    const east = panBy(karachi, 15, -100, 0);
    expect(east.lng).toBeGreaterThan(karachi.lng);
    const south = panBy(karachi, 15, 0, -100);
    expect(south.lat).toBeLessThan(karachi.lat);
  });

  it('covers the view with tiles and fills the address', () => {
    const tiles = tilesFor(karachi, 15, 560, 340);
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    expect(tilesFor(karachi, 15, 0, 340)).toEqual([]);
    expect(tileUrl('https://t/{z}/{x}/{y}.png', { x: 1, y: 2, z: 3 })).toBe('https://t/3/1/2.png');
  });

  it('keeps zoom inside the allowed range', () => {
    expect(clampZoom(1)).toBe(3);
    expect(clampZoom(40)).toBe(18);
  });
});
