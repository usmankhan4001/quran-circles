import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  TEMPLATES,
  TEMPLATE_KEYS,
  templatePlaceholders,
  type TemplateKey,
  type TemplateVariables,
} from '@qc/contracts';
import { bodyOf, createFakeFetch } from '../test/fake-fetch';
import { buildWhatsAppRequest, positionalNames } from './whatsapp';
import { WhatsAppCloudClient, classifyGraphError } from './whatsapp-cloud';
import { allMetaSubmissions, toMetaSubmission } from './whatsapp-meta-templates';

const PHONE = '+923000000001';

const SAMPLE: { [K in TemplateKey]: TemplateVariables<K> } = {
  auth_code: { code: '123456', minutes: '10' },
  registration_confirmation: { name: 'Aisha', sessionTitle: 'Tafsir', venueName: 'Masjid', when: 'Fri 7:30 pm', link: 'https://x.test/a' },
  session_reminder: { sessionTitle: 'Tafsir', venueName: 'Masjid', when: 'Fri 7:30 pm', link: 'https://x.test/a' },
  session_changed: { sessionTitle: 'Tafsir', venueName: 'Masjid', newWhen: 'Fri 8 pm', link: 'https://x.test/a' },
  session_cancelled: { sessionTitle: 'Tafsir', when: 'Fri 7:30 pm', link: 'https://x.test/a' },
  waitlist_promoted: { sessionTitle: 'Tafsir', when: 'Fri 7:30 pm', link: 'https://x.test/a' },
  coordinator_invite: { inviterName: 'Ali', scopeName: 'Masjid', link: 'https://x.test/a' },
  circle_opened: { areaName: 'Area', circleName: 'Circle', link: 'https://x.test/a' },
};

describe('positional variables', () => {
  it('follows each language body order, which differs between English and Urdu', () => {
    const en = buildWhatsAppRequest({
      key: 'registration_confirmation',
      locale: 'en',
      variables: SAMPLE.registration_confirmation,
      to: PHONE,
    });
    const ur = buildWhatsAppRequest({
      key: 'registration_confirmation',
      locale: 'ur',
      variables: SAMPLE.registration_confirmation,
      to: PHONE,
    });
    expect(en.bodyParams).toEqual(['Aisha', 'Tafsir', 'Masjid', 'Fri 7:30 pm', 'https://x.test/a']);
    expect(ur.bodyParams).toEqual(['Aisha', 'Masjid', 'Tafsir', 'Fri 7:30 pm', 'https://x.test/a']);
    expect(en.templateName).toBe('qc_registration_confirmation');
    expect(en.language).toBe('en');
    expect(ur.language).toBe('ur');
  });

  it('puts the code in the body and the copy-code button for the authentication template', () => {
    const request = buildWhatsAppRequest({ key: 'auth_code', locale: 'en', variables: SAMPLE.auth_code, to: PHONE });
    expect(request.bodyParams).toEqual(['123456']);
    expect(request.buttonParam).toBe('123456');
  });

  it('rejects variables that do not match the catalog before anything is sent', () => {
    expect(() =>
      buildWhatsAppRequest({ key: 'auth_code', locale: 'en', variables: { code: 'abc', minutes: '10' }, to: PHONE }),
    ).toThrow();
  });

  it('every catalog template and language has one positional name per placeholder', () => {
    for (const key of TEMPLATE_KEYS) {
      for (const locale of LOCALES) {
        const names = positionalNames(key, locale);
        if (TEMPLATES[key].costCategory === 'authentication') {
          expect(names).toEqual(['code']);
          continue;
        }
        expect(new Set(names).size).toBe(names.length);
        expect([...names].sort()).toEqual([...templatePlaceholders(TEMPLATES[key].body[locale])].sort());
        const request = buildWhatsAppRequest({
          key,
          locale,
          variables: SAMPLE[key] as never,
          to: PHONE,
        });
        expect(request.bodyParams).toHaveLength(names.length);
        expect(request.bodyParams.every((p) => p.length > 0)).toBe(true);
      }
    }
  });
});

