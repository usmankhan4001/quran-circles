import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TabBar, useTheme, type TabItem } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useUnreadCount } from '../../features/updates/hooks';
import { useInsets } from '../../providers/insets';
import { TAB_ROUTES, type TabRoute } from '../../nav/routes';
import { tabIcon } from '../../ui/tabIcons';

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
  const unread = useUnreadCount();
  const insets = useInsets();
  const theme = useTheme();
  const items: TabItem[] = TAB_ROUTES.map((key) => ({
    key,
    label: t(LABELS[key]),
    icon: tabIcon(key),
    ...(key === 'home' && unread > 0 ? { badge: { count: unread } } : {}),
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
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
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
