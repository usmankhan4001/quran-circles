import { act, render, renderHook, waitFor, type RenderResult } from '@testing-library/react';
import { expect } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type { ErrorCode, Locale, Tokens } from '@qc/contracts';
import { createMockHandler, type MockOptions } from '@qc/contracts/mock';
import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { FIXTURE_NOW, fixtures } from '@qc/contracts/fixtures';
import { semanticColors, textSizeSteps, type TextSizeStep } from '@qc/ui';
import { TOKENS_KEY } from '../auth/session';
import type { NetworkStatusSource } from '../core/connectivity';
import type { ColorPreference } from '../core/preferences';
import { MemoryStore } from '../core/storage';
import type { ContentModules } from '../features/content/modules';
import { ListOnlyMapView } from '../features/maps/ListOnlyMapView';
import type {
  PermissionResult,
  PushRegistrar,
  PushRegistration,
  ReminderScheduler,
  ScheduledReminder,
} from '../features/reminders/types';
import type { Navigator } from '../nav/NavProvider';
import type { Route } from '../nav/routes';
import { AppProviders } from '../providers/AppProviders';
import { createServices, loadServices } from '../providers/createServices';
import type { AppServices } from '../providers/services';

export const BASE_URL = 'http://api.test';
/** The mock server's clock. Services get it too, so "next session" is stable. */
export const NOW = new Date(FIXTURE_NOW);

export interface RecordedCall {
  method: string;
  path: string;
  search: string;
  headers: Headers;
  body: unknown;
}

export interface MockFetch {
  fetch: typeof fetch;
  calls: RecordedCall[];
  /** Makes the next matching call fail with this error code. */
  failNext(match: string, code: ErrorCode, times?: number): void;
  /** Makes every matching call fail like a dropped connection. */
  setOffline(offline: boolean): void;
  callsTo(match: string): RecordedCall[];
}

/**
 * Sends the app's requests to the contract's mock handler with no network. `match` is
 * "METHOD /path-prefix", for example "POST /v1/registrations".
 */
export function createMockFetch(options: MockOptions = {}): MockFetch {
  const handler = createMockHandler(options);
  const calls: RecordedCall[] = [];
  const failures: { match: string; code: ErrorCode; times: number }[] = [];
  let offline = false;

  const matches = (call: Pick<RecordedCall, 'method' | 'path'>, match: string) => {
    const [method, ...rest] = match.split(' ');
    return call.method === method && call.path.startsWith(rest.join(' '));
  };

  const mockFetch: typeof fetch = async (input, init) => {
    if (offline) throw new TypeError('Failed to fetch');
    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url);
    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request
        .clone()
        .json()
        .catch(() => undefined);
    }
    const call: RecordedCall = {
      method: request.method,
      path: url.pathname,
      search: url.search,
      headers: request.headers,
      body,
    };
    calls.push(call);
    const failure = failures.find((f) => f.times > 0 && matches(call, f.match));
    if (failure) {
      failure.times -= 1;
      request.headers.set('x-mock-error', failure.code);
      return handler(
        new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.method === 'GET' ? null : JSON.stringify(body),
        }),
      );
    }
    return handler(request);
  };

  return {
    fetch: mockFetch,
    calls,
    failNext: (match, code, times = 1) => failures.push({ match, code, times }),
    setOffline: (value) => {
      offline = value;
    },
    callsTo: (match) => calls.filter((c) => matches(c, match)),
  };
}

export class FakeScheduler implements ReminderScheduler {
  supported = true;
  permission: PermissionResult = 'granted';
  scheduled: ScheduledReminder[] = [];
  cancelled = 0;
  isSupported() {
    return this.supported;
  }
  async requestPermission() {
    return this.supported ? this.permission : ('unsupported' as const);
  }
  async replaceAll(reminders: readonly ScheduledReminder[]) {
    this.scheduled = [...reminders];
  }
  async cancelAll() {
    this.cancelled += 1;
    this.scheduled = [];
  }
}

/**
 * A fake web push token in the shape the browser gives: `PushSubscription.toJSON()` serialised,
 * on a push service the contract allows. The endpoint id and keys are made up.
 */
export const FAKE_WEB_PUSH_TOKEN = JSON.stringify({
  endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint-id',
  expirationTime: null,
  keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
});

