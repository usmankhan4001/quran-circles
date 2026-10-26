import type { Locale } from '@qc/contracts';
import { EMAIL_ADDRESSES, EMAIL_APP_ORIGIN } from './config';
import { oneLine } from './escape';

/** What a template needs. Values are plain strings, already formatted for the recipient's locale. */
export interface EmailTemplateData {
  sign_in_code: { code: string; minutes: number | string };
  welcome: { name?: string; appUrl?: string };
  join_confirmation: {
    name?: string;
    sessionTitle: string;
    venueName: string;
    when: string;
    link: string;
  };
  session_reminder: {
    name?: string;
    sessionTitle: string;
    venueName: string;
    when: string;
    link: string;
  };
  account_deleted: { name?: string };
}

export type EmailTemplateName = keyof EmailTemplateData;

export const EMAIL_TEMPLATE_NAMES = [
  'sign_in_code',
  'welcome',
  'join_confirmation',
  'session_reminder',
  'account_deleted',
] as const satisfies readonly EmailTemplateName[];

/** The words and parts of one email, before any HTML. The layout and the text version both read it. */
export interface EmailContent {
  subject: string;
  /** The grey line email apps show beside the subject. */
  preheader: string;
  greeting?: string;
  heading: string;
  paragraphs: string[];
  /** A sign-in code, shown large in its own box. */
  code?: string;
  /** Label and value pairs in a flat card. */
  details?: { label: string; value: string }[];
  button?: { label: string; url: string };
  /** Small muted lines after the button. */
  notes: string[];
}

const withName = (name: string | undefined, hello: string, comma: string): string | undefined => {
  const n = name ? oneLine(name) : '';
  return n ? `${hello} ${n}${comma}` : undefined;
};

type Build<K extends EmailTemplateName> = (d: EmailTemplateData[K]) => EmailContent;

const en: { [K in EmailTemplateName]: Build<K> } = {
  sign_in_code: (d) => ({
    subject: `${d.code} is your Quran Circles sign-in code`,
    preheader: `This code works for ${d.minutes} minutes. Please do not share it.`,
    heading: 'Your sign-in code',
    paragraphs: ['Enter this code in Quran Circles to sign in.'],
    code: d.code,
    notes: [
      `This code works for ${d.minutes} minutes. Never share it with anyone, including Quran Circles staff.`,
      'If you did not ask for this code, you can ignore this email.',
    ],
  }),
  welcome: (d) => ({
    subject: 'Welcome to Quran Circles',
    preheader: 'Your account is ready. Find a circle near you.',
    greeting: withName(d.name, 'Assalamu alaikum', ','),
    heading: 'Welcome to Quran Circles',
    paragraphs: [
      'Your account is ready. Find a circle near you, see when it meets, and let the coordinator know you are coming.',
    ],
    button: { label: 'Find a circle', url: d.appUrl ?? EMAIL_APP_ORIGIN },
    notes: [`Questions? Write to us at ${EMAIL_ADDRESSES.support}.`],
  }),
  join_confirmation: (d) => ({
    subject: `You are joining ${oneLine(d.sessionTitle)}`,
    preheader: `${oneLine(d.when)} at ${oneLine(d.venueName)}`,
    greeting: withName(d.name, 'Assalamu alaikum', ','),
    heading: 'Thank you for confirming',
    paragraphs: [
      'You told us you will join this session. There is no seat to hold. Just come along.',
    ],
    details: [
      { label: 'Session', value: d.sessionTitle },
      { label: 'When', value: d.when },
      { label: 'Where', value: d.venueName },
    ],
    button: { label: 'View session', url: d.link },
    notes: ['Plans changed? Open the session in the app and update your answer.'],
  }),
  session_reminder: (d) => ({
    subject: `Reminder: ${oneLine(d.sessionTitle)}, ${oneLine(d.when)}`,
    preheader: `${oneLine(d.when)} at ${oneLine(d.venueName)}`,
    greeting: withName(d.name, 'Assalamu alaikum', ','),
    heading: 'Your session is coming up',
    paragraphs: ['A reminder of the session you said you would join.'],
    details: [
      { label: 'Session', value: d.sessionTitle },
      { label: 'When', value: d.when },
      { label: 'Where', value: d.venueName },
    ],
    button: { label: 'View session', url: d.link },
    notes: ['Cannot make it? Please update your answer in the app so the coordinator knows.'],
  }),
  account_deleted: (d) => ({
    subject: 'Your Quran Circles account has been deleted',
    preheader: 'This confirms that your account is gone.',
    greeting: withName(d.name, 'Assalamu alaikum', ','),
    heading: 'Your account has been deleted',
    paragraphs: [
      'We have deleted your Quran Circles account. Your personal details have been removed or made anonymous, as our privacy notice describes.',
      'You are welcome to create a new account at any time.',
    ],
    button: { label: 'Read the privacy notice', url: `${EMAIL_APP_ORIGIN}/privacy` },
    notes: [
      `If you did not ask for this, please write to ${EMAIL_ADDRESSES.support} straight away.`,
    ],
  }),
};

