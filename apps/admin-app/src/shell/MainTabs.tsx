import { Icon, TabBar, type IconName, type TabItem } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

export type MainTabKey = 'index' | 'registrants' | 'updates' | 'places';

/** As drawn (D17): Today, tonight's registrants, updates, the masjid. Account opens from Places. */
export const mainTabOrder: readonly MainTabKey[] = ['index', 'registrants', 'updates', 'places'];

/** The drawings' line icons from the kit (Today is the calendar, the masjid its dome). */
const iconOf: Record<MainTabKey, IconName> = {
  index: 'calendar-check',
  registrants: 'users-three',
  updates: 'megaphone',
  places: 'mosque',
};

const labelKey = {
  index: 'admin.tabs.today',
  registrants: 'admin.tabs.registrants',
  updates: 'admin.tabs.updates',
  places: 'admin.tabs.places',
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
  const items: TabItem[] = mainTabOrder.map((key) => ({
    key,
    label: t(labelKey[key]),
    icon: ({ color, selected }) => (
      <Icon name={iconOf[key]} color={color} size={22} weight={selected ? 'fill' : 'regular'} />
    ),
  }));
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
