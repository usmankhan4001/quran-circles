import { useEffect, useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppearance } from '../appearance/AppearanceProvider';
import { hideStartScreen } from '../boot/startScreen';
import { config } from '../config';
import { FontGate } from '../fonts/FontGate';
import { loadFonts } from '../fonts/loadFonts';
import { NavigationContext, type Navigation } from '../navigation/NavigationContext';
import { AppProviders } from '../shell/AppProviders';
import { AuthGate } from '../shell/AuthGate';
import { createDeviceStore } from '../storage/storage';

const tokenStore = createDeviceStore('session');
const prefsStore = createDeviceStore('local');

/**
 * Takes away the page's start screen (public/index.html) once the first font and the saved
 * appearance are ready, so nothing underneath is ever seen in the wrong language or direction.
 */
function StartScreenOff() {
  const { ready } = useAppearance();
  useEffect(() => {
    if (ready) hideStartScreen();
  }, [ready]);
  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const navigation = useMemo<Navigation>(
    () => ({
      push: (href) => router.push(href as never),
      replace: (href) => router.replace(href as never),
      back: () => (router.canGoBack() ? router.back() : router.replace('/' as never)),
    }),
    [router],
  );
  return (
    <FontGate load={loadFonts}>
      <AppProviders baseUrl={config.apiBaseUrl} tokenStore={tokenStore} prefsStore={prefsStore}>
        <StartScreenOff />
        <StatusBar style="auto" />
        <NavigationContext.Provider value={navigation}>
          <AuthGate prefsStore={prefsStore}>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </NavigationContext.Provider>
      </AppProviders>
    </FontGate>
  );
}
