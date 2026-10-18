import { z } from 'zod';
import { ApnsPushProvider } from './providers/apns';
import { FcmPushProvider, GoogleServiceAccountTokenSource } from './providers/fcm';
import { HttpSmsProvider } from './providers/http-sms';
import { PushRouter, type PushProvider } from './providers/push';
import type { SmsProvider } from './providers/sms';
import { WebPushProvider } from './providers/webpush';
import type { WhatsAppProvider } from './providers/whatsapp';
import { WhatsAppCloudClient } from './providers/whatsapp-cloud';
import {
  DEFAULT_CODE_VALIDITY_MINUTES,
  ProviderCodeSender,
  TestCodeSender,
  type CodeDeliveryReport,
  type CodeSender,
} from './code-sender';
import { FakePushProvider, FakeSmsProvider, FakeWhatsAppProvider } from './fakes';
import { defaultFetch, type FetchLike } from './http';
import { createHttp2Fetch } from './http2-fetch';
import { silentLogger, type Logger } from './logger';

/**
 * Provider wiring from environment variables, shared by the worker and the API (which needs the
 * code sender). Secrets come from the environment at runtime; nothing is read from files here.
 *
 * MESSAGING_MODE=fake (default) uses the fake providers and the test-mode code sender.
 * MESSAGING_MODE=live uses the real providers and refuses to start without the WhatsApp settings.
 * APP_ENV=production refuses fake mode.
 */
const optional = z.string().trim().min(1).optional();

export const MessagingEnv = z.object({
  APP_ENV: optional,
  MESSAGING_MODE: z.enum(['fake', 'live']).default('fake'),
  /** `test` keeps codes in memory. Defaults to `test` in fake mode and `live` otherwise. */
  CODE_DELIVERY_MODE: z.enum(['test', 'live']).optional(),
  /** Try SMS when WhatsApp cannot deliver a code. Default true. */
  CODE_SMS_FALLBACK: z.stringbool().default(true),
  /**
   * Minutes a sign-in code works, as the code message states it. Must equal the API's code
   * lifetime (`otp.ttlSeconds` in `apps/api/src/auth/config.ts`, 5 minutes), so the default is
   * `DEFAULT_CODE_VALIDITY_MINUTES` (SEC-21).
   */
  CODE_VALIDITY_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(DEFAULT_CODE_VALIDITY_MINUTES),

  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_ACCESS_TOKEN: optional,
  WHATSAPP_APP_SECRET: optional,
  WHATSAPP_VERIFY_TOKEN: optional,
  /** Defaults to the documented Graph API origin. */
  WHATSAPP_GRAPH_BASE_URL: optional,
  WHATSAPP_API_VERSION: optional,

  /** The service-account JSON, as one string. */
  FCM_SERVICE_ACCOUNT_JSON: optional,

  APNS_TEAM_ID: optional,
  APNS_KEY_ID: optional,
  /** The .p8 key as PEM text; literal `\n` sequences are accepted. */
  APNS_PRIVATE_KEY: optional,
  APNS_BUNDLE_ID: optional,
  APNS_PRODUCTION: z.stringbool().default(true),

  VAPID_SUBJECT: optional,
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,

  SMS_GATEWAY_URL: optional,
  SMS_GATEWAY_KEY: optional,
  SMS_SENDER: optional,
});
export type MessagingEnv = z.infer<typeof MessagingEnv>;

export class MessagingConfigError extends Error {
  override name = 'MessagingConfigError';
}

export interface Messaging {
  mode: 'fake' | 'live';
  push: PushProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider | undefined;
  codeSender: CodeSender;
  /** Present in fake mode, so a dev server or a test can inspect what was "sent". */
  fakes?: {
    push: FakePushProvider;
    whatsapp: FakeWhatsAppProvider;
    sms: FakeSmsProvider;
    codes: TestCodeSender;
  };
  /** Webhook credentials; undefined when not configured. */
  webhook: { appSecret: string | undefined; verifyToken: string | undefined };
  /** Release sockets held by the HTTP/2 transport. */
  close(): void;
}

export interface CreateMessagingOptions {
  fetch?: FetchLike;
  /** HTTP/2 fetch for APNs. Defaults to a real HTTP/2 client. */
  http2Fetch?: FetchLike & { close?: () => void };
  logger?: Logger;
  onCodeDelivery?: (report: CodeDeliveryReport) => void;
}

