import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { createDeviceServices } from '../bootstrap';
import { loadServices } from '../providers/createServices';
import { AppProviders } from '../providers/AppProviders';
import { InsetsProvider } from '../providers/insets';
import type { AppServices } from '../providers/services';
import type { Navigator } from '../nav/NavProvider';
import { routeToHref } from '../nav/routes';
import { ReminderSync } from '../providers/ReminderSync';
import { registerServiceWorker } from '../platform/serviceWorker';
import { loadAppFonts } from '../fonts/appFonts';

// One set of services for the life of the page or the app process.
let services: AppServices | null = null;
function getServices(): AppServices {
  services ??= createDeviceServices(Constants.expoConfig?.version ?? '0.0.0');
  return services;
}

if (Platform.OS !== 'web') {
  // A reminder that arrives while the app is open still shows, as a banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function useRouterNavigator(): Navigator {
  const router = useRouter();
  return useMemo<Navigator>(
    () => ({
      go: (route) => router.push(routeToHref(route) as never),
      replace: (route) => router.replace(routeToHref(route) as never),
      back: () => (router.canGoBack() ? router.back() : router.replace('/home' as never)),
      tab: (route) => router.navigate(routeToHref(route) as never),
    }),
    [router],
  );
}

/** Opens the session a reminder is about when the notification is tapped. */
function useNotificationTaps(navigator: Navigator) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (data: unknown) => {
      const sessionId =
        typeof data === 'object' && data !== null
          ? (data as { sessionId?: unknown }).sessionId
          : undefined;
      if (typeof sessionId === 'string') navigator.go({ name: 'session', sessionId });
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
    return () => subscription.remove();
  }, [navigator]);
}

function SafeInsets({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <InsetsProvider
      insets={{ top: insets.top, bottom: insets.bottom, start: insets.left, end: insets.right }}
    >
      {children}
    </InsetsProvider>
  );
}

function Shell({ app }: { app: AppServices }) {
  const navigator = useRouterNavigator();
  useNotificationTaps(navigator);
  return (
    <AppProviders services={app} navigator={navigator}>
      <SafeInsets>
        <ReminderSync />
        <Stack screenOptions={{ headerShown: false, animation: 'default' }}>
          {/* R2: registration is a sheet that rises over the session page. */}
          <Stack.Screen name="register/[sessionId]" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeInsets>
    </AppProviders>
  );
}

export default function RootLayout() {
  const app = getServices();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // The bundled fonts load alongside the saved choices. Font loading never rejects and stops
    // waiting after a few seconds, so a missing font only means a fallback font.
    void Promise.allSettled([loadServices(app), loadAppFonts(Font.loadAsync)]).then(() => {
      if (active) setReady(true);
    });
    registerServiceWorker();
    return () => {
      active = false;
    };
  }, [app]);

  // Nothing is drawn until the saved language and sign-in are read, so the first screen
  // never flashes in the wrong language or as signed out, or in the wrong font.
  if (!ready) return <View style={{ flex: 1 }} />;
  return (
    <SafeAreaProvider>
      <Shell app={app} />
    </SafeAreaProvider>
  );
}
