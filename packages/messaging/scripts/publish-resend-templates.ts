/**
 * Uploads every email template (English and Urdu) to Resend as stored, published templates, so they
 * show in the Resend dashboard under Templates. Safe to run again: a template with the same name is
 * updated, not duplicated.
 *
 * The API key is read from `RESEND_API_KEY`. Keep it in the git-ignored `packages/messaging/.env.local`:
 *   node --env-file=packages/messaging/.env.local --import tsx packages/messaging/scripts/publish-resend-templates.ts
 * or `pnpm --filter @qc/messaging email:publish`. The key is never printed.
 */
import { LOCALES } from '@qc/contracts';
import {
  EMAIL_FROM,
  EMAIL_TEMPLATE_NAMES,
  renderTemplateSource,
  type EmailTemplateName,
} from '../src/email';

const API = 'https://api.resend.com';
const key = process.env.RESEND_API_KEY;
if (!key) throw new Error('Set RESEND_API_KEY (packages/messaging/.env.local).');

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json.message ?? ''}`.trim());
  return json;
}

const names: Record<EmailTemplateName, string> = {
  sign_in_code: 'sign-in-code',
  welcome: 'welcome',
  join_confirmation: 'join-confirmation',
  session_reminder: 'session-reminder',
  account_deleted: 'account-deleted',
};

const existing = new Map<string, string>();
const list = await call<{ data?: { id: string; name: string }[] }>('GET', '/templates');
for (const t of list.data ?? []) existing.set(t.name, t.id);

for (const template of EMAIL_TEMPLATE_NAMES) {
  for (const locale of LOCALES) {
    const name = `qc-${names[template]}-${locale}`;
    const src = renderTemplateSource(template, locale);
    const payload = {
      name,
      from: EMAIL_FROM,
      subject: src.subject,
      html: src.html,
      text: src.text,
      variables: src.variables.map((v) => ({
        key: v.key,
        type: 'string',
        ...(v.fallbackValue ? { fallback_value: v.fallbackValue } : {}),
      })),
    };
    const id = existing.get(name);
    const saved = id
      ? await call<{ id: string }>('PATCH', `/templates/${id}`, payload)
      : await call<{ id: string }>('POST', '/templates', payload);
    await call('POST', `/templates/${saved.id}/publish`);
    console.log(`${id ? 'updated' : 'created'} ${name} ${saved.id}`);
  }
}
