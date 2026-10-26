import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { TabBar, useTheme, type TabItem } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useInsets } from '../../providers/insets';
import { TAB_ROUTES, type TabRoute } from '../../nav/routes';
import { tabIcon } from '../../ui/tabIcons';
import { prefetchTabLater } from '../../boot/routeChunks';
import { prefetchNearbyList } from '../../boot/startQueries';
import { useServices } from '../../providers/services';
import { usePrefetchOtherLanguage } from '../../i18n/useLanguage';

/** How long after the tabs appear the web build fetches Nearby's code, the likeliest next tab. */
const NEARBY_PREFETCH_DELAY_MS = 1500;

/**
 * The web build loads each tab's code when it is first opened. Nearby's code and its first list
 * are fetched once the first screen has had time to settle, so the first tap on Nearby waits
 * for neither.
 */
function usePrefetchNearby() {
  const app = useServices();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const cancelChunk = prefetchTabLater('nearby', NEARBY_PREFETCH_DELAY_MS);
    // Its list too, into the cache, so the first tap draws it without a round trip.
    const timer = setTimeout(() => void prefetchNearbyList(app), NEARBY_PREFETCH_DELAY_MS);
    return () => {
      cancelChunk();
      clearTimeout(timer);
    };
  }, [app]);
}

const LABELS: Record<
  TabRoute,
  'tabs.home' | 'tabs.nearby' | 'tabs.myJourney' | 'tabs.quranPrayer'
> = {
  home: 'tabs.home',
  nearby: 'tabs.nearby',
  journey: 'tabs.myJourney',
  quran: 'tabs.quranPrayer',
};

function BottomTabs({
  activeKey,
  onChange,
}: {
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const { t } = useI18n();
  const insets = useInsets();
  const theme = useTheme();
  // Four tabs, each with a word under its icon. Profile opens from the avatar on Home.
  const items: TabItem[] = TAB_ROUTES.map((key) => ({
    key,
    label: t(LABELS[key]),
    icon: tabIcon(key),
  }));
  return (
    <View style={{ paddingBottom: insets.bottom, backgroundColor: theme.colors.background }}>
      <TabBar
        items={items}
        activeKey={activeKey}
        onChange={onChange}
        accessibilityLabel={t('app.name')}
      />
    </View>
  );
}

/** The four tabs. Their bar is the kit's TabBar, so it follows the theme, size and direction. */
export default function TabsLayout() {
  const { locale } = useI18n();
  const theme = useTheme();
  usePrefetchNearby();
  usePrefetchOtherLanguage(locale);
  return (
    <Tabs
      // A short shared fade when the tab changes; none when the person asks for reduced motion.
      screenOptions={{ headerShown: false, animation: theme.reduceMotion ? 'none' : 'fade' }}
      tabBar={({ state, navigateToTab }) => (
        <BottomTabs
          activeKey={state.routes[state.index]?.name ?? 'home'}
          onChange={(name) => {
            const target = state.routes.find((r) => r.name === name);
            if (target) navigateToTab(target.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="nearby" />
      <Tabs.Screen name="quran" />
      <Tabs.Screen name="journey" />
    </Tabs>
  );
}
