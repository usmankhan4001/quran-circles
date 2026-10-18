import { describe, expect, it } from 'vitest';
import {
  CodeDeliveryError,
  DEFAULT_CODE_VALIDITY_MINUTES,
  ProviderCodeSender,
  TestCodeSender,
  type CodeDeliveryReport,
  type CodeSender,
} from './code-sender';
import { FakeSmsProvider, FakeWhatsAppProvider } from './fakes';
import { createMemoryLogger } from './logger';

const PHONE = '+923000000001';
const CODE = '654321';

describe('provider code sender', () => {
  const setup = (opts: { smsFallback?: boolean; noSms?: boolean; noWhatsApp?: boolean } = {}) => {
    const whatsapp = new FakeWhatsAppProvider();
    const sms = new FakeSmsProvider();
    const logger = createMemoryLogger();
    const reports: CodeDeliveryReport[] = [];
    const sender = new ProviderCodeSender({
      ...(opts.noWhatsApp ? {} : { whatsapp }),
      ...(opts.noSms ? {} : { sms }),
      ...(opts.smsFallback === undefined ? {} : { smsFallback: opts.smsFallback }),
      logger,
      onDelivery: (r) => reports.push(r),
    });
    return { whatsapp, sms, logger, reports, sender };
  };

  it('is assignable to the CodeSender shape the auth lane calls', () => {
    const sender: CodeSender = setup().sender;
    expect(typeof sender.send).toBe('function');
  });

  it('sends the WhatsApp authentication template with the code in body and button', async () => {
    const { sender, whatsapp, sms, reports } = setup();
    const result = await sender.send({
      phone: PHONE,
      code: CODE,
      locale: 'ur',
      channel: 'whatsapp',
    });
    expect(result).toEqual({ channel: 'whatsapp' });
    expect(whatsapp.sent).toHaveLength(1);
    expect(whatsapp.sent[0]).toMatchObject({
      to: PHONE,
      templateName: 'qc_auth_code',
      language: 'ur',
      bodyParams: [CODE],
      buttonParam: CODE,
    });
    expect(sms.sent).toHaveLength(0);
    expect(reports).toEqual([
      { channel: 'whatsapp', outcome: 'sent', fellBack: false, costCategory: 'authentication' },
    ]);
  });

  it.each([
    ['transient failure', { status: 'transient_failure', code: 'wa_130429' } as const],
    [
      'recipient not on WhatsApp',
      { status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' } as const,
    ],
    [
      'template problem',
      { status: 'permanent_failure', code: 'wa_132001', cause: 'template' } as const,
    ],
  ])('falls back to SMS after a WhatsApp %s', async (_n, failure) => {
    const { sender, whatsapp, sms, reports } = setup();
    whatsapp.failNext(failure);
    const result = await sender.send({
      phone: PHONE,
      code: CODE,
      locale: 'en',
      channel: 'whatsapp',
    });
    // The auth lane passes this on, so the app says "check your SMS".
    expect(result).toEqual({ channel: 'sms' });
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]!.to).toBe(PHONE);
    expect(sms.sent[0]!.body).toBe(
      `${CODE} is your Quran Circles code. It works for 5 minutes. Do not share it.`,
    );
    expect(reports).toEqual([
      { channel: 'sms', outcome: 'sent', fellBack: true, costCategory: 'authentication' },
    ]);
  });

  it('renders the SMS in Urdu and uses the caller-supplied validity', async () => {
    const { sender, sms } = setup();
    await sender.send({ phone: PHONE, code: CODE, locale: 'ur', channel: 'sms', minutes: 5 });
    expect(sms.sent[0]!.body).toContain(CODE);
    expect(sms.sent[0]!.body).toContain('5');
    expect(sms.sent[0]!.body).toContain('قرآن حلقے');
  });

  it('states the real code lifetime by default: 5 minutes, as the API expires codes (SEC-21)', async () => {
    expect(DEFAULT_CODE_VALIDITY_MINUTES).toBe(5);
    const { sender, sms } = setup();
    await sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms' });
    expect(sms.sent[0]!.body).toContain('It works for 5 minutes.');
    expect(sms.sent[0]!.body).not.toContain('10 minutes');
  });

  it('takes the validity from its setting, and the caller wins over the setting', async () => {
    const sms = new FakeSmsProvider();
    const sender = new ProviderCodeSender({ sms, codeValidityMinutes: 3 });
    await sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms' });
    await sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms', minutes: 4 });
    expect(sms.sent.map((m) => /works for (\d+) minutes/.exec(m.body)?.[1])).toEqual(['3', '4']);
  });

  it('goes straight to SMS when the caller asks for SMS', async () => {
    const { sender, whatsapp, sms } = setup();
    const result = await sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms' });
    expect(result).toEqual({ channel: 'sms' });
    expect(whatsapp.sent).toHaveLength(0);
    expect(sms.sent).toHaveLength(1);
  });

  it('throws when WhatsApp fails and the fallback is off', async () => {
    const { sender, whatsapp, sms, reports } = setup({ smsFallback: false });
    whatsapp.failNext({ status: 'transient_failure', code: 'wa_1' });
    await expect(
      sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'whatsapp' }),
    ).rejects.toMatchObject({
      name: 'CodeDeliveryError',
      code: 'whatsapp_failed',
    });
    expect(sms.sent).toHaveLength(0);
    expect(reports[0]).toMatchObject({ outcome: 'failed' });
  });

  it('throws when WhatsApp and SMS both fail', async () => {
    const { sender, whatsapp, sms } = setup();
    whatsapp.failNext({ status: 'transient_failure', code: 'wa_1' });
    sms.failNext({ status: 'transient_failure', code: 'sms_http_503' });
    const error = await sender
      .send({ phone: PHONE, code: CODE, locale: 'en', channel: 'whatsapp' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodeDeliveryError);
    expect((error as CodeDeliveryError).code).toBe('all_channels_failed');
  });

  it('throws when nothing is configured for the channel', async () => {
    const { sender } = setup({ noSms: true, noWhatsApp: true });
    await expect(
      sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms' }),
    ).rejects.toMatchObject({
      code: 'no_channel_configured',
    });
  });

  it('never logs the phone number, the code or the message text', async () => {
    const { sender, whatsapp, sms, logger } = setup();
    whatsapp.failNext({ status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' });
    await sender.send({ phone: PHONE, code: CODE, locale: 'en', channel: 'whatsapp' });
    sms.failNext({ status: 'transient_failure', code: 'sms_http_500' });
    await sender
      .send({ phone: PHONE, code: CODE, locale: 'en', channel: 'sms' })
      .catch(() => undefined);
    const dump = logger.dump();
    expect(dump).not.toContain('923000000001');
    expect(dump).not.toContain(CODE);
    expect(dump).not.toContain('Quran Circles code');
    expect(logger.lines.length).toBeGreaterThan(0);
  });
});

describe('test-mode code sender', () => {
  it('keeps codes in memory and calls no provider', async () => {
    const sender = new TestCodeSender();
    await sender.send({ phone: PHONE, code: '111111', locale: 'en', channel: 'whatsapp' });
    await sender.send({ phone: PHONE, code: '222222', locale: 'en', channel: 'sms' });
    expect(sender.lastCode(PHONE)).toBe('222222');
    expect(sender.lastCode('+923000000002')).toBeUndefined();
    expect(sender.requests).toHaveLength(2);
  });

  it('keeps only the newest codes per number', async () => {
    const sender = new TestCodeSender({ keep: 2 });
    for (const code of ['000001', '000002', '000003']) {
      await sender.send({ phone: PHONE, code, locale: 'en', channel: 'sms' });
    }
    expect(sender.lastCode(PHONE)).toBe('000003');
  });
});
