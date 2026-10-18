import { z } from 'zod';
import { InstantUtc, PakistaniMobilePhone, Uuid } from '../common';
import { Locale, OtpChannel } from '../enums';
import { Me } from './people';
import { lazy } from '../lazy';

export const RequestCodeBody = lazy(() =>
  z.object({
    /** Sign-in codes go to Pakistani mobile numbers only (SEC-04). */
    phone: PakistaniMobilePhone,
    /** The language of the message that carries the code. */
    locale: Locale.default('ur'),
    /** WhatsApp is the default. SMS is the fallback until the sender number is verified. */
    channel: OtpChannel.default('whatsapp'),
  }),
);
export const RequestCodeResponse = lazy(() =>
  z.object({
    challengeId: Uuid,
    channel: OtpChannel,
    expiresAt: InstantUtc,
    resendAfterSeconds: z.number().int().positive(),
  }),
);

export const VerifyCodeBody = lazy(() =>
  z.object({
    challengeId: Uuid,
    code: z.string().regex(/^[0-9]{6}$/),
    /** Names this sign-in in the list of sessions, for example "Android phone". Never a device id. */
    deviceLabel: z.string().trim().max(60).optional(),
  }),
);

export const Tokens = lazy(() =>
  z.object({
    accessToken: z.string(),
    accessTokenExpiresAt: InstantUtc,
    refreshToken: z.string(),
    refreshTokenExpiresAt: InstantUtc,
  }),
);
export type Tokens = z.infer<typeof Tokens>;

export const SignInResponse = lazy(() =>
  Tokens.extend({
    me: Me,
    /** True when this verified number had no account before. */
    isNewAccount: z.boolean(),
  }),
);

export const RefreshBody = lazy(() => z.object({ refreshToken: z.string().min(10) }));
