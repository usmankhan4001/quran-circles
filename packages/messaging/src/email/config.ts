/**
 * Email identity and links. One place to change when the domain moves.
 *
 * Mail domain: `qurancircles.doraquran.pk` (with the s). The app host is `qurancircle.doraquran.pk`
 * (no s), the production address in `docs/release/go-live.md`. They are different names on purpose.
 */
export const EMAIL_DOMAIN = 'qurancircles.doraquran.pk';

export const EMAIL_ADDRESSES = {
  /** Sender of every email in this module. */
  notifications: `notifications@${EMAIL_DOMAIN}`,
  support: `support@${EMAIL_DOMAIN}`,
  privacy: `privacy@${EMAIL_DOMAIN}`,
} as const;

/** The `from` header value for the provider adapter. */
export const EMAIL_FROM = `Quran Circles <${EMAIL_ADDRESSES.notifications}>`;

/** Public https origin of the web app. Links in emails are built from it. */
export const EMAIL_APP_ORIGIN = 'https://qurancircle.doraquran.pk';

/**
 * The logo in every email: an absolute https URL, no query string. The file is
 * `apps/user-app/public/brand/email-logo.png` (360x316, shown at 150x132 for sharp 2x screens), so it
 * is served by the web app and only exists at this address after a release carrying it is deployed.
 * Email clients cannot load an image from a data: URL reliably, so it is always a hosted PNG.
 */
export const EMAIL_LOGO_URL = `${EMAIL_APP_ORIGIN}/brand/email-logo.png`;

/**
 * Colours and shapes copied from the finalized design system (light mode only): white page, one
 * green, flat cards with a thin border and a 12px radius.
 */
export const EMAIL_THEME = {
  page: '#FFFFFF',
  ink: '#111827',
  muted: '#5B6472',
  border: '#E3E7E5',
  /** The only accent: buttons, the code and links. */
  green: '#0A6938',
  /** White text on the green button. */
  onGreen: '#FFFFFF',
  /** A very light green for the sign-in code box. */
  tint: '#F2F8F4',
  radius: 12,
  width: 600,
} as const;

/** Latin text: Plus Jakarta Sans where the client can load it, then web-safe faces. */
export const FONT_LATIN =
  "'Plus Jakarta Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
/** Urdu text: Noori Nastaleeq first, then other Nastaliq faces, then any Arabic-script face. */
export const FONT_URDU =
  "'Noori Nastaleeq', 'Jameel Noori Nastaleeq', 'Mehr Nastaliq Web', 'Noto Nastaliq Urdu', 'Urdu Typesetting', 'Segoe UI', Tahoma, serif";
