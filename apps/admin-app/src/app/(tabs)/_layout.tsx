import { Tabs, useRouter } from 'expo-router';
import { routes } from '../../navigation/routes';
import { MainTabs, type MainTabKey } from '../../shell/MainTabs';

const hrefOf: Record<MainTabKey, string> = {
  index: routes.today(),
  updates: routes.updates(),
  places: routes.places(),
  account: routes.account(),
};

function isTab(name: string | undefined): name is MainTabKey {
  return name === 'index' || name === 'updates' || name === 'places' || name === 'account';
}

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        const name = state.routes[state.index]?.name;
        return (
          <MainTabs
            active={isTab(name) ? name : 'index'}
            onChange={(key) => router.navigate(hrefOf[key] as never)}
          />
        );
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="updates" />
      <Tabs.Screen name="places" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
