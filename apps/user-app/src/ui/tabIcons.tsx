import { Icon, type IconName, type TabItem } from '@qc/ui';
import type { TabRoute } from '../nav/routes';

/** The dock (D17): the four tabs, then Profile, which opens as a page. */
export type DockKey = TabRoute | 'profile';

const ICONS: Record<DockKey, IconName> = {
  home: 'home',
  nearby: 'pin',
  quran: 'book',
  journey: 'bookmark',
  profile: 'user',
};

/** The icon of each tab (D12). Every tab has one, so the bar can show the label on the chosen tab only. */
export function tabIcon(route: DockKey): NonNullable<TabItem['icon']> {
  return ({ color }) => <Icon name={ICONS[route]} color={color} size={22} />;
}
