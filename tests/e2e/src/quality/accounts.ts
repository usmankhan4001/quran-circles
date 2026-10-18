import type { BrowserContext } from '@playwright/test';
import type { ApiClient, Tokens } from '@qc/contracts';
import { client } from '../support/client';
import { stack } from '../support/env';
import { nationalAdminInvite, syntheticPhone } from '../support/people';
import { SEED } from '../support/seed';
import { pktDate } from '../support/time';

/** A synthetic signed-in person with the whole token set, ready to hand to a browser. */
export interface Account {
  tokens: Tokens;
  api: ApiClient;
}

let ipCounter = 0;
function qualityIp(): string {
  ipCounter += 1;
  return `10.251.${(ipCounter >> 8) & 255}.${(ipCounter & 254) + 1}`;
}

/** Signs in through the real code endpoints (test-mode fixed code). */
export async function signInAccount(phone: string = syntheticPhone()): Promise<Account> {
  const ip = qualityIp();
  const anon = client({ ip });
  const challenge = await anon.auth.requestCode({
    body: { phone, locale: 'en', channel: 'whatsapp' },
  });
  const signed = await anon.auth.verifyCode({
    body: { challengeId: challenge.challengeId, code: stack().fixedCode, deviceLabel: 'quality' },
  });
  const tokens: Tokens = {
    accessToken: signed.accessToken,
    accessTokenExpiresAt: signed.accessTokenExpiresAt,
    refreshToken: signed.refreshToken,
    refreshTokenExpiresAt: signed.refreshTokenExpiresAt,
  };
  return { tokens, api: client({ ip, token: () => tokens.accessToken }) };
}

/** A national admin made the supported way (`bootstrap-admin`, then a code sign-in). */
export async function nationalAdmin(): Promise<Account> {
  return signInAccount(await nationalAdminInvite());
}

/** A venue coordinator for Al-Noor, invited by a national admin. */
export async function venueCoordinator(admin: Account): Promise<Account> {
  const phone = syntheticPhone();
  await admin.api.adminRoles.invite({
    body: {
      role: 'venue_coordinator',
      venueId: SEED.venueNoor,
      phone,
      displayName: 'Quality Coordinator',
    },
  });
  return signInAccount(phone);
}

/** Synthetic attendee with a display name, so screens that need one render fully. */
export async function attendee(): Promise<Account> {
  const person = await signInAccount();
  await person.api.me.update({ body: { displayName: 'Quality Attendee' } });
  return person;
}

/**
 * Adds `count` synthetic sessions at Al-Noor (Rawalpindi), so Nearby has a long list to scroll.
 * Returns the ids. Titles say "(synthetic)" so nobody mistakes them for real circles.
 */
export async function addManySessions(admin: Account, count: number): Promise<string[]> {
  const ids: string[] = [];
  const startsOn = pktDate(new Date());
  const programs = ['dora', 'circles'] as const;
  for (let i = 0; i < count; i += 1) {
    const hour = 5 + (i % 17);
    const session = await admin.api.adminSessions.create({
      body: {
        kind: 'recurring',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn,
        venueId: SEED.venueNoor,
        program: programs[i % programs.length] ?? 'dora',
        title: {
          en: `Quality circle ${String(i + 1).padStart(3, '0')} (synthetic)`,
          ur: `کوالٹی حلقہ ${i + 1} (فرضی)`,
        },
        section: i % 2 ? 'family' : 'women',
        language: i % 3 ? 'ur' : 'en',
        localStartTime: `${String(hour).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
        durationMinutes: 45,
      },
    });
    ids.push(session.id);
  }
  return ids;
}

export type ColorChoice = 'light' | 'dark' | 'highContrast';
export type TextStep = 0 | 1 | 2 | 3;
export interface Appearance {
  locale: 'en' | 'ur';
  textSize: TextStep;
  color: ColorChoice;
}

/**
 * Puts a signed-in session into a browser context the way each app keeps it, before any page
 * script runs. Tokens are written only when absent: refresh tokens rotate, and putting an old one
 * back would sign the device out (reuse detection).
 */
export async function giveSession(
  context: BrowserContext,
  app: 'user-app' | 'admin-app' | 'console',
  account: Account,
): Promise<void> {
  const entry =
    app === 'user-app'
      ? { area: 'local' as const, key: 'qc.tokens.v1', value: JSON.stringify(account.tokens) }
      : app === 'admin-app'
        ? {
            area: 'session' as const,
            key: 'qc.admin.tokens',
            value: JSON.stringify(account.tokens),
          }
        : {
            area: 'session' as const,
            key: 'qc.console.refresh',
            value: account.tokens.refreshToken,
          };
  await context.addInitScript((e) => {
    const store = e.area === 'local' ? window.localStorage : window.sessionStorage;
    if (store.getItem(e.key) === null) store.setItem(e.key, e.value);
  }, entry);
}

/** The storage writes that select an appearance in each app (read at start-up). */
export function appearanceEntries(
  app: 'user-app' | 'admin-app' | 'console',
  look: Appearance,
  extra: { cityId?: string } = {},
): Record<string, string> {
  if (app === 'user-app') {
    return {
      'qc.preferences.v1': JSON.stringify({
        locale: look.locale,
        textSize: look.textSize,
        color: look.color,
        cityId: extra.cityId ?? SEED.rawalpindi,
        areaId: null,
      }),
    };
  }
  if (app === 'admin-app') {
    return {
      'qc.admin.appearance': JSON.stringify({
        locale: look.locale,
        textSize: look.textSize,
        colorChoice: look.color,
      }),
    };
  }
  // The console has light, dark and system only; high contrast is checked through forced colours.
  return {
    'qc.console.locale': look.locale,
    'qc.console.theme': look.color === 'dark' ? 'dark' : 'light',
    'qc.console.textSize': String(look.textSize),
  };
}
