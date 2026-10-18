import type { StackInfo } from '../stack/stack';
import { SEED } from '../support/seed';

export type App = 'user-app' | 'admin-app' | 'console';

/** Ids the screens need that only exist once the run's data is made. */
export interface RunData {
  /** An Al-Noor occurrence of the Taraweeh session from today on (attendance screen). */
  occurrenceId: string;
}

export interface Screen {
  id: string;
  app: App;
  /** What the screen is called in docs/design and the briefs. */
  title: string;
  /** The lane that owns the screen's code (docs/engineering/ownership.md). */
  owner: string;
  path: (data: RunData) => string;
  /** A selector that is visible once the screen has rendered its content. */
  ready: string;
}

/**
 * The real screens of deliverable 5. Paths are the apps' own routes; the data is the synthetic
 * `@qc/db` seed plus what the run adds.
 */
export const SCREENS: readonly Screen[] = [
  {
    id: 'user-home',
    app: 'user-app',
    title: 'Home',
    owner: 'user-app',
    path: () => '/home',
    ready: '[data-testid="home-lead-card"], [data-testid="home-screen"] [data-testid="home-near"]',
  },
  {
    id: 'user-nearby',
    app: 'user-app',
    title: 'Nearby',
    owner: 'user-app',
    path: () => '/nearby',
    ready: '[data-testid="nearby-list"]',
  },
  {
    id: 'user-session',
    app: 'user-app',
    title: 'Session',
    owner: 'user-app',
    path: () => `/session/${SEED.sessionTaraweehNoor}`,
    ready: '[data-testid="register-button"]',
  },
  {
    id: 'user-registration',
    app: 'user-app',
    title: 'Registration',
    owner: 'user-app',
    path: () => `/register/${SEED.sessionTaraweehNoor}`,
    ready: '[data-testid="registration-form"]',
  },
  {
    id: 'user-journey',
    app: 'user-app',
    title: 'My Journey',
    owner: 'user-app',
    path: () => '/journey',
    ready: '[data-testid="journey-summary"]',
  },
  {
    id: 'user-quran-reader',
    app: 'user-app',
    title: 'Quran reader',
    owner: 'content',
    path: () => '/quran?surah=2&ayah=1',
    ready: '[data-testid="verse-2-1"]',
  },
  {
    id: 'user-profile',
    app: 'user-app',
    title: 'Profile',
    owner: 'user-app',
    path: () => '/profile',
    ready: '[data-testid="profile-text-size"]',
  },
  {
    id: 'user-memorisation',
    app: 'user-app',
    title: 'Memorisation',
    owner: 'user-app',
    path: () => '/memorisation',
    ready: '[data-testid="memorisation-screen"]',
  },
  {
    id: 'admin-home',
    app: 'admin-app',
    title: 'Coordinator home (Today)',
    owner: 'admin-app',
    path: () => '/',
    ready: '[data-testid="today-actions"]',
  },
  {
    id: 'admin-session',
    app: 'admin-app',
    title: 'Coordinator session',
    owner: 'admin-app',
    path: () => `/session/${SEED.sessionTaraweehNoor}`,
    ready: '[data-testid="session-dates"]',
  },
  {
    id: 'admin-attendance',
    app: 'admin-app',
    title: 'Attendance',
    owner: 'admin-app',
    path: (d) => `/session/${SEED.sessionTaraweehNoor}/occurrence/${d.occurrenceId}/attendance`,
    ready: '[data-testid="attendance-form"]',
  },
  {
    id: 'admin-daily-ayah',
    app: 'admin-app',
    title: 'Daily ayah (coordinator pick)',
    owner: 'admin-app',
    path: () => `/daily-ayah?venueId=${SEED.venueNoor}`,
    ready: '[data-testid="daily-ayah-data"], [data-testid="daily-ayah-picks"]',
  },
  {
    id: 'admin-posters',
    app: 'admin-app',
    title: 'Posters',
    owner: 'admin-app',
    path: () => `/session/${SEED.sessionTaraweehNoor}/posters`,
    ready: '[data-testid="poster-form"]',
  },
  {
    id: 'console-sessions',
    app: 'console',
    title: 'Console sessions',
    owner: 'console',
    path: () => '/sessions',
    ready: 'main table, main [role="table"]',
  },
  {
    id: 'console-import',
    app: 'console',
    title: 'Console bulk import',
    owner: 'console',
    path: () => '/import',
    ready: 'main h1',
  },
  {
    id: 'console-daily-ayahs',
    app: 'console',
    title: 'Console daily ayahs',
    owner: 'console',
    path: () => '/ayah-of-the-day',
    ready: 'main h1',
  },
  {
    id: 'console-posters',
    app: 'console',
    title: 'Console posters',
    owner: 'console',
    path: () => `/sessions/${SEED.sessionTaraweehNoor}/posters`,
    ready: 'main h1',
  },
];

export function baseUrlFor(app: App, info: StackInfo): string {
  const url =
    app === 'user-app' ? info.pwaUrl : app === 'admin-app' ? info.adminUrl : info.consoleUrl;
  const error =
    app === 'user-app' ? info.pwaError : app === 'admin-app' ? info.adminError : info.consoleError;
  if (!url) throw new Error(`${app} did not build or start: ${error ?? 'unknown'}`);
  return url;
}

/** Icons the ui lane's guide says must mirror in right-to-left (docs/design/rtl-urdu-guide.md §3). */
export const FLIPPING_ICONS: ReadonlySet<string> = new Set([
  'chevron-forward',
  'chevron-back',
  'arrow-forward',
  'arrow-back',
  'back',
  'forward',
  'next',
  'previous',
  'send',
  'reply',
  'undo',
  'redo',
  'list-bullets',
  'sign-in',
  'sign-out',
  'external-link',
]);
