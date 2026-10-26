import type { Locale } from '@qc/contracts';
import type { EmailMessage } from './providers/email';

/**
 * The hook for email templates. A template is picked by name, with the recipient's locale and its
 * data, and renders to a subject, a plain-text part and an HTML part. `ProviderCodeSender` calls it
 * through `renderEmail`; the designed, branded templates plug in by passing their own
 * `EmailRenderer` (and adding names and data shapes below), with no change to the sender.
 */
export interface EmailTemplateData {
  auth_code: {
    /** Six digits. */
    code: string;
    /** How long the code works, in minutes. */
    minutes: number | string;
  };
}

export type EmailTemplateName = keyof EmailTemplateData;

export type RenderedEmail = Omit<EmailMessage, 'to'>;

export type EmailRenderer = <N extends EmailTemplateName>(
  name: N,
  locale: Locale,
  data: EmailTemplateData[N],
) => RenderedEmail;

/**
 * The placeholder until the designed templates land: a short plain message, English and Urdu (the
 * Urdu is a draft for a native speaker to review), the same words as the WhatsApp code message.
 * The code is six digits, checked here, so nothing needs HTML escaping.
 */
const CODE_WORDS: Record<Locale, { subject: string; body: string; dir: 'ltr' | 'rtl' }> = {
  en: {
    subject: '{code} is your Quran Circles code',
    body: '{code} is your Quran Circles code. It works for {minutes} minutes. Do not share it. If you did not ask for it, ignore this email.',
    dir: 'ltr',
  },
  ur: {
    subject: 'آپ کا Quran Circles کوڈ {code} ہے',
    body: 'آپ کا Quran Circles کوڈ {code} ہے۔ یہ {minutes} منٹ تک کارآمد ہے۔ اسے کسی کو نہ بتائیں۔ اگر آپ نے یہ نہیں منگوایا تو اس ای میل کو نظر انداز کریں۔',
    dir: 'rtl',
  },
};

const fill = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

export const renderPlainEmail: EmailRenderer = (name, locale, data) => {
  if (name !== 'auth_code') throw new Error(`no email template named ${String(name)}`);
  const { code, minutes } = data as EmailTemplateData['auth_code'];
  if (!/^[0-9]{6}$/.test(code)) throw new Error('a sign-in code is six digits');
  const mins = String(minutes);
  if (!/^[0-9]{1,3}$/.test(mins)) throw new Error('minutes must be a small whole number');
  const words = CODE_WORDS[locale];
  const values = { code, minutes: mins };
  const text = fill(words.body, values);
  return {
    subject: fill(words.subject, values),
    text,
    html: `<!doctype html><html lang="${locale}" dir="${words.dir}"><head><meta charset="utf-8"></head><body><p>${text}</p></body></html>`,
  };
};
