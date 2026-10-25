import { beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, TEMPLATE_KEYS, TEMPLATES, templatePlaceholders } from '@qc/contracts';
import { createMigratedDb, type TestDb } from './test/helpers';

/**
 * The migrations must leave the contract's template catalog in `message_templates`, word for word,
 * on a fresh install (migration 0013 wrote it; production has no seed). When this fails after a
 * change to `TEMPLATES` in packages/contracts/src/messages.ts, add a migration that writes the new
 * wording: the API lists templates from the table, not from the contract.
 */
let test: TestDb;
beforeAll(async () => {
  test = await createMigratedDb();
});

describe('the message template catalog after the migrations', () => {
  it('has one row per contract template and language, and nothing else', async () => {
    const { rows } = await test.pg.query<{ key: string; locale: string }>(
      'SELECT key, locale FROM message_templates ORDER BY key, locale',
    );
    const expected = TEMPLATE_KEYS.flatMap((key) => LOCALES.map((locale) => `${key}/${locale}`));
    expect(rows.map((r) => `${r.key}/${r.locale}`)).toEqual([...expected].sort());
  });

  it('matches the contract wording, channel, Meta name, cost category, variables and review state', async () => {
    for (const key of TEMPLATE_KEYS) {
      const def = TEMPLATES[key];
      for (const locale of LOCALES) {
        const { rows } = await test.pg.query<{
          body: string;
          channel: string;
          wa_template_name: string;
          cost_category: string;
          variables: string[];
          status: string;
        }>(
          `SELECT body, channel, wa_template_name, cost_category, variables, status
             FROM message_templates WHERE key = $1 AND locale = $2`,
          [key, locale],
        );
        const approved = locale === 'en' || def.urduStatus === 'reviewed';
        expect(rows[0], `${key}/${locale}`).toEqual({
          body: def.body[locale],
          channel: def.channels[0],
          wa_template_name: def.waTemplateName,
          cost_category: def.costCategory,
          variables: templatePlaceholders(def.body[locale]),
          status: approved ? 'approved' : 'draft',
        });
      }
    }
  });
});
