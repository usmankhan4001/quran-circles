import { describe, expect, it } from 'vitest';
import { distanceParts, haversineMetres, nearestMetres } from './distance';

// Synthetic points, not anyone's location.
const A = { lat: 33.6, lng: 73.05 };

describe('haversineMetres', () => {
  it('is zero for the same point', () => {
    expect(haversineMetres(A, A)).toBe(0);
  });

  it('measures one degree of latitude as about 111.2 km', () => {
    expect(haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  it('shrinks a degree of longitude away from the equator', () => {
    const atEquator = haversineMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const at60 = haversineMetres({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(at60).toBeCloseTo(atEquator / 2, -2);
  });

  it('is the same in both directions', () => {
    const B = { lat: 31.52, lng: 74.35 };
    expect(haversineMetres(A, B)).toBeCloseTo(haversineMetres(B, A), 6);
  });

  it('gives a known city-to-city distance (about 270 km between two Punjab points)', () => {
    const d = haversineMetres({ lat: 33.6844, lng: 73.0479 }, { lat: 31.5204, lng: 74.3587 });
    expect(d / 1000).toBeGreaterThan(265);
    expect(d / 1000).toBeLessThan(275);
  });

  it('handles points on opposite sides of the Earth', () => {
    expect(haversineMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(
      Math.PI * 6_371_000,
      0,
    );
  });
});

describe('nearestMetres', () => {
  it('picks the closest point', () => {
    const near = { lat: 33.601, lng: 73.05 };
    const far = { lat: 33.7, lng: 73.05 };
    expect(nearestMetres(A, [far, near])).toBeCloseTo(haversineMetres(A, near), 6);
  });

  it('is null with no points', () => {
    expect(nearestMetres(A, [])).toBeNull();
  });

  it('skips points without usable coordinates', () => {
    const near = { lat: 33.601, lng: 73.05 };
    expect(nearestMetres(A, [{ lat: Number.NaN, lng: 73 }, near])).toBeCloseTo(
      haversineMetres(A, near),
      6,
    );
    expect(nearestMetres(A, [{ lat: Number.NaN, lng: Number.NaN }])).toBeNull();
  });
});

describe('distanceParts', () => {
  it('writes metres under 1 km, to the nearest 10 m', () => {
    expect(distanceParts(0, 'en')).toEqual({ unit: 'metres', value: '10' });
    expect(distanceParts(47, 'en')).toEqual({ unit: 'metres', value: '50' });
    expect(distanceParts(850, 'en')).toEqual({ unit: 'metres', value: '850' });
    expect(distanceParts(994, 'en')).toEqual({ unit: 'metres', value: '990' });
  });

  it('moves to km once the metres round to 1000', () => {
    expect(distanceParts(995, 'en')).toEqual({ unit: 'km', value: '1.0' });
    expect(distanceParts(1000, 'en')).toEqual({ unit: 'km', value: '1.0' });
  });

  it('writes km with one decimal under 10 km', () => {
    expect(distanceParts(1234, 'en')).toEqual({ unit: 'km', value: '1.2' });
    expect(distanceParts(1250, 'en')).toEqual({ unit: 'km', value: '1.3' });
    expect(distanceParts(9940, 'en')).toEqual({ unit: 'km', value: '9.9' });
  });

  it('writes whole km from 10 km, including when one decimal would round up to 10', () => {
    expect(distanceParts(9960, 'en')).toEqual({ unit: 'km', value: '10' });
    expect(distanceParts(10_000, 'en')).toEqual({ unit: 'km', value: '10' });
    expect(distanceParts(12_600, 'en')).toEqual({ unit: 'km', value: '13' });
    expect(distanceParts(270_400, 'en')).toEqual({ unit: 'km', value: '270' });
  });

  it('uses the same digits as the rest of the app in Urdu (Western, by the kit rule)', () => {
    expect(distanceParts(1234, 'ur')).toEqual({ unit: 'km', value: '1.2' });
    expect(distanceParts(850, 'ur')).toEqual({ unit: 'metres', value: '850' });
  });

  it('treats a negative or broken value as the smallest distance', () => {
    expect(distanceParts(-5, 'en')).toEqual({ unit: 'metres', value: '10' });
    expect(distanceParts(Number.NaN, 'en')).toEqual({ unit: 'metres', value: '10' });
  });
});
