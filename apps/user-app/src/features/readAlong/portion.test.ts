import { describe, expect, it } from 'vitest';
import { juzStart } from '@qc/content';
import type { Occurrence } from '@qc/contracts';
import { SESSIONS } from '../../test/factories';
import { placeInPortion, portionStart, todaysPortions, type PortionCandidate } from './portion';

const NOW = new Date('2027-02-15T08:00:00Z'); // 13:00 in Pakistan

function occurrence(change: Partial<Occurrence>): Occurrence {
  return {
    id: '00000000-0000-4000-8000-0a0000000001',
    sessionId: SESSIONS.taraweeh.id,
    startsAt: '2027-02-15T15:00:00Z',
    endsAt: '2027-02-15T16:30:00Z',
    status: 'scheduled',
    portion: { kind: 'para', para: 5 },
    portionLabel: null,
    recapNote: null,
    recapLocale: null,
    ...change,
  };
}

const candidate = (
  change: Partial<Occurrence>,
  via: PortionCandidate['via'] = 'registration',
): PortionCandidate => ({ occurrence: occurrence(change), session: SESSIONS.taraweeh, via });

describe('portionStart', () => {
  it('opens a para at its first ayah', () => {
    const start = juzStart(5);
    expect(portionStart({ kind: 'para', para: 5 })).toEqual({
      surah: start.surah,
      ayah: start.ayah,
    });
  });
  it('opens a surah at ayah 1 and a range at its first ayah', () => {
    expect(portionStart({ kind: 'surah', surah: 36 })).toEqual({ surah: 36, ayah: 1 });
    expect(portionStart({ kind: 'ayah_range', surah: 2, fromAyah: 255, toAyah: 257 })).toEqual({
      surah: 2,
      ayah: 255,
    });
  });
  it('has no place for a lesson or a missing portion', () => {
    expect(portionStart({ kind: 'lesson', title: 'Tajweed basics' })).toBeNull();
    expect(portionStart(null)).toBeNull();
  });
});

describe('placeInPortion', () => {
  it('knows the ayahs of a para', () => {
    const start = juzStart(5);
    expect(placeInPortion(start, { kind: 'para', para: 5 })).toBe(true);
    expect(placeInPortion({ surah: 1, ayah: 1 }, { kind: 'para', para: 5 })).toBe(false);
  });
  it('knows a surah and an ayah range', () => {
    expect(placeInPortion({ surah: 36, ayah: 40 }, { kind: 'surah', surah: 36 })).toBe(true);
    expect(placeInPortion({ surah: 37, ayah: 1 }, { kind: 'surah', surah: 36 })).toBe(false);
    const range = { kind: 'ayah_range', surah: 2, fromAyah: 255, toAyah: 257 } as const;
    expect(placeInPortion({ surah: 2, ayah: 256 }, range)).toBe(true);
    expect(placeInPortion({ surah: 2, ayah: 258 }, range)).toBe(false);
    expect(placeInPortion({ surah: 3, ayah: 256 }, range)).toBe(false);
  });
  it('never matches a lesson or no portion', () => {
    expect(placeInPortion({ surah: 1, ayah: 1 }, { kind: 'lesson', title: 'x' })).toBe(false);
    expect(placeInPortion({ surah: 1, ayah: 1 }, null)).toBe(false);
  });
});

describe('todaysPortions', () => {
  it("keeps today's sessions with a place in the Quran, soonest first, registrations first", () => {
    const result = todaysPortions(
      [
        candidate({ id: 'late', startsAt: '2027-02-15T17:00:00Z' }, 'follow'),
        candidate({ id: 'early', startsAt: '2027-02-15T14:00:00Z' }, 'follow'),
        candidate({ id: 'same', startsAt: '2027-02-15T14:00:00Z' }, 'registration'),
      ],
      NOW,
    );
    expect(result.map((p) => p.occurrence.id)).toEqual(['same', 'early', 'late']);
  });

  it('leaves out other days (in Pakistan time), cancelled sessions and lessons', () => {
    const result = todaysPortions(
      [
        candidate({ id: 'tomorrow', startsAt: '2027-02-15T19:30:00Z' }), // 00:30 on the 16th in Pakistan
        candidate({ id: 'yesterday', startsAt: '2027-02-14T15:00:00Z' }),
        candidate({ id: 'cancelled', status: 'cancelled' }),
        candidate({ id: 'lesson', portion: { kind: 'lesson', title: 'Seerah' } }),
        candidate({ id: 'none', portion: null }),
        candidate({ id: 'ok' }),
      ],
      NOW,
    );
    expect(result.map((p) => p.occurrence.id)).toEqual(['ok']);
  });

  it('lists an occurrence once when it is both registered and followed', () => {
    const result = todaysPortions([candidate({}, 'follow'), candidate({}, 'registration')], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]!.via).toBe('registration');
  });
});
