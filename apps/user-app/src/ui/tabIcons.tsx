import type { TabItem } from '@qc/ui';
import type { TabRoute } from '../nav/routes';
import { Glyph, type GlyphName } from './Glyph';

const GLYPHS: Record<TabRoute, GlyphName> = {
  home: 'home',
  nearby: 'pin',
  quran: 'book',
  journey: 'calendar',
};

/** The icon of each tab (D12). Every tab has one, so the bar can show the label on the chosen tab only. */
export function tabIcon(route: TabRoute): NonNullable<TabItem['icon']> {
  return ({ color }) => <Glyph name={GLYPHS[route]} color={color} size={24} />;
}
