import { TabBar, type TabItem } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';
import { Glyph, type GlyphName } from '../components/glyphs';

export type MainTabKey = 'index' | 'updates' | 'places' | 'account';

export const mainTabOrder: readonly MainTabKey[] = ['index', 'places', 'updates', 'account'];

const glyphOf: Record<MainTabKey, GlyphName> = {
  index: 'today',
  places: 'places',
  updates: 'bell',
  account: 'user',
};

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
  const items: TabItem[] = mainTabOrder.map((key) => ({
    key,
    label: t(labelKey[key]),
    icon: ({ color }) => <Glyph name={glyphOf[key]} color={color} size={24} />,
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
