import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import type { EndpointId, Me, Principal, SignInResponse } from '@qc/contracts';
import { call, expectOk, type CallInput, type CallOptions, type CallResult } from './http';

/**
 * Synthetic people only. Numbers are made up in the +92 313 range with a random run seed, so two
 * runs (or a run on a shared staging database) never collide; every name is obviously fake.
 * Addresses are private 10.x addresses, one per person, sent as X-Forwarded-For (the API trusts
 * it only with TRUST_PROXY=true, as behind the production proxy).
 */
export class Synthetic {
  private counter = 0;
  private readonly seed: number;

  constructor(
    private readonly prefix = '+92313',
    seed?: number,
  ) {
    this.seed = seed ?? randomInt(0, 9_000_000);
  }

  phone(): string {
    this.counter += 1;
    return `${this.prefix}${String((this.seed + this.counter * 7919) % 10_000_000).padStart(7, '0')}`;
  }

  ip(): string {
    this.counter += 1;
    const n = (this.seed * 31 + this.counter) % 16_000_000;
    return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${(n & 254) + 1}`;
  }
}

export interface Person {
  label: string;
  userId: string;
  token: string;
  refreshToken: string;
  ip: string;
  me: Me;
}

export interface Api {
  baseUrl: string;
  /** The API's test-mode sign-in code (`AUTH_FIXED_CODE`). Refused by the API in production. */
  fixedCode: string;
  synthetic: Synthetic;
  options?: CallOptions;
}

/** Calls an endpoint as a person (or anonymously with `null`), from their own address. */
export function as(
  api: Api,
  who: Person | null,
  id: EndpointId,
  input: Omit<CallInput, 'token' | 'ip'> & { ip?: string } = {},
  options?: CallOptions,
): Promise<CallResult> {
  return call(
    api.baseUrl,
    id,
    { ...input, token: who?.token ?? null, ip: input.ip ?? who?.ip },
    options ?? api.options,
  );
}

/** Signs in through the real sign-in endpoints with the test-mode code. */
export async function signIn(
  api: Api,
  label: string,
  phone: string = api.synthetic.phone(),
): Promise<Person> {
  const ip = api.synthetic.ip();
  const challenge = expectOk<{ challengeId: string }>(
    await call(
      api.baseUrl,
      'auth.requestCode',
      { body: { phone, locale: 'en', channel: 'whatsapp' }, ip },
      api.options,
    ),
    `sign-in code for ${label}`,
  );
  const signedIn = expectOk<z.infer<typeof SignInResponse>>(
    await call(
      api.baseUrl,
      'auth.verifyCode',
      {
        body: { challengeId: challenge.challengeId, code: api.fixedCode, deviceLabel: 'qc-load' },
        ip,
      },
      api.options,
    ),
    `sign-in for ${label}`,
  );
  return {
    label,
    userId: signedIn.me.id,
    token: signedIn.accessToken,
    refreshToken: signedIn.refreshToken,
    ip,
    me: signedIn.me,
  };
}

/** Re-reads the person's live roles (after an invite was accepted, or a role revoked). */
export async function refreshMe(api: Api, person: Person): Promise<Person> {
  const me = expectOk<Me>(await as(api, person, 'me.get'), `me for ${person.label}`);
  return { ...person, me };
}

/** The person as the scope engine sees them: live (non-revoked) roles only. */
export function principalOf(person: Person | null): Principal | null {
  if (!person) return null;
  return {
    userId: person.userId,
    assignments: person.me.roles.map((r) => ({
      role: r.role,
      cityId: r.cityId,
      venueId: r.venueId,
    })),
  };
}

/** Runs `fn` over `items` with at most `limit` at once. */
export async function pool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Today's date in Pakistan (YYYY-MM-DD), the date the API's day rules use. */
export function pakistanDate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