describe('Meta template submissions', () => {
  it('numbers variables in exactly the order used at send time, for every template and language', () => {
    for (const submission of allMetaSubmissions()) {
      const key = TEMPLATE_KEYS.find((k) => TEMPLATES[k].waTemplateName === submission.name)!;
      const locale = submission.language as 'en' | 'ur';
      expect(submission.variableOrder).toEqual(positionalNames(key, locale));
      const body = submission.components[0] as { text?: string; example?: { body_text: string[][] } };
      if (body.text !== undefined) {
        const numbers = [...body.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
        expect([...new Set(numbers)].sort()).toEqual(submission.variableOrder.map((_n, i) => i + 1));
        expect(body.text).not.toMatch(/\{[a-zA-Z]/);
        expect(body.example?.body_text[0]).toHaveLength(submission.variableOrder.length);
      }
    }
  });

  it('maps cost categories to Meta categories and marks Urdu as draft', () => {
    expect(toMetaSubmission('auth_code', 'en').category).toBe('AUTHENTICATION');
    expect(toMetaSubmission('session_reminder', 'en').category).toBe('UTILITY');
    expect(toMetaSubmission('circle_opened', 'ur').category).toBe('MARKETING');
    for (const s of allMetaSubmissions()) expect(s.urduStatus).toBe('draft');
  });

  it('uses a one-tap copy-code button for the authentication template', () => {
    const s = toMetaSubmission('auth_code', 'en');
    expect(JSON.stringify(s.components)).toContain('COPY_CODE');
  });
});

describe('WhatsApp Cloud client', () => {
  const make = (respond: Parameters<typeof createFakeFetch>[0]) => {
    const fetch = createFakeFetch(respond);
    return {
      fetch,
      client: new WhatsAppCloudClient({
        phoneNumberId: '1000000001',
        accessToken: 'fake-token',
        fetch,
        graphBaseUrl: 'https://graph.test/',
        apiVersion: 'v99.0',
      }),
    };
  };
  const request = buildWhatsAppRequest({
    key: 'session_changed',
    locale: 'en',
    variables: SAMPLE.session_changed,
    to: PHONE,
    callbackData: 'outbox:abc',
  });

  it('posts a template message to the configurable Graph endpoint', async () => {
    const { client, fetch } = make(() => ({ status: 200, body: { messages: [{ id: 'wamid.A1' }] } }));
    expect(await client.sendTemplate(request)).toEqual({ status: 'ok', providerMessageId: 'wamid.A1' });
    const sent = fetch.requests[0]!;
    expect(sent.url).toBe('https://graph.test/v99.0/1000000001/messages');
    expect(sent.init.headers!.authorization).toBe('Bearer fake-token');
    const body = bodyOf(sent) as Record<string, any>;
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('923000000001');
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('qc_session_changed');
    expect(body.template.language.code).toBe('en');
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'Tafsir',
      'Masjid',
      'Fri 8 pm',
      'https://x.test/a',
    ]);
    expect(body.biz_opaque_callback_data).toBe('outbox:abc');
  });

  it('adds the copy-code button parameter for authentication templates', async () => {
    const { client, fetch } = make(() => ({ status: 200, body: { messages: [{ id: 'wamid.A2' }] } }));
    await client.sendTemplate(
      buildWhatsAppRequest({ key: 'auth_code', locale: 'ur', variables: SAMPLE.auth_code, to: PHONE }),
    );
    const body = bodyOf(fetch.requests[0]!) as Record<string, any>;
    expect(body.template.components[1]).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: '123456' }],
    });
  });

  it('reads the access token lazily so it can rotate', async () => {
    let token = 'one';
    const fetch = createFakeFetch(() => ({ status: 200, body: { messages: [{ id: 'w' }] } }));
    const client = new WhatsAppCloudClient({ phoneNumberId: '1', accessToken: () => token, fetch });
    await client.sendTemplate(request);
    token = 'two';
    await client.sendTemplate(request);
    expect(fetch.requests.map((r) => r.init.headers!.authorization)).toEqual(['Bearer one', 'Bearer two']);
    expect(fetch.requests[0]!.url.startsWith('https://graph.facebook.com/')).toBe(true);
  });

  const errorRows: Array<[string, number, number | undefined, 'transient_failure' | 'permanent_failure', string?]> = [
    ['recipient not on WhatsApp', 400, 131026, 'permanent_failure', 'recipient'],
    ['re-engagement window', 400, 131047, 'permanent_failure', 'recipient'],
    ['template does not exist', 404, 132001, 'permanent_failure', 'template'],
    ['parameter mismatch', 400, 132000, 'permanent_failure', 'template'],
    ['expired access token', 401, 190, 'permanent_failure', 'configuration'],
    ['throughput limit', 429, 130429, 'transient_failure'],
    ['pair rate limit', 400, 131056, 'transient_failure'],
    ['server error without a code', 500, undefined, 'transient_failure'],
    ['unknown 400', 400, 12345, 'permanent_failure', 'other'],
  ];
  it.each(errorRows)('classifies %s', async (_n, status, code, kind, cause) => {
    const { client } = make(() => ({
      status,
      body: code === undefined ? {} : { error: { code, message: 'details' } },
      headers: { 'retry-after': '30' },
    }));
    const result = await client.sendTemplate(request);
    expect(result.status).toBe(kind);
    if (result.status === 'permanent_failure') expect(result.cause).toBe(cause);
    if (result.status === 'transient_failure') expect(result.retryAfterMs).toBe(30_000);
  });

  it('treats a success without a message id as transient, not as sent', async () => {
    const { client } = make(() => ({ status: 200, body: {} }));
    expect(await client.sendTemplate(request)).toMatchObject({ status: 'transient_failure' });
  });

  it('treats network failure as transient', async () => {
    const { client } = make(() => new Error('ECONNRESET'));
    expect(await client.sendTemplate(request)).toEqual({ status: 'transient_failure', code: 'network_error' });
  });

  it('classifyGraphError falls back to the HTTP status', () => {
    expect(classifyGraphError(undefined, 503)).toMatchObject({ transient: true, code: 'wa_http_503' });
    expect(classifyGraphError(undefined, 401)).toMatchObject({ transient: false, cause: 'configuration' });
  });
});
