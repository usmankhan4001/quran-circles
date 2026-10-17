import {
  DailyGoal,
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  MemorisationReviseAfterDays,
} from '@qc/contracts';
import type { TFunction } from '../../i18n/translate';

/**
 * The choices offered for the reading settings on the profile. Short lists of common values
 * rather than a number field; a value set elsewhere (another phone, a later version) is added to
 * the list so it still shows as chosen.
 */
export const GOAL_PRESETS: readonly DailyGoal[] = [
  { unit: 'pages', amount: 1 },
  { unit: 'pages', amount: 2 },
  { unit: 'pages', amount: 5 },
  { unit: 'rukus', amount: 1 },
  { unit: 'rukus', amount: 2 },
  { unit: 'minutes', amount: 10 },
  { unit: 'minutes', amount: 15 },
  { unit: 'minutes', amount: 30 },
];

export const REVISE_AFTER_PRESETS: readonly number[] = [7, 14, 21, 30];

const NO_GOAL = 'none';

/** "1 page", "10 minutes": a goal amount in words, the count formatted by the translator. */
export function goalAmountText(goal: DailyGoal, t: TFunction): string {
  return t(`daysRead.unit.${goal.unit}`, { count: goal.amount });
}

/** The select value for a goal: `pages:1`, or `none`. */
export function goalValue(goal: DailyGoal | null): string {
  return goal ? `${goal.unit}:${goal.amount}` : NO_GOAL;
}

/** Reads a select value back, checked against the contract. `none` (or anything wrong) is null. */
export function goalFromValue(value: string): DailyGoal | null {
  if (value === NO_GOAL) return null;
  const [unit, amount] = value.split(':');
  const parsed = DailyGoal.safeParse({ unit, amount: Number(amount) });
  return parsed.success ? parsed.data : null;
}

export function goalOptions(
  current: DailyGoal | null,
  presets: readonly DailyGoal[],
  t: TFunction,
): { value: string; label: string }[] {
  const goals = [...presets];
  if (current && !goals.some((g) => goalValue(g) === goalValue(current))) goals.push(current);
  return [
    { value: NO_GOAL, label: t('profile.goal.none') },
    ...goals.map((goal) => ({
      value: goalValue(goal),
      label: t('profile.goal.option', { goal: goalAmountText(goal, t) }),
    })),
  ];
}

export function reviseAfterOptions(
  current: number | null,
  presets: readonly number[],
  t: TFunction,
): { value: string; label: string }[] {
  const days = new Set(presets);
  if (current !== null && MemorisationReviseAfterDays.safeParse(current).success) days.add(current);
  days.add(MEMORISATION_REVISE_AFTER_DAYS_DEFAULT);
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => ({ value: `${d}`, label: t('profile.reviseAfter.option', { count: d }) }));
}
