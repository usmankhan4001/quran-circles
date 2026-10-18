import {
  DAILY_GOAL_UNITS,
  ERROR_CODE_LIST,
  LOCALES,
  MEMORISATION_STATUSES,
  PROGRAMS,
  SECTIONS,
  UPDATE_KINDS,
} from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { parts } from '@qc/i18n';
import { FACILITY_KEYS } from '../components/FacilitiesChecklist';
import { COLOR_PREFERENCES } from '../core/preferences';
import { DAY_KEYS } from '../core/format';
import { TIME_BANDS } from '../features/nearby/filters';
import { errorMessageKey } from '../core/errors';
import { createTranslator, type TranslationKey } from './translate';

const en = createTranslator('en');
/** What the web downloads for this app: the catalogue's shared part and the app's own. */
const appTable = {
  en: { ...parts.shared.en, ...parts['user-app'].en } as Record<string, string>,
  ur: { ...parts.shared.ur, ...parts['user-app'].ur } as Record<string, string>,
};
const ur = createTranslator('ur');

/**
 * Some screens build a key from a value (`sections.${section}`). The typechecker cannot see
 * those, so this lists every value and checks that both languages have words for it.
 */
const dynamic: Record<string, readonly string[]> = {
  sections: SECTIONS.map((s) => `sections.${s}`),
  programs: PROGRAMS.map((p) => `programs.${p}`),
  languages: LOCALES.map((l) => `profile.language.${l}`),
  days: [...DAY_KEYS],
  timeBands: TIME_BANDS.map((b) => `nearby.time.${b}`),
  appearance: COLOR_PREFERENCES.map((c) => `profile.appearance.${c}`),
  textSizes: [0, 1, 2, 3].map((n) => `profile.textSize.step${n}`),
  updateKinds: UPDATE_KINDS.map((k) => `updates.kind.${k}`),
  facilities: FACILITY_KEYS.map((k) => `facilities.${k}`),
  errors: ERROR_CODE_LIST.map((c) => `errors.${c}`),
  memorisationStatuses: MEMORISATION_STATUSES.map((s) => `memorisation.status.${s}`),
  goalUnits: DAILY_GOAL_UNITS.flatMap((u) => [
    `daysRead.unit.${u}.one`,
    `daysRead.unit.${u}.other`,
  ]),
};

describe('keys built from values', () => {
  for (const [group, keys] of Object.entries(dynamic)) {
    it(`${group} have words in English and Urdu`, () => {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(appTable.en, key).toHaveProperty([key]);
        expect(appTable.ur, key).toHaveProperty([key]);
        expect(ur(key as TranslationKey)).not.toBe(key);
      }
    });
  }

  it('maps a failure that is not from the API to a plain message', () => {
    expect(errorMessageKey('network_error')).toBe('ui.offlineBody');
    expect(errorMessageKey('unknown')).toBe('ui.errorBody');
    expect(appTable.ur['ui.offlineBody']).toBeTruthy();
  });
});

describe('plural keys', () => {
  it('uses the one form for 1 and the other form for the rest', () => {
    expect(en('registration.confirmation.party', { count: 1 })).toBe('1 person');
    expect(en('registration.confirmation.party', { count: 3 })).toBe('3 people');
  });

  it('falls back to the plain key when a message has no plural forms', () => {
    expect(en('registration.confirmation.position', { count: 4 })).toBe(
      'Your place on the waiting list: 4',
    );
  });
});
