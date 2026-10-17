import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../i18n/translate';
import {
  GOAL_PRESETS,
  REVISE_AFTER_PRESETS,
  goalAmountText,
  goalFromValue,
  goalOptions,
  goalValue,
  reviseAfterOptions,
} from './readingSettings';

const en = createTranslator('en');
const ur = createTranslator('ur');

describe('daily goal choices', () => {
  it('reads every preset back from its select value', () => {
    for (const goal of GOAL_PRESETS) expect(goalFromValue(goalValue(goal))).toEqual(goal);
    expect(goalValue(null)).toBe('none');
    expect(goalFromValue('none')).toBeNull();
  });

  it('refuses a value the contract would refuse', () => {
    expect(goalFromValue('pages:0')).toBeNull();
    expect(goalFromValue('pages:605')).toBeNull();
    expect(goalFromValue('hours:1')).toBeNull();
    expect(goalFromValue('pages:abc')).toBeNull();
  });

  it('writes the amount with the right plural, in both languages', () => {
    expect(goalAmountText({ unit: 'pages', amount: 1 }, en)).toBe('1 page');
    expect(goalAmountText({ unit: 'pages', amount: 5 }, en)).toBe('5 pages');
    expect(goalAmountText({ unit: 'minutes', amount: 10 }, en)).toBe('10 minutes');
    expect(goalAmountText({ unit: 'rukus', amount: 1 }, ur)).toBe('1 رکوع');
  });

  it('starts with "No goal" and keeps a goal set elsewhere in the list', () => {
    const options = goalOptions({ unit: 'pages', amount: 3 }, GOAL_PRESETS, en);
    expect(options[0]).toEqual({ value: 'none', label: 'No goal' });
    expect(options.map((o) => o.value)).toContain('pages:3');
    expect(options.find((o) => o.value === 'pages:3')?.label).toBe('3 pages a day');
    expect(goalOptions(null, GOAL_PRESETS, en)).toHaveLength(GOAL_PRESETS.length + 1);
  });
});

describe('revise-after choices', () => {
  it('offers the presets with the default among them', () => {
    expect(reviseAfterOptions(null, REVISE_AFTER_PRESETS, en).map((o) => o.value)).toEqual([
      '7',
      '14',
      '21',
      '30',
    ]);
  });

  it('keeps a value set elsewhere, and drops one the contract refuses', () => {
    expect(reviseAfterOptions(10, REVISE_AFTER_PRESETS, en).map((o) => o.value)).toEqual([
      '7',
      '10',
      '14',
      '21',
      '30',
    ]);
    expect(reviseAfterOptions(400, REVISE_AFTER_PRESETS, en)).toHaveLength(4);
    expect(reviseAfterOptions(1, [], en)[0]?.label).toBe('1 day');
  });
});
