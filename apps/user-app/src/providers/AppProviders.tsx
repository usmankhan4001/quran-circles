import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { ThemeProvider, type ColorMode } from '@qc/ui';
import { NavProvider, type Navigator } from '../nav/NavProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { ServicesProvider, useServices, type AppServices } from './services';
import { useAuthState, usePreferences } from './hooks';
import { ToastProvider } from './Toasts';

const styles = StyleSheet.create({ root: { flex: 1 } });

function modeFor(color: string, system: 'light' | 'dark' | null | undefined): ColorMode {
  if (color === 'dark' || color === 'light' || color === 'highContrast') return color;
  return system === 'dark' ? 'dark' : 'light';
}

/** Puts language, direction, colour mode and text size on the screen, from the saved choices. */
function ThemeFromPreferences({ children }: { children: ReactNode }) {
  const prefs = usePreferences();
  const system = useColorScheme();
  const direction = prefs.locale === 'ur' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = prefs.locale;
    document.documentElement.dir = direction;
  }, [prefs.locale, direction]);

  return (
    <ThemeProvider
      mode={modeFor(prefs.color, system)}
      locale={prefs.locale}
      textSize={prefs.textSize}
      style={styles.root}
    >
      <I18nProvider locale={prefs.locale}>{children}</I18nProvider>
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

export interface AppProvidersProps {
  services: AppServices;
  navigator: Navigator;
  children: ReactNode;
}

export function AppProviders({ services, navigator, children }: AppProvidersProps) {
  return (
    <ServicesProvider services={services}>
      <NavProvider navigator={navigator}>
        <ThemeFromPreferences>
          <ToastProvider>
            <LoadMe>{children}</LoadMe>
          </ToastProvider>
        </ThemeFromPreferences>
      </NavProvider>
    </ServicesProvider>
  );
}
