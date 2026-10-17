import type { PosterSourceSnapshot } from '@qc/contracts';
import type { RenderRequestInput } from './input';

/**
 * Synthetic sample data for the sample script and the tests. No real venue, person or session.
 */
export const SAMPLE_SESSION: PosterSourceSnapshot = {
  sessionId: '0f6f1e4a-7c2b-4d1e-9a3b-5c8d2e1f4a60',
  sessionVersion: '2026-10-17T09:00:00.000Z',
  localStartTime: '21:30',
  durationMinutes: 60,
  daysOfWeek: [5],
  startsOn: '2026-10-23',
  endsOn: null,
  timezone: 'Asia/Karachi',
  venue: {
    id: '3b9d6c2e-1a4f-4e8b-8c7d-2f5e6a1b9c30',
    name: { en: 'Al-Noor Sample Masjid', ur: 'مسجد النور (نمونہ)' },
    area: { en: 'Block 7, Sample Town', ur: 'بلاک 7، نمونہ ٹاؤن' },
  },
};

/** A venue with no Urdu name yet: Urdu posters print the English name inside Urdu text. */
export const SAMPLE_SESSION_NO_URDU_VENUE: PosterSourceSnapshot = {
  ...SAMPLE_SESSION,
  sessionId: '6a1c9e2b-4d7f-4a3e-8b1c-9d2e5f7a3b41',
  daysOfWeek: [],
  startsOn: '2026-11-07',
  localStartTime: '10:00',
  venue: {
    id: '8e2a4c6b-3d5f-4b7a-9c1e-4f6a8b2d0e52',
    name: { en: 'Sample Community Hall', ur: null },
    area: null,
  },
};

export const SAMPLE_FIELDS = {
  title: { en: 'Weekly Dars-e-Quran', ur: 'ہفتہ وار درسِ قرآن' },
  details: {
    en: 'Surah Al-Baqarah, verses 1 to 20. Men and women',
    ur: 'سورۃ البقرہ، آیات 1 تا 20۔ مرد و خواتین',
  },
  accent: 'tanzeem',
  qrTarget: 'register',
} as const;

export function sampleRequest(overrides: Partial<RenderRequestInput> = {}): RenderRequestInput {
  return {
    templateId: 'cloud',
    formats: ['story'],
    language: 'en_ur',
    fields: {
      ...SAMPLE_FIELDS,
      title: { ...SAMPLE_FIELDS.title },
      details: { ...SAMPLE_FIELDS.details },
    },
    session: SAMPLE_SESSION,
    ...overrides,
  };
}
