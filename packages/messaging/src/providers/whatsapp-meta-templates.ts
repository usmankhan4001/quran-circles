import { TEMPLATES, TEMPLATE_VARIABLES, type Locale, type TemplateKey } from '@qc/contracts';
import { positionalNames } from './whatsapp';

/**
 * The submission a human files in Meta Business Manager for a template, generated from the
 * frozen catalog so the submitted wording and the send-time positional order cannot drift.
 * Nothing here is approved by Meta; approval is a human step.
 */
export interface MetaTemplateSubmission {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  components: unknown[];
  /** Positional variable names, in order: `{{1}}` is the first. */
  variableOrder: string[];
  urduStatus: 'draft' | 'reviewed';
}

const CATEGORY = {
  authentication: 'AUTHENTICATION',
  utility: 'UTILITY',
  marketing: 'MARKETING',
} as const;

/** Example values Meta requires for each variable. Synthetic. */
const EXAMPLES: Record<string, string> = {
  code: '123456',
  minutes: '10',
  name: 'Aisha',
  sessionTitle: 'Weekly tafsir',
  venueName: 'Example Masjid',
  when: 'Friday 7:30 pm',
  newWhen: 'Friday 8:00 pm',
  link: 'https://example.org/s/abc',
  inviterName: 'Example Coordinator',
  scopeName: 'Example Masjid',
  areaName: 'Example Area',
  circleName: 'Example Circle',
};

export function toMetaSubmission(
  key: TemplateKey,
  locale: Locale,
  languageCodes: Partial<Record<Locale, string>> = {},
): MetaTemplateSubmission {
  const def = TEMPLATES[key];
  const language = languageCodes[locale] ?? locale;
  if (def.costCategory === 'authentication') {
    return {
      name: def.waTemplateName,
      language,
      category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 10 },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }] },
      ],
      variableOrder: ['code'],
      urduStatus: def.urduStatus,
    };
  }
  const order = positionalNames(key, locale);
  const text = def.body[locale].replace(/\{(\w+)\}/g, (_m, name: string) => {
    const index = order.indexOf(name);
    return `{{${index + 1}}}`;
  });
  return {
    name: def.waTemplateName,
    language,
    category: CATEGORY[def.costCategory as keyof typeof CATEGORY] ?? 'UTILITY',
    components: [
      {
        type: 'BODY',
        text,
        example: { body_text: [order.map((n) => EXAMPLES[n] ?? 'Example')] },
      },
    ],
    variableOrder: order,
    urduStatus: def.urduStatus,
  };
}

/** Every template in both languages, for the human who files them. */
export function allMetaSubmissions(
  languageCodes: Partial<Record<Locale, string>> = {},
): MetaTemplateSubmission[] {
  const keys = Object.keys(TEMPLATE_VARIABLES) as TemplateKey[];
  return keys.flatMap((key) =>
    (['en', 'ur'] as const).map((locale) => toMetaSubmission(key, locale, languageCodes)),
  );
}
