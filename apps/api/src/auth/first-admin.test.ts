import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@qc/db';
import { FakeCodeSender } from './code-sender';
import { AuthConfigError, createAuthConfig, firstAdminFromEnv } from './config';
import { ensureFirstAdmin, redirectingCodeSender } from './first-admin';
import { PHONE_A, PHONE_B, TEST_SECRET, createHarness, type Harness } from './testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const ADMIN = { email: 'admin@example.org', phone: PHONE_A, codeTo: 'inbox@example.org' };

describe('firstAdminFromEnv', () => {
  it('reads the three variables, trimmed and lower-cased', () => {
    expect(
      firstAdminFromEnv({
        BOOTSTRAP_ADMIN_EMAIL: ' Admin@Example.org ',
        BOOTSTRAP_ADMIN_PHONE: ` ${PHONE_A} `,
        BOOTSTRAP_ADMIN_CODE_TO: 'Inbox@Example.org',
      }),
    ).toEqual(ADMIN);
  });
  it('is null when nothing is set, and needs the email and the phone together', () => {
    expect(firstAdminFromEnv({})).toBeNull();
    expect(() => firstAdminFromEnv({ BOOTSTRAP_ADMIN_EMAIL: ADMIN.email })).toThrow(
      AuthConfigError,
    );
    expect(() => firstAdminFromEnv({ BOOTSTRAP_ADMIN_CODE_TO: ADMIN.codeTo })).toThrow(
      AuthConfigError,
    );
  });
  it('refuses a bad address or number through the config', () => {
    const base = { appEnv: 'test' as const, secret: TEST_SECRET };
    expect(() =>
      createAuthConfig({ ...base, firstAdmin: { ...ADMIN, email: 'not-an-address' } }),
    ).toThrow(AuthConfigError);
    expect(() => createAuthConfig({ ...base, firstAdmin: { ...ADMIN, phone: '0300' } })).toThrow(
      AuthConfigError,
    );
    expect(() => createAuthConfig({ ...base, firstAdmin: { ...ADMIN, codeTo: 'x' } })).toThrow(
      AuthConfigError,
    );
    expect(createAuthConfig({ ...base, firstAdmin: ADMIN }).firstAdmin).toEqual(ADMIN);
    expect(createAuthConfig(base).firstAdmin).toBeNull();
  });
});

describe('redirectingCodeSender', () => {
  const message = (email: string) => ({
    email,
    code: '123456',
    locale: 'ur' as const,
    channel: 'email' as const,
  });

  it("sends the admin identity's code to the redirect mailbox only", async () => {
    const inner = new FakeCodeSender();
    const sender = redirectingCodeSender(inner, ADMIN);
    await sender.send(message('Admin@Example.org'));
    await sender.send(message('someone@example.org'));
    expect(inner.sent.map((m) => m.email)).toEqual(['inbox@example.org', 'someone@example.org']);
    expect(inner.sent[0]?.code).toBe('123456');
  });
  it('leaves phone messages and every other identity alone, and is a pass-through without a redirect', async () => {
    const inner = new FakeCodeSender();
    const sender = redirectingCodeSender(inner, ADMIN);
    await sender.send({ phone: PHONE_B, code: '654321', locale: 'en', channel: 'whatsapp' });
    expect(inner.last).toMatchObject({ phone: PHONE_B });
    expect(inner.last?.email).toBeUndefined();
    expect(redirectingCodeSender(inner, null)).toBe(inner);
    expect(redirectingCodeSender(inner, { ...ADMIN, codeTo: null })).toBe(inner);
  });
});

describe('ensureFirstAdmin', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({
      config: { otp: { phoneSignIn: false }, firstAdmin: ADMIN },
    });
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  const invites = () =>
    h.db
      .select()
      .from(schema.coordinatorInvites)
      .where(eq(schema.coordinatorInvites.email, ADMIN.email));

  it('invites once, then does nothing while the invite waits', async () => {
    expect(await ensureFirstAdmin(h.db, null, h.logger)).toBe('not_configured');
    expect(await ensureFirstAdmin(h.db, ADMIN, h.logger, h.clock.now())).toBe('invited');
    expect(await ensureFirstAdmin(h.db, ADMIN, h.logger, h.clock.now())).toBe('invite_pending');
    const rows = await invites();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: 'national_admin',
      status: 'pending',
      phoneE164: PHONE_A,
    });
  });

  it('the sign-in by that address takes the role, and later starts do nothing', async () => {
    await ensureFirstAdmin(h.db, ADMIN, h.logger, h.clock.now());
    const signedIn = await h.signInByEmail(ADMIN.email, { phone: PHONE_A });
    expect(signedIn.status).toBe(200);
    const [role] = await h.db
      .select({ role: schema.roleAssignments.role })
      .from(schema.roleAssignments);
    expect(role?.role).toBe('national_admin');
    expect(await ensureFirstAdmin(h.db, ADMIN, h.logger, h.clock.now())).toBe('admin_exists');
    expect(await invites()).toHaveLength(1);
  });

  it('keeps the usual cooldown for the admin identity: the redirect changes delivery only', async () => {
    await ensureFirstAdmin(h.db, ADMIN, h.logger, h.clock.now());
    const first = await h.requestEmailCode(ADMIN.email, { phone: PHONE_A });
    expect(first.status).toBe(202);
    const again = await h.requestEmailCode(ADMIN.email, { phone: PHONE_A });
    expect(again.status).toBe(429);
  });
});
