import { StyleSheet, View } from 'react-native';
import { iconFlipTransform } from '../direction';
import { keepColorsInForcedMode, systemColors, useForcedColors } from '../forcedColors';
import { useTheme } from '../theme';
import { PhosphorSvg } from './PhosphorSvg';
import { phosphorGlyphs, phosphorSlugs, type PhosphorSlug } from './phosphor-glyphs';
import type { IconWeight } from './phosphor-types';

export type { IconWeight } from './phosphor-types';
export type { PhosphorSlug } from './phosphor-glyphs';

/**
 * The kit's icons are Phosphor Icons (D17, the owner's Iqraa showcase), drawn from path data in
 * `phosphor-glyphs.ts` (react-native-svg on phones, a plain `<svg>` on the web).
 *
 * Two kinds of name work:
 * - the Phosphor names the showcase uses (`house`, `compass`, `book-open-text`, `mosque`,
 *   `ticket`, `qr-code`, `caret-right`, `arrow-right` and the rest of `phosphorSlugs`);
 * - the kit's earlier names (`home`, `pin`, `chevron-forward`, `masjid` and so on), each drawn
 *   with the closest Phosphor glyph, so existing screens keep working.
 *
 * Names that point somewhere (`chevron-forward`, `caret-right`, `arrow-right`) mirror in
 * right-to-left (see `flippingIcons` in `direction.ts`).
 */
export type KitIconName =
  | 'chevron-forward'
  | 'chevron-back'
  | 'chevron-down'
  | 'chevron-up'
  | 'check'
  | 'close'
  | 'plus'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'search'
  | 'home'
  | 'pin'
  | 'book'
  | 'calendar'
  | 'clock'
  | 'bell'
  | 'people'
  | 'user'
  | 'filter'
  | 'route'
  | 'prayer'
  | 'share'
  | 'bookmark'
  | 'star'
  | 'arrow-forward'
  | 'arrow-back'
  | 'minus'
  | 'masjid'
  | 'compass'
  | 'ticket'
  | 'qr'
  | 'phone'
  | 'sun'
  | 'sliders'
  | 'play'
  | 'check-circle';

export type IconName = KitIconName | PhosphorSlug;

/** The kit's earlier names and the Phosphor glyph (and default weight) each one draws. */
export const kitIconGlyphs: Record<KitIconName, { slug: PhosphorSlug; weight?: IconWeight }> = {
  'chevron-forward': { slug: 'caret-right', weight: 'bold' },
  'chevron-back': { slug: 'caret-left', weight: 'bold' },
  'chevron-down': { slug: 'caret-down', weight: 'bold' },
  'chevron-up': { slug: 'caret-up', weight: 'bold' },
  check: { slug: 'check', weight: 'bold' },
  close: { slug: 'x', weight: 'bold' },
  plus: { slug: 'plus', weight: 'bold' },
  info: { slug: 'info' },
  success: { slug: 'check-circle' },
  warning: { slug: 'warning-circle' },
  error: { slug: 'x-circle' },
  search: { slug: 'magnifying-glass' },
  home: { slug: 'house' },
  pin: { slug: 'map-pin' },
  book: { slug: 'book-open-text' },
  calendar: { slug: 'calendar-blank' },
  clock: { slug: 'clock' },
  bell: { slug: 'bell' },
  people: { slug: 'users-three' },
  user: { slug: 'user' },
  filter: { slug: 'sliders-horizontal' },
  route: { slug: 'path' },
  prayer: { slug: 'mosque' },
  share: { slug: 'share-network' },
  bookmark: { slug: 'bookmark-simple' },
  star: { slug: 'star' },
  'arrow-forward': { slug: 'arrow-right' },
  'arrow-back': { slug: 'arrow-left' },
  minus: { slug: 'minus', weight: 'bold' },
  masjid: { slug: 'mosque' },
  compass: { slug: 'compass' },
  ticket: { slug: 'ticket' },
  qr: { slug: 'qr-code' },
  phone: { slug: 'phone' },
  sun: { slug: 'sun' },
  sliders: { slug: 'sliders-horizontal' },
  play: { slug: 'play', weight: 'fill' },
  'check-circle': { slug: 'check-circle', weight: 'fill' },
};

const kitNames = Object.keys(kitIconGlyphs) as KitIconName[];

/** Every name `Icon` draws: the kit's names first, then the Phosphor names. */
export const iconNames: readonly IconName[] = [
  ...kitNames,
  ...phosphorSlugs.filter((slug) => !(kitNames as readonly string[]).includes(slug)),
];

const isKitName = (name: IconName): name is KitIconName => name in kitIconGlyphs;

/** The Phosphor glyph and weight a name draws when no weight is asked for. */
export function resolveIcon(name: IconName, weight?: IconWeight) {
  const kit = isKitName(name) ? kitIconGlyphs[name] : undefined;
  const slug: PhosphorSlug = kit ? kit.slug : (name as PhosphorSlug);
  return { slug, weight: weight ?? kit?.weight ?? 'regular' };
}

export interface IconProps {
  name: IconName;
  /** Size in dp. Default 24. Icons scale with the text size, so the caller does not. */
  size?: number;
  /** A colour from the current theme. Defaults to the text colour. */
  color?: string;
  /**
   * Phosphor weight: `regular` lines, `bold` lines, `fill` (the chosen tab), or `duotone` (line
   * with a 20% tint behind). Defaults to the name's own weight, else `regular`.
   */
  weight?: IconWeight;
  /** Icons are decorative unless given a label. */
  accessibilityLabel?: string;
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});

export function Icon({ name, size = 24, color, weight, accessibilityLabel }: IconProps) {
  const theme = useTheme();
  // In forced colours (web) the browser would repaint the drawing as the page colour, so the
  // art keeps its colours and is drawn in the system text colour instead (A-07).
  const forced = useForcedColors();
  const tint = forced ? systemColors.text : (color ?? theme.colors.text);
  const flip = iconFlipTransform(name, theme.direction);
  const icon = resolveIcon(name, weight);
  return (
    <View
      testID={`icon-${name}`}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={accessibilityLabel ? undefined : true}
      style={[s.box, { width: size, height: size }, flip, forced ? keepColorsInForcedMode : null]}
    >
      <PhosphorSvg
        glyph={phosphorGlyphs[icon.slug]}
        weight={icon.weight}
        size={size}
        color={tint}
      />
    </View>
  );
}
