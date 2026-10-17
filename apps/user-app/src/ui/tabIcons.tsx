import { Icon, type IconName, type TabItem } from '@qc/ui';
import type { TabRoute } from '../nav/routes';

const ICONS: Record<TabRoute, IconName> = {
  home: 'home',
  nearby: 'pin',
  quran: 'book',
  journey: 'calendar',
};

/** The icon of each tab (D12). Every tab has one, so the bar can show the label on the chosen tab only. */
export function tabIcon(route: TabRoute): NonNullable<TabItem['icon']> {
  return ({ color }) => <Icon name={ICONS[route]} color={color} size={24} />;
}
