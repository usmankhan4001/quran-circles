/**
 * The domain every address of the project's own mail is on. One constant: change it here and the
 * default sender and every contact address follow. It is the domain verified in Resend and the one
 * inbound mail is routed on; the app itself is served on the same name (`QC_DOMAIN`).
 */
export const MAIL_DOMAIN = 'qurancircles.doraquran.pk';

/** Where the project's own mail comes from; send only, nobody reads replies sent to it. */
export const NOTIFICATIONS_ADDRESS = `notifications@${MAIL_DOMAIN}`;
/** Support, contact and the account-deletion page. Needs inbound routing. */
export const SUPPORT_ADDRESS = `support@${MAIL_DOMAIN}`;
/** The privacy policy's contact. Needs inbound routing. */
export const PRIVACY_ADDRESS = `privacy@${MAIL_DOMAIN}`;

/** The sender shown in the inbox: `Quran Circles <notifications@...>`. */
export const DEFAULT_EMAIL_FROM = `Quran Circles <${NOTIFICATIONS_ADDRESS}>`;
