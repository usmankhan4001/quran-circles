import { useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { config } from '../config';
import { NavigationContext, type Navigation } from '../navigation/NavigationContext';
import { AppProviders } from '../shell/AppProviders';
import { AuthGate } from '../shell/AuthGate';
import { createDeviceStore } from '../storage/storage';

const tokenStore = createDeviceStore('session');
const prefsStore = createDeviceStore('local');

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
    <AppProviders baseUrl={config.apiBaseUrl} tokenStore={tokenStore} prefsStore={prefsStore}>
      <StatusBar style="auto" />
      <NavigationContext.Provider value={navigation}>
        <AuthGate prefsStore={prefsStore}>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </NavigationContext.Provider>
    </AppProviders>
  );
}
