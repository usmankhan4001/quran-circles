import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  ThemeProvider,
  colorModes,
  directionForLocale,
  locales,
  textSizeSteps,
  type ColorMode,
  type Direction,
  type Locale,
  type TextSizeStep,
} from '@qc/ui';
import { ContentProvider } from '../ui/context';
import { createContentServices, type ContentServices } from '../ui/services';
import { createMemoryStorage } from '../storage/memory';
import { createFakeAccountServer, type FakeAccountServer } from './fakeAccount';
import { createClock, createFakeQuranApi, type FakeQuranApi } from './fakes';

export interface Combo {
  name: string;
  mode: ColorMode;
  locale: Locale;
  direction: Direction;
  textSize: TextSizeStep;
}

/** Every colour mode x language (so direction) x text size: 3 x 2 x 4 = 24 combinations. */
export const matrix: Combo[] = colorModes.flatMap((mode) =>
  locales.flatMap((locale) =>
    textSizeSteps.map((textSize) => ({
      name: `${mode} / ${locale} (${directionForLocale(locale)}) / size ${textSize}`,
      mode,
      locale,
      direction: directionForLocale(locale),
      textSize,
    })),
  ),
);

/** The four text sizes in the two languages, in light and in dark: the cut used for heavy screens. */
export const lightDarkMatrix: Combo[] = matrix.filter((c) => c.mode !== 'highContrast');

export interface TestServices {
  services: ContentServices;
  quranApi: FakeQuranApi;
  account: FakeAccountServer;
  clock: ReturnType<typeof createClock>;
  storage: ReturnType<typeof createMemoryStorage>;
  signIn: () => void;
  signOut: () => void;
}

export interface TestServicesOptions {
  /** The fake clock's start, as an ISO instant. Default: 2026-10-16T12:00:00Z. */
  now?: string;
  signedIn?: boolean;
  /** V1 browser data, by key. Omit for none. */
  v1?: Record<string, string>;
}

/** Real services over fakes: invented Quran text, an in-memory account, a clock tests can move. */
export function createTestServices(options: TestServicesOptions = {}): TestServices {
  const clock = createClock(options.now);
  const quranApi = createFakeQuranApi();
  const account = createFakeAccountServer(clock.now);
  const storage = createMemoryStorage();
  let signed = options.signedIn ?? false;
  const v1 = options.v1;
  const services = createContentServices({
    fetch: quranApi.fetch,
    storage,
    getApi: () => (signed ? account.api : null),
    now: clock.now,
    ...(v1 ? { readV1: (key: string) => v1[key] ?? null } : {}),
  });
  return {
    services,
    quranApi,
    account,
    clock,
    storage,
    signIn: () => {
      signed = true;
    },
    signOut: () => {
      signed = false;
    },
  };
}

export interface RenderContentOptions {
  combo?: Partial<Omit<Combo, 'name'>>;
  hijriOffsetDays?: number;
  signedIn?: boolean;
}

/** Renders inside the theme and the content provider. Motion is reduced: jsdom never ends animations. */
export function renderContent(
  ui: ReactElement,
  services: ContentServices,
  options: RenderContentOptions = {},
): RenderResult {
  return render(
    <ThemeProvider reduceMotion {...(options.combo ?? {})}>
      <ContentProvider
        services={services}
        hijriOffsetDays={options.hijriOffsetDays ?? 0}
        signedIn={options.signedIn ?? false}
      >
        {ui}
      </ContentProvider>
    </ThemeProvider>,
  );
}
