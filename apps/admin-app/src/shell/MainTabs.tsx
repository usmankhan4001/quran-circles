import { TabBar, type TabItem } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

export type MainTabKey = 'index' | 'updates' | 'places' | 'account';

export const mainTabOrder: readonly MainTabKey[] = ['index', 'updates', 'places', 'account'];

const labelKey = {
  index: 'admin.tabs.today',
  updates: 'admin.tabs.updates',
  places: 'admin.tabs.places',
  account: 'admin.tabs.account',
} as const;

/** The bottom menu: the kit's TabBar with this app's four destinations. */
export function MainTabs({
  active,
  onChange,
}: {
  active: MainTabKey;
  onChange: (key: MainTabKey) => void;
}) {
  const { t } = useT();
  const items: TabItem[] = mainTabOrder.map((key) => ({ key, label: t(labelKey[key]) }));
  return (
    <TabBar
      testID="main-tabs"
      accessibilityLabel={t('admin.tabs.label')}
      items={items}
      activeKey={active}
      onChange={(key) => onChange(key as MainTabKey)}
    />
  );
}
