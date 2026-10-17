import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { Locale, Tokens } from '@qc/contracts';
import { AppearanceProvider, type Appearance } from '../appearance/AppearanceProvider';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { NavigationContext, type Navigation } from '../navigation/NavigationContext';
import { WorkingScopeProvider } from '../scope/WorkingScopeProvider';
import { createMemoryStore, type KeyValueStore } from '../storage/storage';
import { createBackend, STAFF_TOKEN, type Backend } from './backend';

export const BASE_URL = 'http://mock.test';

export const tokens: Tokens = {
  accessToken: STAFF_TOKEN,
  accessTokenExpiresAt: '2027-02-15T09:00:00Z',
  refreshToken: 'mock-refresh-token-0000',
  refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
};

export interface Combo {
  name: string;
  locale: Locale;
  colorChoice: Appearance['colorChoice'];
  textSize: Appearance['textSize'];
  dir: 'ltr' | 'rtl';
}

/**
 * Left-to-right and right-to-left, light and dark, smallest and largest text. The full
 * 3 x 2 x 4 matrix is covered by the kit's own tests; here each screen runs the four corners
 * that change layout the most.
 */
export const combos: Combo[] = [
  { name: 'en light size 0 (ltr)', locale: 'en', colorChoice: 'light', textSize: 0, dir: 'ltr' },
  { name: 'ur light size 0 (rtl)', locale: 'ur', colorChoice: 'light', textSize: 0, dir: 'rtl' },
  { name: 'en dark size 3 (ltr)', locale: 'en', colorChoice: 'dark', textSize: 3, dir: 'ltr' },
  { name: 'ur dark size 3 (rtl)', locale: 'ur', colorChoice: 'dark', textSize: 3, dir: 'rtl' },
];

export const LTR_EN = combos[0]!;
export const RTL_UR = combos[1]!;

/** Like the app's gate: once the person signs out, nothing signed-in stays mounted. */
function SignedInOnly({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  return status === 'signedIn' && me ? <>{children}</> : <div data-testid="signed-out" />;
}

export interface NavRecorder extends Navigation {
  pushed: string[];
  replaced: string[];
  backs: number;
}

export function createNavRecorder(): NavRecorder {
  const rec: NavRecorder = {
    pushed: [],
    replaced: [],
    backs: 0,
    push: (href) => void rec.pushed.push(href),
    replace: (href) => void rec.replaced.push(href),
    back: () => {
      rec.backs += 1;
    },
  };
  return rec;
}

export interface ScreenOptions {
  backend?: Backend;
  combo?: Partial<Combo>;
  prefs?: KeyValueStore;
}

export interface Rendered extends RenderResult {
  backend: Backend;
  nav: NavRecorder;
  prefs: KeyValueStore;
}

/**
 * Renders a screen the way the app does, signed in as the backend's person: appearance,
 * sign-in and working scope around it, with the API answered by the
 * in-memory backend and navigation recorded instead of performed.
 */
export function renderScreen(ui: ReactElement, options: ScreenOptions = {}): Rendered {
  const backend = options.backend ?? createBackend();
  const combo = { ...LTR_EN, ...options.combo };
  const nav = createNavRecorder();
  const prefs = options.prefs ?? createMemoryStore();
  const result = render(
    <AppearanceProvider
      store={prefs}
      initial={{ locale: combo.locale, colorChoice: combo.colorChoice, textSize: combo.textSize }}
      reduceMotion
    >
      <AuthProvider
        baseUrl={BASE_URL}
        tokenStore={createMemoryStore()}
        fetch={backend.fetch}
        initialSession={{ tokens, me: backend.me }}
      >
        <SignedInOnly>
          <NavigationContext.Provider value={nav}>
            <WorkingScopeProvider store={prefs}>{ui}</WorkingScopeProvider>
          </NavigationContext.Provider>
        </SignedInOnly>
      </AuthProvider>
    </AppearanceProvider>,
  );
  return Object.assign(result, { backend, nav, prefs });
}

/** Waits for the skeletons to go: the screen has loaded or shown its error. */
export async function settled(testId: string): Promise<HTMLElement> {
  return waitFor(() => screen.getByTestId(testId), { timeout: 5000 });
}

/** The document direction the theme set. */
export function directionOf(container: HTMLElement): string | null {
  const el = container.querySelector('[dir]');
  return el?.getAttribute('dir') ?? null;
}

/** Types into a field by test id, whether the id sits on the input or on its wrapper. */
export function typeInto(testId: string, value: string): void {
  const el = screen.getByTestId(testId);
  const input =
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      ? el
      : (el.querySelector('input, textarea') ?? el);
  fireEvent.change(input, { target: { value } });
}
