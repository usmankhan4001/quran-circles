import { and, eq, gte, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { pakistanDate } from '@qc/contracts';
import type { GateLimits, Logger } from '@qc/messaging';
import { tables, type Clock, type Db, type OutboxRow } from '../db';
import { readSettings } from '../settings';
import type { RecipientContext } from './context';

/**
 * WhatsApp limits (SEC-02, `docs/product/messaging.md` Rules, Cap): at most the daily cap of
 * template messages per person per Pakistan day, and a monthly budget per city with an alert as it
 * nears the limit. The gate (`evaluateGate` in `@qc/messaging`) decides; this module reads the
 * figures it needs from settings and from `message_outbox`.
 *
 * Defaults, each overridden by the worker environment and then by the `settings` table:
 *
 * | Figure                    | Default | Environment                     | Setting                         |
 * | ------------------------- | ------- | ------------------------------- | ------------------------------- |
 * | Per-person daily cap      | 1       | `WHATSAPP_DAILY_CAP`            | `whatsapp_daily_cap_per_person` |
 * | City budget, per month    | 3000    | `WHATSAPP_CITY_MONTHLY_BUDGET`  | `whatsapp_city_monthly_budget`  |
 * | Budget alert at (percent) | 80      | `WHATSAPP_BUDGET_ALERT_PERCENT` | none                            |
 *
 * What counts: WhatsApp rows `sent` or `delivered` since the start of the Pakistan day (cap) or
 * month (budget), plus rows another worker is sending right now that were queued before this one.
 * The tie-break means two rows sent at the same moment cannot both see a free slot, and exactly
 * one of them gets it. Rows that failed are not counted (Meta bills delivered messages).
 *
 * Who counts: the row's recipient account, or the account with the row's phone number. A number
 * with no account (an invitation to someone new) has no history to count, so only the city budget
 * limits it. A row without a city has no budget.
 */

export const DEFAULT_WHATSAPP_DAILY_CAP = 1;
export const DEFAULT_WHATSAPP_CITY_MONTHLY_BUDGET = 3000;
export const DEFAULT_WHATSAPP_BUDGET_ALERT_PERCENT = 80;

export interface WhatsAppLimitsConfig {
  /** Used when `whatsapp_daily_cap_per_person` is not stored. */
  dailyCap: number;
  /** Used when `whatsapp_city_monthly_budget` gives nothing for the city. */
  cityMonthlyBudget: number;
  /** `whatsapp.city_budget_near` is logged when a city's spend reaches this share of its budget. */
  budgetAlertPercent: number;
}

export const DEFAULT_WHATSAPP_LIMITS: WhatsAppLimitsConfig = {
  dailyCap: DEFAULT_WHATSAPP_DAILY_CAP,
  cityMonthlyBudget: DEFAULT_WHATSAPP_CITY_MONTHLY_BUDGET,
  budgetAlertPercent: DEFAULT_WHATSAPP_BUDGET_ALERT_PERCENT,
};

export interface WhatsAppLimitsDeps {
  db: Db;
  logger: Logger;
  now: Clock;
}

export interface WhatsAppLimits {
  /** The gate's figures for a row; `undefined` for anything but WhatsApp. */
  limits: (row: OutboxRow, ctx: RecipientContext) => Promise<GateLimits | undefined>;
  /** After a WhatsApp send: logs the budget alert when this message reached the threshold. */
  afterSend: (row: OutboxRow, gate: GateLimits | undefined) => void;
}

/** Pakistan is UTC+5 all year. */
const startOfPakistanDay = (now: Date): Date => new Date(`${pakistanDate(now)}T00:00:00+05:00`);
const startOfPakistanMonth = (now: Date): Date =>
  new Date(`${pakistanDate(now).slice(0, 7)}-01T00:00:00+05:00`);

/** The threshold message count for the alert: the first message at or past the percentage. */
export const budgetAlertAt = (budget: number, percent: number): number =>
  Math.max(1, Math.ceil((budget * percent) / 100));

export function createWhatsAppLimits(
  deps: WhatsAppLimitsDeps,
  config: WhatsAppLimitsConfig = DEFAULT_WHATSAPP_LIMITS,
): WhatsAppLimits {
  const t = tables.messageOutbox;

  /** WhatsApp messages in `scope` that count against a limit for `row`, since `since`. */
  const counted = async (row: OutboxRow, scope: SQL, since: Date): Promise<number> => {
    const [result] = await deps.db
      .select({ n: sql<number>`count(*)::int` })
      .from(t)
      .where(
        and(
          eq(t.channel, 'whatsapp'),
          scope,
          ne(t.id, row.id),
          or(
            and(inArray(t.status, ['sent', 'delivered']), gte(t.sentAt, since)),
            // Being sent by another worker and queued first. Compared in SQL against this row's
            // stored values, so sub-millisecond creation times order the same way for both rows.
            and(
              eq(t.status, 'sending'),
              sql`(${t.createdAt}, ${t.id}) < (SELECT o.created_at, o.id FROM message_outbox o WHERE o.id = ${row.id})`,
            ),
          ),
        ),
      );
    return result?.n ?? 0;
  };

  const recipientUserId = async (row: OutboxRow, ctx: RecipientContext): Promise<string | null> => {
    if (row.recipientUserId) return row.recipientUserId;
    if (ctx.user) return ctx.user.id;
    if (!ctx.phone) return null;
    const [user] = await deps.db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(eq(tables.users.phoneE164, ctx.phone));
    return user?.id ?? null;
  };

  const budgetFor = (cityId: string, settings: Awaited<ReturnType<typeof readSettings>>): number =>
    settings.whatsappCityMonthlyBudget.cities[cityId] ??
    settings.whatsappCityMonthlyBudget.default ??
    config.cityMonthlyBudget;

  return {
    async limits(row, ctx) {
      if (row.channel !== 'whatsapp') return undefined;
      const now = deps.now();
      const settings = await readSettings(deps.db);
      const userId = await recipientUserId(row, ctx);
      const sentToday = userId
        ? await counted(row, eq(t.recipientUserId, userId), startOfPakistanDay(now))
        : 0;
      let cityBudget: number | null = null;
      let cityBudgetRemaining: number | null = null;
      if (row.cityId) {
        cityBudget = budgetFor(row.cityId, settings);
        const spent = await counted(row, eq(t.cityId, row.cityId), startOfPakistanMonth(now));
        cityBudgetRemaining = Math.max(0, cityBudget - spent);
      }
      return {
        whatsappDailyCap: settings.whatsappDailyCap ?? config.dailyCap,
        whatsappSentToday: sentToday,
        cityBudget,
        cityBudgetRemaining,
        estimatedCost: 1,
      };
    },

    afterSend(row, gate) {
      if (row.channel !== 'whatsapp' || !row.cityId || !gate) return;
      const budget = gate.cityBudget;
      const remaining = gate.cityBudgetRemaining;
      if (budget === null || budget === undefined || remaining === null || remaining === undefined)
        return;
      // This message's place in the month: what the gate counted before it (sent rows, and rows
      // queued earlier that were still being sent), plus itself. Each message has its own place,
      // however many workers send at once, so each alert is logged once.
      const position = budget - remaining + (gate.estimatedCost ?? 1);
      const alertAt = budgetAlertAt(budget, config.budgetAlertPercent);
      if (position === alertAt && alertAt < budget) {
        deps.logger.warn('whatsapp.city_budget_near', {
          cityId: row.cityId,
          spent: position,
          budget,
          percent: config.budgetAlertPercent,
        });
      }
      if (position === budget) {
        deps.logger.warn('whatsapp.city_budget_reached', {
          cityId: row.cityId,
          spent: position,
          budget,
        });
      }
    },
  };
}
