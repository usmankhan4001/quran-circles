import type { ApiClient, Me } from '@qc/contracts';
import { client } from './client';
import { db } from './db';
import { stack } from './env';

/**
 * Synthetic people. Numbers are made up in the +92 312 range and are different on every run, so a
 * reused stack never mixes runs; names are obviously fake. Nothing here is a real person.
 */
const seed = Math.floor(Math.random() * 9_000_000);
let counter = 0;

export function syntheticPhone(): string {
  counter += 1;
  return `+92312${String((seed + counter * 7919) % 10_000_000).padStart(7, '0')}`;
}

function syntheticIp(): string {
  const n = seed + counter * 31;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${(n & 254) + 1}`;
}

export interface Person {
  phone: string;
  ip: string;
  me: Me;
  accessToken: string;
  refreshToken: string;
  isNewAccount: boolean;
  api: ApiClient;
}

/** Signs in with a phone code through the real auth endpoints (test-mode fixed code). */
export async function signIn(phone: string = syntheticPhone()): Promise<Person> {
  const ip = syntheticIp();
  const anon = client({ ip });
  const challenge = await anon.auth.requestCode({
    body: { phone, locale: 'en', channel: 'whatsapp' },
  });
  const signedIn = await anon.auth.verifyCode({
    body: { challengeId: challenge.challengeId, code: stack().fixedCode, deviceLabel: 'e2e' },
  });
  const person: Person = {
    phone,
    ip,
    me: signedIn.me,
    accessToken: signedIn.accessToken,
    refreshToken: signedIn.refreshToken,
    isNewAccount: signedIn.isNewAccount,
    api: undefined as unknown as ApiClient,
  };
  person.api = client({ ip, token: () => person.accessToken });
  return person;
}

/**
 * The first national admin. There is no API or command for it (FINDINGS.md, F-01), so this
 * writes a pending national invite straight into the database, then signs in through the API,
 * which turns the invite into the role exactly as for any invited coordinator.
 */
export async function bootstrapNationalAdmin(): Promise<Person> {
  const admin = await signIn(await nationalAdminInvite());
  if (!admin.me.roles.some((r) => r.role === 'national_admin')) {
    throw new Error('bootstrap invite did not become a national_admin role at sign-in');
  }
  return admin;
}

/**
 * Writes the pending national invite only and returns the number, for a flow that signs in some
 * other way (the console's own sign-in page). A number can ask for one code a minute, so the
 * API must not have asked for one first.
 */
export async function nationalAdminInvite(): Promise<string> {
  const phone = syntheticPhone();
  await db().query(
    `insert into coordinator_invites (phone_e164, display_name, role, scope_type, expires_at)
     values ($1, 'E2E Admin', 'national_admin', 'national', now() + interval '1 day')`,
    [phone],
  );
  return phone;
}

/** An invited venue coordinator: invited by `by` through the API, then signed in with a code. */
export async function inviteVenueCoordinator(by: Person, venueId: string): Promise<Person> {
  const phone = syntheticPhone();
  await by.api.adminRoles.invite({
    body: { role: 'venue_coordinator', venueId, phone, displayName: 'E2E Coordinator' },
  });
  return signIn(phone);
}

/** A push device with a fake token. The worker's fake provider "sends" to it. */
export async function addWebPushDevice(person: Person): Promise<void> {
  await person.api.devices.register({
    body: {
      platform: 'web',
      provider: 'webpush',
      token: `e2e-fake-webpush-${person.me.id}`,
      locale: 'en',
    },
  });
}
