import {
  TEMPLATES,
  TEMPLATE_VARIABLES,
  templatePlaceholders,
  type Locale,
  type TemplateKey,
  type TemplateVariables,
} from '@qc/contracts';

/** One approved-template send. Variables are positional, in the order the template body uses them. */
export interface WhatsAppTemplateRequest {
  /** E.164 with the plus sign. The client strips the plus for the Cloud API. */
  to: string;
  templateName: string;
  /** Meta language code of the approved template, for example `en` or `ur`. */
  language: string;
  bodyParams: string[];
  /** Authentication templates carry the code again in the copy-code button. */
  buttonParam?: string;
  /** Echoed back in status webhooks, so the worker can find the outbox row. Never personal data. */
  callbackData?: string;
}

export type WhatsAppFailureCause =
  /** The recipient cannot receive it (no WhatsApp, blocked, not allowed). Try SMS for codes. */
  | 'recipient'
  /** The template is missing, paused, rejected or its parameters do not match. A human must fix it. */
  | 'template'
  /** Our credentials, number or account are wrong. A human must fix it. */
  | 'configuration'
  | 'other';

export type WhatsAppSendResult =
  | { status: 'ok'; providerMessageId: string }
  | { status: 'transient_failure'; code: string; retryAfterMs?: number }
  | { status: 'permanent_failure'; code: string; cause: WhatsAppFailureCause };

export interface WhatsAppProvider {
  sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult>;
}

/** Positional variable names for a template in a language: the order its body uses them. */
export function positionalNames(key: TemplateKey, locale: Locale): string[] {
  const def = TEMPLATES[key];
  if (def.costCategory === 'authentication') return ['code'];
  return templatePlaceholders(def.body[locale]);
}

/**
 * Builds the Cloud API request for a catalog template. Each language has its own approved
 * template body, so the positional order follows that language's body, not English.
 * Authentication templates are fixed by Meta: the code goes in the body and in the copy-code button.
 */
export function buildWhatsAppRequest<K extends TemplateKey>(input: {
  key: K;
  locale: Locale;
  variables: TemplateVariables<K>;
  to: string;
  callbackData?: string;
  /** Overrides the Meta language code, for example `ur` could be registered as `ur`. */
  languageCodes?: Partial<Record<Locale, string>>;
}): WhatsAppTemplateRequest {
  const def = TEMPLATES[input.key];
  const parsed = TEMPLATE_VARIABLES[input.key].parse(input.variables) as Record<string, string>;
  const bodyParams = positionalNames(input.key, input.locale).map((name) => {
    const value = parsed[name];
    if (value === undefined) throw new Error(`Template ${input.key} is missing variable ${name}`);
    return value;
  });
  return {
    to: input.to,
    templateName: def.waTemplateName,
    language: input.languageCodes?.[input.locale] ?? input.locale,
    bodyParams,
    ...(def.costCategory === 'authentication' ? { buttonParam: bodyParams[0] as string } : {}),
    ...(input.callbackData ? { callbackData: input.callbackData } : {}),
  };
}
