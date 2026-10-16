import { describe, expect, it } from 'vitest';
import { RegistrationCreate } from '@qc/contracts';
import { messages } from '@qc/i18n';
import {
  MAX_PARTY_SIZE,
  allowedSections,
  buildRegistration,
  initialForm,
  isWaitlisted,
  validateRegistration,
  type RegistrationForm,
} from './form';

const AREA = '00000000-0000-4000-8000-030000000001';
const SESSION = '00000000-0000-4000-8000-060000000001';

const family = { section: 'family' as const, cityId: 'c' };
const women = { section: 'women' as const, cityId: 'c' };

function filled(change: Partial<RegistrationForm> = {}): RegistrationForm {
  return {
    name: 'Aisha Khan',
    cityId: 'c',
    areaId: AREA,
    section: 'family',
    partySize: 2,
    allowWhatsapp: false,
    ...change,
  };
}

describe('allowedSections', () => {
  it('lets a family session take any section and a single-section session only its own', () => {
    expect(allowedSections(family)).toEqual(['women', 'men', 'family']);
    expect(allowedSections(women)).toEqual(['women']);
    expect(allowedSections({ section: 'men' })).toEqual(['men']);
  });
});

describe('initialForm', () => {
  it('preselects the only possible section and starts with consent off', () => {
    const form = initialForm({ session: women, displayName: 'Aisha', cityId: null, areaId: null });
    expect(form).toMatchObject({
      section: 'women',
      partySize: 1,
      allowWhatsapp: false,
      name: 'Aisha',
    });
  });

  it('asks the person to choose when more than one section is possible', () => {
    const form = initialForm({ session: family, displayName: null, cityId: null, areaId: AREA });
    expect(form.section).toBeNull();
    expect(form.areaId).toBe(AREA);
    expect(form.cityId).toBe('c');
  });

  it('prefers the saved city over the session city', () => {
    const form = initialForm({ session: family, displayName: null, cityId: 'saved', areaId: null });
    expect(form.cityId).toBe('saved');
  });
});

describe('validateRegistration', () => {
  const options = { needsName: false, session: family };

  it('accepts a complete form', () => {
    expect(validateRegistration(filled(), options)).toEqual({});
  });

  it('asks for the area, the section and a sensible party size', () => {
    const problems = validateRegistration(
      filled({ areaId: null, section: null, partySize: 0 }),
      options,
    );
    expect(Object.keys(problems).sort()).toEqual(['area', 'partySize', 'section']);
  });

  it('rejects a party that is too large or not a whole number', () => {
    expect(validateRegistration(filled({ partySize: MAX_PARTY_SIZE + 1 }), options)).toHaveProperty(
      'partySize',
    );
    expect(validateRegistration(filled({ partySize: 1.5 }), options)).toHaveProperty('partySize');
    expect(validateRegistration(filled({ partySize: MAX_PARTY_SIZE }), options)).toEqual({});
  });

  it('rejects a section the session does not take', () => {
    expect(
      validateRegistration(filled({ section: 'men' }), { needsName: false, session: women }),
    ).toHaveProperty('section');
  });

  it('asks for a name only when the account has none', () => {
    expect(validateRegistration(filled({ name: '' }), options)).toEqual({});
    expect(
      validateRegistration(filled({ name: '' }), { ...options, needsName: true }),
    ).toHaveProperty('name');
  });

  it('points every problem at a message that exists in both languages', () => {
    const problems = validateRegistration(
      filled({ name: '', areaId: null, section: null, partySize: 0 }),
      { ...options, needsName: true },
    );
    expect(Object.keys(problems)).toHaveLength(4);
    for (const key of Object.values(problems)) {
      expect(messages.en[key]).toBeTruthy();
      expect(messages.ur[key]).toBeTruthy();
    }
  });
});

describe('buildRegistration', () => {
  it('builds a body the API accepts, with consent as chosen', () => {
    const body = buildRegistration(filled({ allowWhatsapp: true }), {
      sessionId: SESSION,
      occurrenceId: '00000000-0000-4000-8000-070000000001',
      needsName: false,
      session: family,
    });
    expect(body).not.toBeNull();
    expect(RegistrationCreate.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ allowWhatsapp: true, partySize: 2, section: 'family' });
    expect(body).not.toHaveProperty('name');
  });

  it('sends the trimmed name only when the account needs one', () => {
    const body = buildRegistration(filled({ name: '  Aisha Khan ' }), {
      sessionId: SESSION,
      needsName: true,
      session: family,
    });
    expect(body).toMatchObject({ name: 'Aisha Khan' });
  });

  it('builds nothing while the form has problems', () => {
    expect(
      buildRegistration(filled({ areaId: null }), {
        sessionId: SESSION,
        needsName: false,
        session: family,
      }),
    ).toBeNull();
  });
});

describe('isWaitlisted', () => {
  it('is true only for a waiting-list registration', () => {
    expect(isWaitlisted({ status: 'waitlisted' })).toBe(true);
    expect(isWaitlisted({ status: 'confirmed' })).toBe(false);
  });
});
