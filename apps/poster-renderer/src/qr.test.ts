import { describe, expect, it } from 'vitest';
import { parseDeepLink } from '@qc/contracts';
import { makeQr, QUIET_ZONE } from './qr';
import { deepLinkOf } from './renderer';
import { RenderRequest } from './input';
import { SAMPLE_SESSION, sampleRequest } from './sample';

describe('makeQr', () => {
  it('draws a square code with a four-module quiet zone on white', () => {
    const qr = makeQr('https://example.org/register/0f6f1e4a-7c2b-4d1e-9a3b-5c8d2e1f4a60');
    const n = qr.matrix.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect((n - 17) % 4).toBe(0); // a real QR version size
    expect(qr.matrix.every((row) => row.length === n)).toBe(true);
    // Finder patterns in three corners.
    for (const [r, c] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ] as const) {
      expect(qr.matrix[r]?.[c]).toBe(true);
      expect(qr.matrix[r + 3]?.[c + 3]).toBe(true);
    }
    const size = n + 2 * QUIET_ZONE;
    expect(qr.svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    expect(qr.svg).toContain('<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>');
    expect(qr.svg).not.toMatch(/href|url\(/);
  });

  it('is deterministic', () => {
    expect(makeQr('qurancircles://session/x').svg).toBe(makeQr('qurancircles://session/x').svg);
  });
});

describe('deep link on the poster', () => {
  it('opens registration by default, in the contract format, and parses back', () => {
    const request = RenderRequest.parse(sampleRequest());
    const web = deepLinkOf(request, 'https://example.org');
    expect(web).toBe(`https://example.org/register/${SAMPLE_SESSION.sessionId}`);
    expect(parseDeepLink(web)).toEqual({ type: 'register', sessionId: SAMPLE_SESSION.sessionId });
    const app = deepLinkOf(request);
    expect(app).toBe(`qurancircles://register/${SAMPLE_SESSION.sessionId}`);
    expect(parseDeepLink(app)).toEqual({ type: 'register', sessionId: SAMPLE_SESSION.sessionId });
  });

  it('can open the session page instead', () => {
    const request = RenderRequest.parse(
      sampleRequest({ fields: { title: { en: 'A', ur: 'ب' }, qrTarget: 'session' } }),
    );
    expect(parseDeepLink(deepLinkOf(request, 'https://example.org'))).toEqual({
      type: 'session',
      sessionId: SAMPLE_SESSION.sessionId,
    });
  });
});
