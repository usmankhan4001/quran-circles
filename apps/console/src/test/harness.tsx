import type { ReactElement } from 'react';
import { render, screen, waitFor, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ERROR_CODES, makeApiError, type Me } from '@qc/contracts';
import { createMockHandler, type MockOptions } from '@qc/contracts/mock';
import * as fx from '@qc/contracts/fixtures';
import { AppProviders, AppRoutes } from '../App';
import type { Locale } from '../i18n';
import { memoryStore } from '../lib/storage';
import type { ThemeChoice } from '../theme';
import { messages } from '@qc/i18n';
import { rawalpindi, venueA } from './people';

export type TestRole = 'national' | 'city' | 'venue' | 'none';

export const ROLE_ROWS: Record<Exclude<TestRole, 'none'>, Me['roles'][number]> = {
  national: {
    id: '00000000-0000-4000-8000-0b0000000010',
    role: 'national_admin',
    scopeType: 'national',
    cityId: null,
    venueId: null,
    scopeName: null,
    createdAt: '2027-02-01T00:00:00Z',
  },
  city: {
    id: '00000000-0000-4000-8000-0b0000000011',
    role: 'city_coordinator',
    scopeType: 'city',
    cityId: rawalpindi!.id,
    venueId: null,
    scopeName: rawalpindi!.name,
    createdAt: '2027-02-01T00:00:00Z',
  },
  venue: {
    id: '00000000-0000-4000-8000-0b0000000012',
    role: 'venue_coordinator',
    scopeType: 'venue',
    cityId: venueA!.cityId,
    venueId: venueA!.id,
    scopeName: venueA!.name,
    createdAt: '2027-02-01T00:00:00Z',
  },
};

export const meFor = (role: TestRole): Me => ({
  ...fx.fixtureMe,
  displayName: 'Test Coordinator',
  roles: role === 'none' ? [] : [ROLE_ROWS[role]],
});

const page = <T,>(items: T[]) => ({ items, nextCursor: null });

export const SETTINGS = {
  hijriOffsetDays: 0,
  seasonMode: 'circles',
  whatsappDailyCapPerPerson: 2,
  circleRequestAlertThreshold: 10,
  reminderLeadMinutes: { dora: 60, circles: 45 },
} as const;

export interface Call {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

export interface HarnessOptions {
  role?: TestRole;
  locale?: Locale;
  path?: string;
  /** False to start signed out. */
  signedIn?: boolean;
  handlers?: NonNullable<MockOptions['handlers']>;
  textStep?: 0 | 1 | 2 | 3;
  /** Light unless a test asks for dark. */
  theme?: ThemeChoice;
  /** Makes a request fail with an API error code (the mock's x-mock-error header). */
  forceError?: (call: Call) => string | undefined;
}

/** Renders the whole console against the contract mock. No network is used. */
export function renderConsole(options: HarnessOptions = {}) {
  const role = options.role ?? 'national';
  const me = meFor(role);
  const calls: Call[] = [];
  const handler = createMockHandler({
    handlers: {
      'auth.refresh': () => ({
        accessToken: 'mock-staff',
        accessTokenExpiresAt: '2027-02-15T09:00:00Z',
        refreshToken: 'mock-refresh-token-1111',
        refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
      }),
      'auth.requestCode': () => ({
        challengeId: '00000000-0000-4000-8000-0d0000000001',
        channel: 'whatsapp',
        expiresAt: '2027-02-15T08:10:00Z',
        resendAfterSeconds: 30,
      }),
      'auth.verifyCode': (c, id) => {
        const body = c.body as { code: string };
        if (body.code !== '123456')
          return new Response(JSON.stringify(makeApiError('otp_invalid', id)), {
            status: ERROR_CODES.otp_invalid,
            headers: { 'content-type': 'application/json' },
          });
        return {
          accessToken: 'mock-staff',
          accessTokenExpiresAt: '2027-02-15T09:00:00Z',
          refreshToken: 'mock-refresh-token-2222',
          refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
          me,
          isNewAccount: false,
        };
      },
      'me.get': () => me,
      'adminVenues.list': (c) =>
        page(fx.venues.filter((v) => !c.query.cityId || v.cityId === c.query.cityId)),
      'adminSessions.list': () => page(fx.sessions.map((s) => ({ ...s, circleStatus: null }))),
      'adminRoles.list': () => page([]),
      'adminRoles.invites': () => ({ items: [] }),
      'adminAudit.list': () => page([]),
      'adminSettings.get': () => SETTINGS,
      'registrations.forSession': () => ({
        ...page([]),
        totals: { registrations: 0, people: 0, waitlisted: 0 },
      }),
      ...options.handlers,
    },
  });

  const fetchImpl: typeof fetch = async (input, init) => {
    let request = new Request(input, init);
    const url = new URL(request.url);
    let body: unknown = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request
        .clone()
        .json()
        .catch(() => undefined);
    }
    const call: Call = { method: request.method, path: url.pathname, search: url.search, body };
    calls.push(call);
    const forced = options.forceError?.(call);
    if (forced) {
      const headers = new Headers(request.headers);
      headers.set('x-mock-error', forced);
      request = new Request(request, { headers });
    }
    return handler(request);
  };

  const tokenStore = memoryStore(
    options.signedIn === false ? {} : { 'qc.console.refresh': 'mock-refresh-token-0000' },
  );
  const displayStore = memoryStore();
  const tree: ReactElement = (
    <AppProviders
      apiBaseUrl="http://mock.test"
      fetchImpl={fetchImpl}
      initialLocale={options.locale ?? 'en'}
      initialTheme={options.theme ?? 'light'}
      initialTextStep={options.textStep ?? 0}
      displayStore={displayStore}
      tokenStore={tokenStore}
    >
      <MemoryRouter initialEntries={[options.path ?? '/']}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  );
  const user: UserEvent = userEvent.setup();
  const view: RenderResult = render(tree);
  return { ...view, user, calls, me, tokenStore, displayStore };
}

/** English or Urdu text for a key, so tests read the same way a person would. */
export const text = (key: keyof (typeof messages)['en'], locale: Locale = 'en'): string =>
  messages[locale][key as never] as string;

/** Waits until the signed-in shell is on screen. */
export async function shellReady(locale: Locale = 'en') {
  await screen.findByRole('navigation', { name: text('console.shell.navLabel', locale) });
}

/** A bulk import dry run: a POST that checks the rows and changes nothing. */
export const isDryRun = (c: Call) =>
  c.method === 'POST' &&
  c.path.startsWith('/v1/admin/import/') &&
  (c.body as { dryRun?: unknown } | undefined)?.dryRun === true;

/** Requests that change something. Sign-in plumbing and import dry runs are not counted. */
export const writes = (calls: Call[]) =>
  calls.filter((c) => c.method !== 'GET' && !c.path.startsWith('/v1/auth/') && !isDryRun(c));

export { screen, waitFor };

/**
 * The phone field of the sign-in page. A signed-out person lands on the welcome page first, so
 * this takes the Welcome page's Sign in link when it is on screen.
 */
export async function phoneField(
  user: ReturnType<typeof renderConsole>['user'],
  locale: Locale = 'en',
): Promise<HTMLElement> {
  const label = new RegExp(text('console.signIn.phone.label', locale));
  const link = await screen
    .findByRole('link', { name: text('console.welcome.signIn', locale) })
    .catch(() => null);
  if (link) await user.click(link);
  return screen.findByLabelText(label);
}
