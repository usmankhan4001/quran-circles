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
 * - `whatsapp_daily_cap_per_person`: Wave 4 reads it; Wave 2 only exposes it to the gate.
 */
export const DEFAULT_REMINDER_LEAD_MINUTES: Record<Program, number> = { dora: 60, circles: 60 };

const LeadMinutes = z.object({
  dora: z.number().int().min(5).max(1440).optional(),
  circles: z.number().int().min(5).max(1440).optional(),
});

const KEYS = {
  lead: ['reminder_lead_minutes', 'reminderLeadMinutes'],
  cap: ['whatsapp_daily_cap_per_person', 'whatsappDailyCapPerPerson'],
} as const;

export interface WorkerSettings {
  reminderLeadMinutes: Record<Program, number>;
  whatsappDailyCap: number | null;
}

export async function readSettings(db: Db): Promise<WorkerSettings> {
  const rows = await db
    .select()
    .from(tables.settings)
    .where(inArray(tables.settings.key, [...KEYS.lead, ...KEYS.cap]));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (names: readonly string[]): unknown => {
    for (const name of names) if (byKey.has(name)) return byKey.get(name);
    return undefined;
  };
  const lead = LeadMinutes.safeParse(pick(KEYS.lead));
  const cap = z.number().int().min(0).max(5).safeParse(pick(KEYS.cap));
  return {
    reminderLeadMinutes: {
      dora: (lead.success && lead.data.dora) || DEFAULT_REMINDER_LEAD_MINUTES.dora,
      circles: (lead.success && lead.data.circles) || DEFAULT_REMINDER_LEAD_MINUTES.circles,
    },
    whatsappDailyCap: cap.success ? cap.data : null,
  };
}
