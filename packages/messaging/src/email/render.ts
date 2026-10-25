import { LOCALES, type Locale } from '@qc/contracts';
import { EMAIL_ASSET_BASE_URL } from './config';
import { oneLine } from './escape';
import { renderHtml, renderPlainText } from './layout';
import {
  buildContent,
  EMAIL_TEMPLATE_NAMES,
  type EmailTemplateData,
  type EmailTemplateName,
} from './templates';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface RenderOptions {
  /** Where `logo.png` is served from. Defaults to the production address; previews point at local files. */
  assetBaseUrl?: string;
}

export class EmailTemplateError extends Error {
  override name = 'EmailTemplateError';
}

/**
 * Renders one email. This is the only function the sender needs:
 * `render('sign_in_code', 'ur', { code: '123456', minutes: 5 }) -> { subject, html, text }`.
 * Throws `EmailTemplateError` for an unknown template or locale, or data a template cannot use.
 */
export function render<K extends EmailTemplateName>(
  templateName: K,
  locale: Locale,
  data: EmailTemplateData[K],
  options: RenderOptions = {},
): RenderedEmail {
  if (!(EMAIL_TEMPLATE_NAMES as readonly string[]).includes(templateName)) {
    throw new EmailTemplateError(`unknown email template: ${String(templateName)}`);
  }
  if (!(LOCALES as readonly string[]).includes(locale)) {
    throw new EmailTemplateError(`unknown locale: ${String(locale)}`);
  }
  if (templateName === 'sign_in_code') {
    const d = data as EmailTemplateData['sign_in_code'];
    if (!/^[0-9]{6}$/.test(d.code)) throw new EmailTemplateError('sign-in code must be six digits');
  }
  const content = buildContent(templateName, locale, data);
  return {
    subject: oneLine(content.subject),
    html: renderHtml(content, locale, {
      assetBaseUrl: options.assetBaseUrl ?? EMAIL_ASSET_BASE_URL,
    }),
    text: renderPlainText(content, locale),
  };
}

/** The variables each template takes, as named in `EmailTemplateData`. `optional` ones have a fallback. */
const TEMPLATE_VARIABLES: Record<EmailTemplateName, { key: string; fallback?: string }[]> = {
  sign_in_code: [{ key: 'code' }, { key: 'minutes' }],
  welcome: [{ key: 'name', fallback: 'friend' }, { key: 'appUrl' }],
  join_confirmation: [
    { key: 'name', fallback: 'friend' },
    { key: 'sessionTitle' },
    { key: 'venueName' },
    { key: 'when' },
    { key: 'link' },
  ],
  session_reminder: [
    { key: 'name', fallback: 'friend' },
    { key: 'sessionTitle' },
    { key: 'venueName' },
    { key: 'when' },
    { key: 'link' },
  ],
  account_deleted: [{ key: 'name', fallback: 'friend' }],
};

export interface EmailTemplateSource extends RenderedEmail {
  /** Variable names with the value the provider uses when none is sent. */
  variables: { key: string; fallbackValue: string }[];
}

/**
 * The template with `{{{variable}}}` placeholders instead of data, for uploading to a provider that
 * stores templates (Resend). `render` stays the path the app uses; this one is for the publish script.
 */
export function renderTemplateSource(
  templateName: EmailTemplateName,
  locale: Locale,
  options: RenderOptions = {},
): EmailTemplateSource {
  const vars = TEMPLATE_VARIABLES[templateName];
  const data = Object.fromEntries(vars.map((v) => [v.key, `{{{${v.key}}}}`]));
  const content = buildContent(templateName, locale, data as never);
  const email: RenderedEmail = {
    subject: oneLine(content.subject),
    html: renderHtml(content, locale, {
      assetBaseUrl: options.assetBaseUrl ?? EMAIL_ASSET_BASE_URL,
    }),
    text: renderPlainText(content, locale),
  };
  return {
    ...email,
    variables: vars.map((v) => ({ key: v.key, fallbackValue: v.fallback ?? '' })),
  };
}
