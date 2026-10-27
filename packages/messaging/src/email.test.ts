import { describe, expect, it } from 'vitest';
import { CodeDeliveryError, ProviderCodeSender, TestCodeSender } from './code-sender';
import { renderPlainEmail, type EmailRenderer } from './email-render';
import { MessagingConfigError, createMessaging } from './env';
import { FakeEmailProvider } from './fakes';
import { DEFAULT_EMAIL_FROM } from './mail-domain';
import { ConsoleEmailProvider, maskEmail } from './providers/email';
import { RESEND_API_URL, ResendEmailProvider } from './providers/resend';
import { bodyOf, createFakeFetch } from './test/fake-fetch';

const MESSAGE = {
  to: 'reader@example.org',
  subject: 'Subject',
  text: 'Plain',
  html: '<p>Html</p>',
};
const KEY = 're_test_not_a_real_key';

describe('Resend provider', () => {
  const make = (respond: Parameters<typeof createFakeFetch>[0]) => {
    const fetch = createFakeFetch(respond);
    return {
      fetch,
      provider: new ResendEmailProvider({
        apiKey: KEY,
        from: 'Quran Circles <codes@mail.example.org>',
        replyTo: 'help@example.org',
        fetch,
      }),
    };
  };

  it('posts the message with a bearer key to the emails endpoint', async () => {
    const { provider, fetch } = make(() => ({ status: 200, body: { id: 'em-1' } }));
    expect(await provider.send(MESSAGE)).toEqual({ status: 'ok', providerMessageId: 'em-1' });
    const request = fetch.requests[0]!;
    expect(request.url).toBe(RESEND_API_URL);
    expect(request.init.method).toBe('POST');
    expect(request.init.headers!.authorization).toBe(`Bearer ${KEY}`);
    expect(bodyOf(request)).toEqual({
      from: 'Quran Circles <codes@mail.example.org>',
      to: ['reader@example.org'],
      subject: 'Subject',
      text: 'Plain',
      html: '<p>Html</p>',
      reply_to: 'help@example.org',
    });
  });

  it.each([
    [429, 'transient_failure'],
    [500, 'transient_failure'],
    [503, 'transient_failure'],
    [401, 'permanent_failure'],
    [403, 'permanent_failure'],
    [422, 'permanent_failure'],
  ])('status %i is a %s with a fixed code', async (status, expected) => {
    const { provider } = make(() => ({
      status,
      body: { message: 'reader@example.org is not allowed' },
    }));
    const result = await provider.send(MESSAGE);
    expect(result.status).toBe(expected);
    // Nothing from the response, the address or the key leaks into the code.
    expect(JSON.stringify(result)).not.toContain('example.org');
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it('treats a network error as transient', async () => {
    const { provider } = make(() => new Error('down'));
    expect(await provider.send(MESSAGE)).toEqual({
      status: 'transient_failure',
      code: 'network_error',
    });
  });
});

describe('plain email placeholder', () => {
  it('renders the code in English and Urdu, with a plain-text part', () => {
    for (const locale of ['en', 'ur'] as const) {
      const mail = renderPlainEmail('auth_code', locale, { code: '123456', minutes: 5 });
      expect(mail.subject).toContain('123456');
      expect(mail.text).toContain('123456');
      expect(mail.text).toContain('5');
      expect(mail.html).toContain('123456');
      expect(mail.html).toContain(`lang="${locale}"`);
    }
    expect(renderPlainEmail('auth_code', 'ur', { code: '123456', minutes: 5 }).html).toContain(
      'dir="rtl"',
    );
  });

  it('refuses anything that is not a six-digit code', () => {
    expect(() => renderPlainEmail('auth_code', 'en', { code: '<b>1', minutes: 5 })).toThrow();
    expect(() => renderPlainEmail('auth_code', 'en', { code: '123456', minutes: '5<' })).toThrow();
  });
});

describe('email code delivery', () => {
  const REQUEST = {
    email: 'reader@example.org',
    code: '654321',
    locale: 'en',
    channel: 'email',
  } as const;

  it('sends the code email and reports it', async () => {
    const email = new FakeEmailProvider();
    const reports: unknown[] = [];
    const sender = new ProviderCodeSender({ email, onDelivery: (r) => reports.push(r) });
    expect(await sender.send(REQUEST)).toEqual({ channel: 'email' });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('reader@example.org');
    expect(email.sent[0]!.text).toContain('654321');
    expect(email.sent[0]!.text).toContain('5 minutes');
    expect(reports).toEqual([
      { channel: 'email', outcome: 'sent', fellBack: false, costCategory: 'authentication' },
    ]);
  });

  it('uses the renderer it is given, so designed templates plug in', async () => {
    const email = new FakeEmailProvider();
    const seen: unknown[] = [];
    const renderEmail: EmailRenderer = (name, locale, data) => {
      seen.push({ name, locale, data });
      return { subject: 'S', text: 'T', html: 'H' };
    };
    const sender = new ProviderCodeSender({ email, renderEmail });
    await sender.send({ ...REQUEST, locale: 'ur', minutes: 7 });
    expect(seen).toEqual([
      { name: 'auth_code', locale: 'ur', data: { code: '654321', minutes: 7 } },
    ]);
    expect(email.sent[0]).toMatchObject({ subject: 'S', text: 'T', html: 'H' });
  });

  it('never falls back to a phone channel, and reports a failure with a fixed code', async () => {
    const email = new FakeEmailProvider();
    email.failNext({ status: 'permanent_failure', code: 'resend_http_403' });
    const sender = new ProviderCodeSender({ email });
    const failure = await sender.send(REQUEST).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(CodeDeliveryError);
    expect((failure as CodeDeliveryError).code).toBe('email_failed');
    expect(String(failure)).not.toContain('654321');
  });

  it('fails when no email provider is set or no address is given', async () => {
    const none = new ProviderCodeSender({});
    expect(((await none.send(REQUEST).catch((e: unknown) => e)) as CodeDeliveryError).code).toBe(
      'no_channel_configured',
    );
    const sender = new ProviderCodeSender({ email: new FakeEmailProvider() });
    const noAddress = { ...REQUEST, email: undefined };
    expect(
      ((await sender.send(noAddress).catch((e: unknown) => e)) as CodeDeliveryError).code,
    ).toBe('no_recipient');
  });

  it('keeps the test-mode code for an address', async () => {
    const codes = new TestCodeSender();
    await codes.send(REQUEST);
    expect(codes.lastCode('reader@example.org')).toBe('654321');
  });
});

describe('console email fallback', () => {
  it('prints the message with the address masked, and sends nothing', async () => {
    const lines: string[] = [];
    const provider = new ConsoleEmailProvider((l) => lines.push(l));
    expect((await provider.send(MESSAGE)).status).toBe('ok');
    expect(lines.join('\n')).toContain('re***@example.org');
    expect(lines.join('\n')).not.toContain('reader@example.org');
    expect(maskEmail('a')).toBe('***');
  });
});

describe('email wiring from the environment', () => {
  const live = {
    MESSAGING_MODE: 'live',
    WHATSAPP_PHONE_NUMBER_ID: '1',
    WHATSAPP_ACCESS_TOKEN: 't',
  };

  it('sends through Resend with a key and a sender', async () => {
    const fetch = createFakeFetch(() => ({ status: 200, body: { id: 'em-1' } }));
    const m = createMessaging(
      { ...live, RESEND_API_KEY: KEY, EMAIL_FROM: 'QC <codes@mail.example.org>' },
      { fetch },
    );
    await m.codeSender.send({
      email: 'reader@example.org',
      code: '123456',
      locale: 'en',
      channel: 'email',
    });
    expect(fetch.requests[0]!.url).toBe(RESEND_API_URL);
  });

  it('sends from notifications@ on the mail domain unless a sender is set', () => {
    const m = createMessaging({ ...live, EMAIL_FROM: undefined, RESEND_API_KEY: KEY });
    expect(m.email).toBeInstanceOf(ResendEmailProvider);
    expect(DEFAULT_EMAIL_FROM).toBe('Quran Circles <notifications@qurancircles.doraquran.pk>');
  });

  it('refuses production without a key, and prints codes in development', async () => {
    expect(() => createMessaging({ ...live, APP_ENV: 'production' })).toThrow(MessagingConfigError);
    const m = createMessaging(live);
    expect(m.email).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('gives fake mode an inspectable email provider and test-mode codes by address', async () => {
    const m = createMessaging({});
    await m.codeSender.send({
      email: 'reader@example.org',
      code: '123456',
      locale: 'en',
      channel: 'email',
    });
    expect(m.fakes!.codes.lastCode('reader@example.org')).toBe('123456');
    expect(m.fakes!.email.sent).toHaveLength(0);
  });
});

describe('default code email', () => {
  it('uses the branded template: logo, html, plain text, both languages', async () => {
    const { FakeEmailProvider } = await import('./fakes');
    const { ProviderCodeSender } = await import('./code-sender');
    const { FakeWhatsAppProvider } = await import('./fakes');
    for (const locale of ['en', 'ur'] as const) {
      const email = new FakeEmailProvider();
      const sender = new ProviderCodeSender({
        email,
        whatsapp: new FakeWhatsAppProvider(),
        smsFallback: false,
      });
      await sender.send({ email: 'a@example.org', code: '123456', locale, channel: 'email' });
      const sent = email.sent[0]!;
      expect(sent.html).toContain('brand/email-logo.png');
      expect(sent.html).toContain('123456');
      expect(sent.text).toContain('123456');
    }
  });
});