export class FakeRegistrar implements PushRegistrar {
  supported = true;
  result: PushRegistration | 'denied' | 'unsupported' = {
    platform: 'web',
    provider: 'webpush',
    token: FAKE_WEB_PUSH_TOKEN,
  };
  isSupported() {
    return this.supported;
  }
  async register() {
    return this.supported ? this.result : ('unsupported' as const);
  }
}

/** A platform connection state the test switches by hand, like the browser's online events. */
export class FakeNetwork implements NetworkStatusSource {
  private readonly listeners = new Set<(online: boolean) => void>();
  constructor(private online = true) {}
  isOnline = () => this.online;
  subscribe = (listener: (online: boolean) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get listenerCount(): number {
    return this.listeners.size;
  }
  set(online: boolean): void {
    this.online = online;
    for (const listener of [...this.listeners]) listener(online);
  }
}

export interface TestNavigator extends Navigator {
  calls: { type: 'go' | 'replace' | 'back' | 'tab'; route?: Route }[];
  last(): { type: string; route?: Route } | undefined;
}

export function createTestNavigator(): TestNavigator {
  const calls: TestNavigator['calls'] = [];
  return {
    calls,
    go: (route) => calls.push({ type: 'go', route }),
    replace: (route) => calls.push({ type: 'replace', route }),
    back: () => calls.push({ type: 'back' }),
    tab: (route) => calls.push({ type: 'tab', route }),
    last: () => calls[calls.length - 1],
  };
}

export const TEST_TOKENS: Tokens = {
  accessToken: 'mock-user',
  accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  refreshToken: 'mock-refresh-token-0000',
  refreshTokenExpiresAt: '2099-02-01T00:00:00Z',
};

export interface TestWorld {
  services: AppServices;
  http: MockFetch;
  nav: TestNavigator;
  scheduler: FakeScheduler;
  registrar: FakeRegistrar;
  deviceStore: MemoryStore;
  tokenStore: MemoryStore;
  opened: string[];
  /** The app's clock; move it forward to pass time without waiting. */
  clock: { advance(ms: number): void };
}

export interface WorldOptions {
  signedIn?: boolean;
  locale?: Locale;
  textSize?: TextSizeStep;
  color?: ColorPreference;
  cityId?: string | null;
  areaId?: string | null;
  mock?: MockOptions;
  content?: ContentModules;
  deviceStore?: MemoryStore;
  tokenStore?: MemoryStore;
  tokens?: Tokens;
  platform?: 'web' | 'ios' | 'android';
  /** The platform's connection state; none by default, so only failed calls count. */
  network?: NetworkStatusSource;
}

/** Everything a screen needs, wired to in-memory parts and the mock server. */
export async function createWorld(options: WorldOptions = {}): Promise<TestWorld> {
  const http = createMockFetch(options.mock);
  const deviceStore = options.deviceStore ?? new MemoryStore();
  const tokenStore = options.tokenStore ?? new MemoryStore();
  if (options.signedIn) {
    await tokenStore.set(TOKENS_KEY, JSON.stringify(options.tokens ?? TEST_TOKENS));
  }
  const scheduler = new FakeScheduler();
  const registrar = new FakeRegistrar();
  const opened: string[] = [];
  let current = NOW.getTime();
  const services = createServices({
    baseUrl: BASE_URL,
    deviceStore,
    tokenStore,
    scheduler,
    registrar,
    MapView: ListOnlyMapView,
    content: options.content ?? {},
    platform: options.platform ?? 'web',
    deviceLanguages: [],
    fetch: http.fetch,
    openUrl: async (url) => {
      opened.push(url);
    },
    now: () => new Date(current),
    ...(options.network ? { network: options.network } : {}),
  });
  await loadServices(services);
  await services.preferences.update({
    locale: options.locale ?? 'en',
    textSize: options.textSize ?? 0,
    color: options.color ?? 'light',
    ...(options.cityId !== undefined ? { cityId: options.cityId } : {}),
    ...(options.areaId !== undefined ? { areaId: options.areaId } : {}),
  });
  return {
    services,
    http,
    nav: createTestNavigator(),
    scheduler,
    registrar,
    deviceStore,
    tokenStore,
    opened,
    clock: {
      advance: (ms) => {
        current += ms;
      },
    },
  };
}

export interface AppRender extends RenderResult {
  world: TestWorld;
}

/** Renders a screen inside the real providers (theme, language, toasts, services). */
export async function renderScreen(
  ui: ReactElement,
  options: WorldOptions & { world?: TestWorld } = {},
): Promise<AppRender> {
  const world = options.world ?? (await createWorld(options));
  let result!: RenderResult;
  await act(async () => {
    result = render(
      <AppProviders services={world.services} navigator={world.nav} reduceMotion>
        {ui}
      </AppProviders>,
    );
  });
  return Object.assign(result, { world });
}

/** Waits until the text is on the screen (data from the mock server has arrived). */
export async function findByTextEventually(
  result: Pick<RenderResult, 'findByText'>,
  text: string | RegExp,
): Promise<HTMLElement> {
  return result.findByText(text, undefined, { timeout: 5000 });
}

export { waitFor, act };

/** Every combination the screens must work in: 2 languages x light/dark x 4 text sizes. */
export const MATRIX = (['en', 'ur'] as const).flatMap((locale) =>
  (['light', 'dark'] as const).flatMap((color) =>
    textSizeSteps.map((textSize) => ({
      name: `${locale} / ${color} / size ${textSize}`,
      locale,
      color,
      textSize,
    })),
  ),
);

function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * The green header (D12, B) paints with the `hero` and `textOnHero` tokens of the colour mode
 * in use. Returns the two colours it found and the two it should have, so a test can compare.
 */
export function greenHeaderColors(container: HTMLElement, color: 'light' | 'dark') {
  const header = container.querySelector<HTMLElement>('[data-testid="screen-header"]');
  const title = header?.querySelector<HTMLElement>('[role="heading"]') ?? null;
  return {
    background: header?.style.backgroundColor ?? null,
    text: title?.style.color ?? null,
    expectedBackground: rgb(semanticColors[color].hero),
    expectedText: rgb(semanticColors[color].textOnHero),
  };
}

/** Asserts the green header uses the `hero` and `textOnHero` colours of the colour mode. */
export function expectGreenHeader(container: HTMLElement, color: 'light' | 'dark'): void {
  const found = greenHeaderColors(container, color);
  expect(found.background).toBe(found.expectedBackground);
  expect(found.text).toBe(found.expectedText);
}

/** The text-direction attribute react-native-web sets on the themed root. */
export function directionOf(container: HTMLElement): string | null {
  return container.querySelector('[dir]')?.getAttribute('dir') ?? null;
}

/** Runs a hook inside the real providers, for the hooks that hold the screens' rules. */
export async function renderHookInApp<T>(
  hook: () => T,
  options: WorldOptions & { world?: TestWorld } = {},
) {
  const world = options.world ?? (await createWorld(options));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders services={world.services} navigator={world.nav} reduceMotion>
      {children}
    </AppProviders>
  );
  let rendered!: ReturnType<typeof renderHook<T, unknown>>;
  await act(async () => {
    rendered = renderHook(hook, { wrapper });
  });
  return Object.assign(rendered, { world });
}