export function createMessaging(
  rawEnv: Record<string, string | undefined>,
  options: CreateMessagingOptions = {},
): Messaging {
  const parsed = MessagingEnv.safeParse(rawEnv);
  if (!parsed.success) {
    // Names of the bad variables only, never their values.
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new MessagingConfigError(`Invalid messaging environment: ${names.join(', ')}`);
  }
  const env = parsed.data;
  const logger = options.logger ?? silentLogger;
  const webhook = { appSecret: env.WHATSAPP_APP_SECRET, verifyToken: env.WHATSAPP_VERIFY_TOKEN };

  if (env.MESSAGING_MODE === 'fake') {
    if (env.APP_ENV === 'production') {
      throw new MessagingConfigError(
        'Fake messaging providers are not allowed when APP_ENV=production',
      );
    }
    if (env.CODE_DELIVERY_MODE === 'live') {
      throw new MessagingConfigError('CODE_DELIVERY_MODE=live needs MESSAGING_MODE=live');
    }
    const fakes = {
      push: new FakePushProvider(),
      whatsapp: new FakeWhatsAppProvider(),
      sms: new FakeSmsProvider(),
      codes: new TestCodeSender(),
    };
    return {
      mode: 'fake',
      push: fakes.push,
      whatsapp: fakes.whatsapp,
      sms: fakes.sms,
      codeSender: fakes.codes,
      fakes,
      webhook,
      close: () => {},
    };
  }

  const fetchImpl = options.fetch ?? defaultFetch;
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    throw new MessagingConfigError(
      'Live messaging needs WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN',
    );
  }
  const whatsapp = new WhatsAppCloudClient({
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    fetch: fetchImpl,
    ...(env.WHATSAPP_GRAPH_BASE_URL ? { graphBaseUrl: env.WHATSAPP_GRAPH_BASE_URL } : {}),
    ...(env.WHATSAPP_API_VERSION ? { apiVersion: env.WHATSAPP_API_VERSION } : {}),
  });

  let sms: SmsProvider | undefined;
  if (env.SMS_GATEWAY_URL && env.SMS_GATEWAY_KEY) {
    sms = new HttpSmsProvider({
      url: env.SMS_GATEWAY_URL,
      apiKey: env.SMS_GATEWAY_KEY,
      fetch: fetchImpl,
      ...(env.SMS_SENDER ? { sender: env.SMS_SENDER } : {}),
    });
  }

  const transports: ConstructorParameters<typeof PushRouter>[0] = {};
  if (env.FCM_SERVICE_ACCOUNT_JSON) {
    const account = z
      .object({ client_email: z.string(), private_key: z.string(), project_id: z.string() })
      .safeParse(safeJson(env.FCM_SERVICE_ACCOUNT_JSON));
    if (!account.success)
      throw new MessagingConfigError('FCM_SERVICE_ACCOUNT_JSON is not a service account key');
    transports.fcm = new FcmPushProvider({
      projectId: account.data.project_id,
      fetch: fetchImpl,
      auth: new GoogleServiceAccountTokenSource(
        {
          clientEmail: account.data.client_email,
          privateKey: account.data.private_key,
          projectId: account.data.project_id,
        },
        fetchImpl,
      ),
    });
  }
  const http2 = options.http2Fetch ?? (env.APNS_KEY_ID ? createHttp2Fetch() : undefined);
  if (env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY && env.APNS_BUNDLE_ID && http2) {
    transports.apns = new ApnsPushProvider({
      teamId: env.APNS_TEAM_ID,
      keyId: env.APNS_KEY_ID,
      privateKey: env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      bundleId: env.APNS_BUNDLE_ID,
      production: env.APNS_PRODUCTION,
      fetch: http2,
    });
  }
  if (env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    transports.webpush = new WebPushProvider({
      subject: env.VAPID_SUBJECT,
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: env.VAPID_PRIVATE_KEY,
      fetch: fetchImpl,
    });
  }

  const codeMode = env.CODE_DELIVERY_MODE ?? 'live';
  if (codeMode === 'test' && env.APP_ENV === 'production') {
    throw new MessagingConfigError(
      'Test-mode code delivery is not allowed when APP_ENV=production',
    );
  }
  const codeSender: CodeSender =
    codeMode === 'test'
      ? new TestCodeSender()
      : new ProviderCodeSender({
          whatsapp,
          ...(sms ? { sms } : {}),
          smsFallback: env.CODE_SMS_FALLBACK,
          codeValidityMinutes: env.CODE_VALIDITY_MINUTES,
          logger,
          ...(options.onCodeDelivery ? { onDelivery: options.onCodeDelivery } : {}),
        });

  return {
    mode: 'live',
    push: new PushRouter(transports),
    whatsapp,
    sms,
    codeSender,
    webhook,
    close: () => http2?.close?.(),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
