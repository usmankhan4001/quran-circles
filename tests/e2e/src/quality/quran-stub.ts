import type { BrowserContext } from '@playwright/test';
import type { NetworkProfile } from './lowend';

/** Ayahs per surah (public metadata, 6236 in all). */
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112,
  78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37,
  35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8,
  8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
const FIRST_NUMBER = AYAH_COUNTS.reduce<number[]>(
  (acc, _n, i) => [...acc, (acc[i] ?? 1) + (AYAH_COUNTS[i] ?? 0)],
  [1],
);

/**
 * Placeholder text of a realistic length. It is not Quran text and not a translation: the tests
 * stay on this machine, and the content lane owns anything that stores the real text. The
 * Arabic-script filler means "sample text" so the right-to-left layout and the Arabic and Urdu
 * fonts are exercised as with the real source.
 */
function filler(edition: string, surah: number, ayah: number): string {
  const words = 18 + ((surah * 7 + ayah * 13) % 40);
  if (edition.startsWith('en.')) {
    return `Sample translation placeholder ${surah}:${ayah}. ${'Lorem ipsum dolor sit amet. '.repeat(Math.ceil(words / 5))}`.trim();
  }
  const word = edition.startsWith('ur.') ? 'نمونہ متن' : 'نص تجريبي';
  return Array.from({ length: words }, () => word).join(' ');
}

function edition(id: string, ayahs: { surah: number; ayah: number }[]): unknown {
  return {
    identifier: id,
    ayahs: ayahs.map(({ surah, ayah }) => ({
      number: (FIRST_NUMBER[surah - 1] ?? 1) + ayah - 1,
      numberInSurah: ayah,
      text: filler(id, surah, ayah),
      surah: { number: surah },
    })),
  };
}

/**
 * Answers the Quran text service (api.alquran.cloud) from this machine with placeholder text, so
 * the reader opens without the internet and its timing reflects only our app. When a network
 * profile is given the answer is delayed by its latency and transfer time, because a request
 * answered here does not go through Chromium's network throttling.
 */
export async function stubQuranSource(
  context: BrowserContext,
  network: NetworkProfile | null = null,
): Promise<void> {
  await context.route('https://api.alquran.cloud/**', async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/').filter(Boolean);
    // v1/surah/{n}/editions/{a,b,c} | v1/ayah/{s}:{a}/editions/{a,b,c} | v1/juz/{n}/{edition}
    let data: unknown = null;
    if (parts[1] === 'surah' && parts[3] === 'editions') {
      const surah = Number(parts[2]);
      const count = AYAH_COUNTS[surah - 1] ?? 0;
      const ayahs = Array.from({ length: count }, (_x, i) => ({ surah, ayah: i + 1 }));
      data = (parts[4] ?? '').split(',').map((id) => edition(id, ayahs));
    } else if (parts[1] === 'ayah' && parts[3] === 'editions') {
      const [s, a] = (parts[2] ?? '').split(':').map(Number);
      data = (parts[4] ?? '')
        .split(',')
        .map((id) => edition(id, [{ surah: s ?? 1, ayah: a ?? 1 }]));
    } else if (parts[1] === 'juz') {
      data = edition(parts[3] ?? 'quran-uthmani', [{ surah: 2, ayah: 1 }]);
    }
    if (data === null) {
      await route.fulfill({ status: 404, json: { code: 404, status: 'NOT FOUND', data: null } });
      return;
    }
    const body = JSON.stringify({ code: 200, status: 'OK', data });
    if (network) {
      // The real service answers gzipped; about a third of the raw size goes over the air.
      const ms = network.latencyMs + (Buffer.byteLength(body) / 3 / network.downloadBps) * 1000;
      await new Promise((done) => setTimeout(done, ms));
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
}
