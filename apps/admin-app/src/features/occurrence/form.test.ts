import { describe, expect, it } from 'vitest';
import type { AdminOccurrence } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import {
  LABEL_MAX,
  RECAP_MAX,
  initialOccurrenceForm,
  isPast,
  validateOccurrence,
  type OccurrenceForm,
} from './form';

const original: AdminOccurrence = {
  ...fx.occurrences[0]!,
  status: 'scheduled',
  portion: { kind: 'para', para: 3 },
  portionLabel: null,
  recapNote: null,
  recapLocale: null,
};
/** The contract defaults `notify` to false, so compare the fields that were actually changed. */
const changed = (result: ReturnType<typeof validateOccurrence>) => {
  const rest: Record<string, unknown> = { ...result.body };
  delete rest.notify;
  return rest;
};

const form = (patch: Partial<OccurrenceForm> = {}): OccurrenceForm => ({
  ...initialOccurrenceForm(original, 'en'),
  ...patch,
});

describe('initialOccurrenceForm', () => {
  it('reads each kind of portion back into the fields', () => {
    expect(initialOccurrenceForm(original, 'en')).toMatchObject({ portionKind: 'para', para: '3' });
    const range = initialOccurrenceForm(
      { ...original, portion: { kind: 'ayah_range', surah: 2, fromAyah: 255, toAyah: 257 } },
      'en',
    );
    expect(range).toMatchObject({
      portionKind: 'ayah_range',
      surah: '2',
      fromAyah: '255',
      toAyah: '257',
    });
    expect(
      initialOccurrenceForm({ ...original, portion: { kind: 'surah', surah: 18 } }, 'en').surah,
    ).toBe('18');
    expect(
      initialOccurrenceForm({ ...original, portion: { kind: 'lesson', title: 'Wudu' } }, 'en')
        .lesson,
    ).toBe('Wudu');
    expect(initialOccurrenceForm({ ...original, portion: null }, 'en').portionKind).toBe('none');
  });

  it('uses the language of the person for a new recap and marks a cancelled date', () => {
    expect(initialOccurrenceForm(original, 'ur').recapLocale).toBe('ur');
    expect(
      initialOccurrenceForm({ ...original, recapNote: 'x', recapLocale: 'en' }, 'ur').recapLocale,
    ).toBe('en');
    expect(initialOccurrenceForm({ ...original, status: 'cancelled' }, 'en').cancelled).toBe(true);
  });
});

describe('validateOccurrence', () => {
  it('says nothing changed for an untouched form', () => {
    expect(validateOccurrence(form(), original).errors.nothing).toBe(
      'admin.occurrence.error.nothing',
    );
  });

  it('changes a para and sends only the portion', () => {
    const { body } = validateOccurrence(form({ para: '4' }), original);
    expect(changed({ errors: {}, body })).toEqual({ portion: { kind: 'para', para: 4 } });
  });

  it.each([
    [
      { portionKind: 'surah', surah: '18' },
      { kind: 'surah', surah: 18 },
    ],
    [
      { portionKind: 'ayah_range', surah: '2', fromAyah: '255', toAyah: '257' },
      { kind: 'ayah_range', surah: 2, fromAyah: 255, toAyah: 257 },
    ],
    [
      { portionKind: 'lesson', lesson: ' Wudu basics ' },
      { kind: 'lesson', title: 'Wudu basics' },
    ],
  ] as const)('builds the portion from %j', (patch, portion) => {
    expect(changed(validateOccurrence(form(patch), original))).toEqual({ portion });
  });

  it('clears the portion with null', () => {
    expect(changed(validateOccurrence(form({ portionKind: 'none' }), original))).toEqual({
      portion: null,
    });
  });

  it.each([
    [{ para: '0' }, 'para'],
    [{ para: '31' }, 'para'],
    [{ para: 'three' }, 'para'],
    [{ portionKind: 'surah', surah: '115' }, 'surah'],
    [{ portionKind: 'ayah_range', surah: '2', fromAyah: '10', toAyah: '5' }, 'ayahs'],
    [{ portionKind: 'ayah_range', surah: '2', fromAyah: '', toAyah: '5' }, 'ayahs'],
    [{ portionKind: 'ayah_range', surah: '0', fromAyah: '1', toAyah: '5' }, 'surah'],
    [{ portionKind: 'lesson', lesson: '  ' }, 'lesson'],
    [{ portionLabel: 'x'.repeat(LABEL_MAX + 1) }, 'portionLabel'],
    [{ recapNote: 'x'.repeat(RECAP_MAX + 1) }, 'recap'],
  ] as const)('refuses %j', (patch, field) => {
    const result = validateOccurrence(form(patch), original);
    expect(result.body).toBeUndefined();
    expect(result.errors[field]).toBeDefined();
  });

  it('sets a recap with its language and clears it with null', () => {
    const set = validateOccurrence(
      form({ recapNote: ' We finished para 3. ', recapLocale: 'ur' }),
      original,
    );
    expect(changed(set)).toEqual({ recapNote: 'We finished para 3.', recapLocale: 'ur' });
    const withRecap = { ...original, recapNote: 'Old', recapLocale: 'en' as const };
    const cleared = validateOccurrence(
      { ...initialOccurrenceForm(withRecap, 'en'), recapNote: '' },
      withRecap,
    );
    expect(changed(cleared)).toEqual({ recapNote: null, recapLocale: null });
  });

  it('changes only the recap language when the text is the same', () => {
    const withRecap = { ...original, recapNote: 'Old', recapLocale: 'en' as const };
    const result = validateOccurrence(
      { ...initialOccurrenceForm(withRecap, 'en'), recapLocale: 'ur' },
      withRecap,
    );
    expect(changed(result)).toEqual({ recapLocale: 'ur' });
  });

  it('sets and clears the portion label', () => {
    expect(
      changed(validateOccurrence(form({ portionLabel: ' pages 12 to 15 ' }), original)),
    ).toEqual({
      portionLabel: 'pages 12 to 15',
    });
    const labelled = { ...original, portionLabel: 'pages 1 to 2' };
    expect(
      changed(
        validateOccurrence(
          { ...initialOccurrenceForm(labelled, 'en'), portionLabel: '' },
          labelled,
        ),
      ),
    ).toEqual({ portionLabel: null });
  });

  it('cancels with the notify choice and restores a cancelled date', () => {
    expect(validateOccurrence(form({ cancelled: true, notify: true }), original).body).toEqual({
      status: 'cancelled',
      notify: true,
    });
    expect(validateOccurrence(form({ cancelled: true, notify: false }), original).body).toEqual({
      status: 'cancelled',
      notify: false,
    });
    const cancelled = { ...original, status: 'cancelled' as const };
    expect(
      changed(
        validateOccurrence(
          { ...initialOccurrenceForm(cancelled, 'en'), cancelled: false },
          cancelled,
        ),
      ),
    ).toEqual({ status: 'scheduled' });
  });
});

describe('isPast', () => {
  it('compares the end of the occurrence with now', () => {
    const o = { ...original, endsAt: '2027-02-15T08:00:00Z' };
    expect(isPast(o, new Date('2027-02-15T08:00:01Z'))).toBe(true);
    expect(isPast(o, new Date('2027-02-15T07:59:59Z'))).toBe(false);
  });
});
