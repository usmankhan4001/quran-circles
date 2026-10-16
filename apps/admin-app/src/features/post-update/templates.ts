import type { Locale } from '@qc/contracts';

export interface TemplateViewLike {
  key: string;
  channel: string;
  locale: Locale;
  body: string;
  variables: string[];
  status: string;
}

export interface TemplateChoice {
  key: string;
  en: string | null;
  ur: string | null;
  /** The blanks a coordinator fills in. The link is added by the system, not typed. */
  variables: string[];
}

/** Variables the system fills in, so a coordinator is never asked for them. */
const SYSTEM_VARIABLES: ReadonlySet<string> = new Set(['link']);

/** Approved templates, one choice per key, with English and Urdu wording side by side. */
export function groupTemplates(items: readonly TemplateViewLike[]): TemplateChoice[] {
  const byKey = new Map<string, TemplateChoice>();
  for (const item of items) {
    if (item.status !== 'approved') continue;
    const choice = byKey.get(item.key) ?? { key: item.key, en: null, ur: null, variables: [] };
    // Push wording is the one shown in the feed, so it wins over WhatsApp wording.
    if (choice[item.locale] === null || item.channel === 'push') choice[item.locale] = item.body;
    for (const v of item.variables) {
      if (!SYSTEM_VARIABLES.has(v) && !choice.variables.includes(v)) choice.variables.push(v);
    }
    byKey.set(item.key, choice);
  }
  return [...byKey.values()];
}

/**
 * Fills the blanks of a template. Blanks that the system fills (the link) are dropped with the
 * space before them; any other blank without a value stays visible so it cannot be missed.
 */
export function fillTemplate(body: string, values: Readonly<Record<string, string>>): string {
  return body
    .replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = values[name]?.trim();
      if (value) return value;
      return SYSTEM_VARIABLES.has(name) ? '' : whole;
    })
    .replace(/\s+([.,،۔!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** The blanks still empty. */
export function missingVariables(
  choice: TemplateChoice,
  values: Readonly<Record<string, string>>,
): string[] {
  return choice.variables.filter((v) => !values[v]?.trim());
}
