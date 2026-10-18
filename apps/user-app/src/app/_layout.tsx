import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { createDeviceServices } from '../bootstrap';
import { prefetchStartRoute, startTab } from '../boot/routeChunks';
import { prefetchStartQueries } from '../boot/startQueries';
import { hideStartScreen } from '../boot/startScreen';
import { loadServices } from '../providers/createServices';
import { AppProviders } from '../providers/AppProviders';
import { InsetsProvider } from '../providers/insets';
import type { AppServices } from '../providers/services';
import type { Navigator } from '../nav/NavProvider';
import { routeToHref } from '../nav/routes';
import { usePushTaps, type PushTapSource } from '../nav/pushTaps';
import { ReminderSync } from '../providers/ReminderSync';
import { ReadingSync } from '../providers/ReadingSync';
import { registerServiceWorker } from '../platform/serviceWorker';
import { loadFirstFonts, startFonts } from '../fonts/loadFonts';

// One set of services for the life of the page or the app process.
let services: AppServices | null = null;
function getServices(): AppServices {
  services ??= createDeviceServices(Constants.expoConfig?.version ?? '0.0.0');
  return services;
}

// What was saved on this device, read once: the layout waits for it, and so do the requests
// started early below.
let loaded: Promise<void> | null = null;
function loadOnce(app: AppServices): Promise<void> {
  loaded ??= loadServices(app).catch(() => undefined);
  return loaded;
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // The start route's code downloads while the saved choices load. Once they are read, the
  // first screen's data is asked for while the page is still drawing, and then its fonts, so
  // the data comes first on a slow connection.
  const pathname = window.location.pathname;
  prefetchStartRoute(pathname);
  const app = getServices();
  void loadOnce(app)
    .then(() => prefetchStartQueries(app, startTab(pathname)))
    .then(() => startFonts(app.preferences.get().locale));
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

/**
 * Tapped notifications on a phone: reminders open their session, the morning ayah opens the
 * reader (`usePushTaps`). The web has no notification taps.
 */
const notificationTaps: PushTapSource | null =
  Platform.OS === 'web'
    ? null
    : (onTap) =>
        Notifications.addNotificationResponseReceivedListener((response) =>
          onTap(response.notification.request.content.data),
        );

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
  usePushTaps(notificationTaps, navigator);
  return (
    <AppProviders services={app} navigator={navigator}>
      <SafeInsets>
        <ReminderSync />
        <ReadingSync />
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
    // The saved choices first, then the font of the saved language (the web waits for that one
    // face only; a phone loads its bundled fonts). Font loading never rejects and stops waiting
    // after a few seconds, so a missing font only means a fallback font.
    void loadOnce(app)
      .then(() => loadFirstFonts(app.preferences.get().locale))
      .then(() => {
        if (active) setReady(true);
      });
    registerServiceWorker();
    return () => {
      active = false;
    };
  }, [app]);

  // The page's start screen (public/index.html) stays until the first screen can be drawn.
  useEffect(() => {
    if (ready) hideStartScreen();
  }, [ready]);

  // Nothing is drawn until the saved language and sign-in are read, so the first screen
  // never flashes in the wrong language or direction, as signed out, or in the wrong font.
  if (!ready) return <View style={{ flex: 1 }} />;
  return (
    <SafeAreaProvider>
      <Shell app={app} />
    </SafeAreaProvider>
  );
}
