import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import {
  circleFormOf,
  emptyCircleForm,
  isWebAddress,
  validateCircle,
  type CircleForm,
} from './form';

const circle = fx.circles[0]!;
const venueId = fx.venues[0]!.id;
const filled = (patch: Partial<CircleForm> = {}): CircleForm => ({
  ...emptyCircleForm(venueId, 'en'),
  name: { en: 'Sample Circle', ur: '' },
  ...patch,
});

describe('isWebAddress', () => {
  it('accepts full web addresses only', () => {
    expect(isWebAddress('https://example.org/room')).toBe(true);
    expect(isWebAddress(' http://example.org ')).toBe(true);
    expect(isWebAddress('example.org')).toBe(false);
    expect(isWebAddress('javascript:alert(1)')).toBe(false);
    expect(isWebAddress('ftp://example.org')).toBe(false);
    expect(isWebAddress('')).toBe(false);
  });
});

describe('validateCircle (create)', () => {
  it('builds a create request and trims optional text to null', () => {
    const { errors, create } = validateCircle(filled());
    expect(errors).toEqual({});
    expect(create).toMatchObject({
      venueId,
      name: { en: 'Sample Circle' },
      teacherName: null,
      description: null,
      language: 'en',
      section: 'family',
      onlineLink: null,
    });
  });

  it('keeps the teacher, section, language and online link', () => {
    const { create } = validateCircle(
      filled({
        teacherName: ' Sample Teacher ',
        section: 'women',
        language: 'ur',
        onlineLink: ' https://example.org/room ',
        description: { en: 'A weekly class', ur: '' },
      }),
    );
    expect(create).toMatchObject({
      teacherName: 'Sample Teacher',
      section: 'women',
      language: 'ur',
      onlineLink: 'https://example.org/room',
      description: { en: 'A weekly class' },
    });
  });

  it('copies Urdu-only names into the required English name', () => {
    const { create } = validateCircle(filled({ name: { en: '', ur: 'نمونہ سرکل' } }));
    expect(create?.name.en).toBe('نمونہ سرکل');
  });

  it('asks for a venue and a name', () => {
    const { errors, create } = validateCircle(emptyCircleForm(null, 'en'));
    expect(create).toBeUndefined();
    expect(errors.venue).toBe('admin.circleEditor.error.venue');
    expect(errors.name).toBe('admin.circleEditor.error.name');
  });

  it('rejects a one-letter teacher and an address that is not a web address', () => {
    expect(validateCircle(filled({ teacherName: 'A' })).errors.teacher).toBe(
      'admin.circleEditor.error.teacher',
    );
    expect(validateCircle(filled({ onlineLink: 'room 4' })).errors.link).toBe(
      'admin.circleEditor.error.link',
    );
  });
});

describe('validateCircle (edit)', () => {
  it('needs no venue when editing and sends only the change', () => {
    const form = circleFormOf(circle);
    form.section = 'women';
    const { errors, update } = validateCircle(form, circle);
    expect(errors).toEqual({});
    expect(update).toEqual({ section: 'women' });
  });

  it('clears the teacher and the online link with null', () => {
    const form = circleFormOf(circle);
    form.teacherName = '';
    expect(validateCircle(form, circle).update).toEqual({ teacherName: null });
    const withLink = { ...circle, onlineLink: 'https://example.org/room' };
    const cleared = { ...circleFormOf(withLink), onlineLink: '' };
    expect(validateCircle(cleared, withLink).update).toEqual({ onlineLink: null });
  });

  it('sends the description as null when it is emptied', () => {
    const form = circleFormOf(circle);
    form.description = { en: '', ur: '' };
    expect(validateCircle(form, circle).update).toEqual({ description: null });
  });

  it('says so when nothing changed', () => {
    const result = validateCircle(circleFormOf(circle), circle);
    expect(result.update).toBeUndefined();
    expect(result.errors.nothing).toBe('admin.circleEditor.error.nothing');
  });

  it('round-trips every fixture circle without inventing changes', () => {
    for (const c of fx.circles) {
      expect(validateCircle(circleFormOf(c), c).errors.nothing).toBe(
        'admin.circleEditor.error.nothing',
      );
    }
  });
});
