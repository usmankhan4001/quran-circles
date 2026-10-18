import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Program } from '@qc/contracts';
import { tables, type Db } from './db';

/**
 * Settings the worker reads from the `settings` table. Keys are stored in snake case, as the
 * migration comment describes; the contract's camel-case names are accepted too.
 *
 * - `reminder_lead_minutes`: `{ "dora": 60, "circles": 60 }`, minutes before a session's start,
 *   per program. The console edits it as `reminderLeadMinutes` in the Settings contract and the
 *   API stores it under this key (a partial update keeps the other program's value).
 * - `whatsapp_daily_cap_per_person`: WhatsApp template messages per person per Pakistan day, 0 to
 *   5, edited by the console. Absent: the worker's `WHATSAPP_DAILY_CAP` (default 1) applies.
 * - `whatsapp_city_monthly_budget`: WhatsApp template messages per city per Pakistan calendar
 *   month. Either one number for every city, or `{ "default": 3000, "cities": { "<cityId>": 500 } }`.
 *   Absent (or no entry for a city): the worker's `WHATSAPP_CITY_MONTHLY_BUDGET` (default 3000).
 *   Not in the Settings contract yet, so the console cannot edit it; an admin sets it in the table.
 */
export const DEFAULT_REMINDER_LEAD_MINUTES: Record<Program, number> = { dora: 60, circles: 60 };

const LeadMinutes = z.object({
  dora: z.number().int().min(5).max(1440).optional(),
  circles: z.number().int().min(5).max(1440).optional(),
});

const Budget = z.number().int().min(0).max(10_000_000);
const CityBudgets = z.union([
  Budget.transform((n) => ({ default: n, cities: {} as Record<string, number> })),
  z.object({
    default: Budget.optional(),
    cities: z.record(z.uuid(), Budget).optional(),
  }),
]);

const KEYS = {
  lead: ['reminder_lead_minutes', 'reminderLeadMinutes'],
  cap: ['whatsapp_daily_cap_per_person', 'whatsappDailyCapPerPerson'],
  budget: ['whatsapp_city_monthly_budget', 'whatsappCityMonthlyBudget'],
} as const;

export interface WorkerSettings {
  reminderLeadMinutes: Record<Program, number>;
  /** `null`: not stored (or not valid); the worker's default applies. */
  whatsappDailyCap: number | null;
  /** Monthly WhatsApp budgets. `default: null` and no city entry: the worker's default applies. */
  whatsappCityMonthlyBudget: { default: number | null; cities: Record<string, number> };
}

export async function readSettings(db: Db): Promise<WorkerSettings> {
  const rows = await db
    .select()
    .from(tables.settings)
    .where(inArray(tables.settings.key, [...KEYS.lead, ...KEYS.cap, ...KEYS.budget]));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (names: readonly string[]): unknown => {
    for (const name of names) if (byKey.has(name)) return byKey.get(name);
    return undefined;
  };
  const lead = LeadMinutes.safeParse(pick(KEYS.lead));
  const cap = z.number().int().min(0).max(5).safeParse(pick(KEYS.cap));
  const budget = CityBudgets.safeParse(pick(KEYS.budget));
  return {
    reminderLeadMinutes: {
      dora: (lead.success && lead.data.dora) || DEFAULT_REMINDER_LEAD_MINUTES.dora,
      circles: (lead.success && lead.data.circles) || DEFAULT_REMINDER_LEAD_MINUTES.circles,
    },
    whatsappDailyCap: cap.success ? cap.data : null,
    whatsappCityMonthlyBudget: {
      default: budget.success ? (budget.data.default ?? null) : null,
      cities: budget.success ? (budget.data.cities ?? {}) : {},
    },
  };
}
