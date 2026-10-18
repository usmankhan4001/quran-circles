import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { ThemeProvider, type ColorMode } from '@qc/ui';
import { NavProvider, type Navigator } from '../nav/NavProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { useShownLocale } from '../i18n/useLanguage';
import { useAppConfig } from '../features/config/useAppConfig';
import { ServicesProvider, useServices, type AppServices } from './services';
import { useAuthState, useAuthStatus, usePreferences } from './hooks';
import { ToastProvider } from './Toasts';
import { useReduceMotion } from './useReduceMotion';

const styles = StyleSheet.create({ root: { flex: 1 } });

function modeFor(color: string, system: 'light' | 'dark' | null | undefined): ColorMode {
  if (color === 'dark' || color === 'light' || color === 'highContrast') return color;
  return system === 'dark' ? 'dark' : 'light';
}

/** Puts language, direction, colour mode and text size on the screen, from the saved choices. */
function ThemeFromPreferences({
  children,
  reduceMotion,
}: {
  children: ReactNode;
  reduceMotion?: boolean;
}) {
  const prefs = usePreferences();
  const system = useColorScheme();
  const systemReduceMotion = useReduceMotion();
  // The saved language once its words are in (the web downloads one language at a time).
  const locale = useShownLocale(prefs.locale);
  const direction = locale === 'ur' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return (
    <ThemeProvider
      mode={modeFor(prefs.color, system)}
      locale={locale}
      textSize={prefs.textSize}
      reduceMotion={reduceMotion ?? systemReduceMotion}
      style={styles.root}
    >
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </ThemeProvider>
  );
}

/** Loads the signed-in person once the app has tokens, so every screen can read `me`. */
function LoadMe({ children }: { children: ReactNode }) {
  const { api, auth } = useServices();
  const state = useAuthState();
  useEffect(() => {
    if (state.status !== 'signedIn' || state.me) return;
    let cancelled = false;
    api.me
      .get()
      .then((me) => {
        if (!cancelled) auth.setMe(me);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, auth, state.status, state.me]);
  return <>{children}</>;
}

/**
 * Gives the Quran and prayer modules their services, with the Hijri day offset from the
 * server's config and whether someone is signed in (so bookmarks follow the account).
 */
function ContentHost({ children }: { children: ReactNode }) {
  const { content } = useServices();
  const status = useAuthStatus();
  const { hijriOffsetDays } = useAppConfig();
  const Provider = content.Provider;
  if (!Provider) return <>{children}</>;
  return (
    <Provider signedIn={status === 'signedIn'} hijriOffsetDays={hijriOffsetDays}>
      {children}
    </Provider>
  );
}

export interface AppProvidersProps {
  services: AppServices;
  navigator: Navigator;
  children: ReactNode;
  /** Overrides the device setting. Tests turn it on so sheets close without animating. */
  reduceMotion?: boolean;
}

export function AppProviders({ services, navigator, children, reduceMotion }: AppProvidersProps) {
  return (
    <ServicesProvider services={services}>
      <NavProvider navigator={navigator}>
        <ThemeFromPreferences {...(reduceMotion !== undefined ? { reduceMotion } : {})}>
          <ToastProvider>
            <LoadMe>
              <ContentHost>{children}</ContentHost>
            </LoadMe>
          </ToastProvider>
        </ThemeFromPreferences>
      </NavProvider>
    </ServicesProvider>
  );
}
