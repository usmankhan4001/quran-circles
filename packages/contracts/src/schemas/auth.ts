import { z } from 'zod';
import { EmailAddress, InstantUtc, PhoneE164, Uuid } from '../common';
import { Locale, OtpChannel } from '../enums';
import { Me } from './people';
import { lazy } from '../lazy';

export const RequestCodeBody = lazy(() =>
  z.object({
    /**
     * Sign-in codes go to an email address (owner decision 2026-10-25). Required unless the API
     * has WhatsApp sign-in switched on (`AUTH_PHONE_SIGN_IN`, off by default), in which case a
     * `phone` alone asks for the older WhatsApp code.
     */
    email: EmailAddress.optional(),
    /**
     * With `email`: the person's WhatsApp number, required the first time (the account does not
     * exist yet) and saved unverified for reminders and coordinator contact. Any country, E.164.
     * Without `email` (WhatsApp sign-in, when switched on): the number the code goes to, a
     * Pakistani mobile only (SEC-04).
     */
    phone: PhoneE164.optional(),
    /** The language of the message that carries the code. */
    locale: Locale.default('ur'),
    /** Email unless WhatsApp sign-in is switched on. */
    channel: OtpChannel.default('email'),
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
    /** True when this verified email (or number) had no account before. */
    isNewAccount: z.boolean(),
  }),
);

export const RefreshBody = lazy(() => z.object({ refreshToken: z.string().min(10) }));