/** Mock-server answers for the sign-in endpoints, with values a test can rely on. */
export function signInHandlers(
  options: {
    isNewAccount?: boolean;
    displayName?: string | null;
    resendAfterSeconds?: number;
  } = {},
) {
  return {
    'auth.requestCode': (_c: unknown, _id: string) => ({
      challengeId: '00000000-0000-4000-8000-0c0000000001',
      channel: (_c as { body: { channel: string } }).body.channel,
      expiresAt: '2027-02-15T08:10:00Z',
      resendAfterSeconds: options.resendAfterSeconds ?? 30,
    }),
    'auth.verifyCode': (c: unknown, id: string) => {
      const body = (c as { body: { code: string } }).body;
      if (body.code !== '123456') {
        return new Response(JSON.stringify(makeApiError('otp_invalid', id)), {
          status: ERROR_CODES.otp_invalid,
          headers: { 'content-type': 'application/json' },
        });
      }
      return {
        accessToken: 'mock-user',
        accessTokenExpiresAt: '2099-01-01T00:00:00Z',
        refreshToken: 'mock-refresh-token-0000',
        refreshTokenExpiresAt: '2099-02-01T00:00:00Z',
        me: {
          ...fixtures.me,
          displayName: options.displayName === undefined ? 'Sample Person' : options.displayName,
        },
        isNewAccount: options.isNewAccount ?? false,
      };
    },
  };
}