const ur: { [K in EmailTemplateName]: Build<K> } = {
  sign_in_code: (d) => ({
    subject: `${d.code} آپ کا قرآن سرکلز سائن اِن کوڈ ہے`,
    preheader: `یہ کوڈ ${d.minutes} منٹ تک چلے گا۔ براہ کرم اسے کسی کو نہ بتائیں۔`,
    heading: 'آپ کا سائن اِن کوڈ',
    paragraphs: ['سائن اِن کرنے کے لیے یہ کوڈ قرآن سرکلز میں درج کریں۔'],
    code: d.code,
    notes: [
      `یہ کوڈ ${d.minutes} منٹ تک چلے گا۔ اسے کسی کے ساتھ شیئر نہ کریں، قرآن سرکلز کے عملے کے ساتھ بھی نہیں۔`,
      'اگر آپ نے یہ کوڈ نہیں مانگا تو اس ای میل کو نظر انداز کر دیں۔',
    ],
  }),
  welcome: (d) => ({
    subject: 'قرآن سرکلز میں خوش آمدید',
    preheader: 'آپ کا اکاؤنٹ تیار ہے۔ اپنے قریب کوئی سرکل تلاش کریں۔',
    greeting: withName(d.name, 'السلام علیکم', '،'),
    heading: 'قرآن سرکلز میں خوش آمدید',
    paragraphs: [
      'آپ کا اکاؤنٹ تیار ہے۔ اپنے قریب کوئی سرکل تلاش کریں، دیکھیں کہ وہ کب بیٹھتا ہے، اور کوآرڈینیٹر کو بتائیں کہ آپ آ رہے ہیں۔',
    ],
    button: { label: 'سرکل تلاش کریں', url: d.appUrl ?? EMAIL_APP_ORIGIN },
    notes: [`کوئی سوال ہو تو ہمیں ${EMAIL_ADDRESSES.support} پر لکھیں۔`],
  }),
  join_confirmation: (d) => ({
    subject: `آپ ${oneLine(d.sessionTitle)} میں شامل ہو رہے ہیں`,
    preheader: `${oneLine(d.when)}، ${oneLine(d.venueName)}`,
    greeting: withName(d.name, 'السلام علیکم', '،'),
    heading: 'تصدیق کا شکریہ',
    paragraphs: [
      'آپ نے بتایا ہے کہ آپ اس نشست میں شامل ہوں گے۔ کوئی نشست روکنے کی ضرورت نہیں۔ بس تشریف لائیں۔',
    ],
    details: [
      { label: 'نشست', value: d.sessionTitle },
      { label: 'وقت', value: d.when },
      { label: 'مقام', value: d.venueName },
    ],
    button: { label: 'نشست دیکھیں', url: d.link },
    notes: ['پروگرام بدل گیا؟ ایپ میں نشست کھول کر اپنا جواب بدل دیں۔'],
  }),
  session_reminder: (d) => ({
    subject: `یاد دہانی: ${oneLine(d.sessionTitle)}، ${oneLine(d.when)}`,
    preheader: `${oneLine(d.when)}، ${oneLine(d.venueName)}`,
    greeting: withName(d.name, 'السلام علیکم', '،'),
    heading: 'آپ کی نشست قریب ہے',
    paragraphs: ['اس نشست کی یاد دہانی جس میں آپ نے شامل ہونے کا بتایا تھا۔'],
    details: [
      { label: 'نشست', value: d.sessionTitle },
      { label: 'وقت', value: d.when },
      { label: 'مقام', value: d.venueName },
    ],
    button: { label: 'نشست دیکھیں', url: d.link },
    notes: ['آ نہیں سکتے؟ براہ کرم ایپ میں اپنا جواب بدل دیں تاکہ کوآرڈینیٹر کو معلوم ہو جائے۔'],
  }),
  account_deleted: (d) => ({
    subject: 'آپ کا قرآن سرکلز اکاؤنٹ ختم کر دیا گیا ہے',
    preheader: 'یہ ای میل تصدیق کرتی ہے کہ آپ کا اکاؤنٹ ختم ہو چکا ہے۔',
    greeting: withName(d.name, 'السلام علیکم', '،'),
    heading: 'آپ کا اکاؤنٹ ختم کر دیا گیا ہے',
    paragraphs: [
      'ہم نے آپ کا قرآن سرکلز اکاؤنٹ ختم کر دیا ہے۔ آپ کی ذاتی معلومات ہٹا دی گئی ہیں یا گمنام کر دی گئی ہیں، جیسا کہ ہمارے پرائیویسی نوٹس میں بیان ہے۔',
      'آپ جب چاہیں نیا اکاؤنٹ بنا سکتے ہیں۔',
    ],
    button: { label: 'پرائیویسی نوٹس پڑھیں', url: `${EMAIL_APP_ORIGIN}/privacy` },
    notes: [`اگر آپ نے یہ نہیں مانگا تھا تو براہ کرم فوراً ${EMAIL_ADDRESSES.support} پر لکھیں۔`],
  }),
};

const byLocale: Record<Locale, { [K in EmailTemplateName]: Build<K> }> = { en, ur };

export function buildContent<K extends EmailTemplateName>(
  name: K,
  locale: Locale,
  data: EmailTemplateData[K],
): EmailContent {
  const build = byLocale[locale][name] as Build<K>;
  return build(data);
}

export const FOOTER: Record<
  Locale,
  { tagline: string; support: string; privacy: string; reason: string }
> = {
  en: {
    tagline: 'Quran Circles',
    support: 'Support',
    privacy: 'Privacy',
    reason: 'You are receiving this email because of your Quran Circles account.',
  },
  ur: {
    tagline: 'قرآن سرکلز',
    support: 'مدد',
    privacy: 'پرائیویسی',
    reason: 'آپ کو یہ ای میل آپ کے قرآن سرکلز اکاؤنٹ کی وجہ سے بھیجی گئی ہے۔',
  },
};
