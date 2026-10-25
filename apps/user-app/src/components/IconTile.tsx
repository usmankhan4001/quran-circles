import { StyleSheet, View } from 'react-native';
import { Icon, radii, useTheme, type IconName } from '@qc/ui';

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * A small square with a line icon, at the start of a venue, host or list row. `tint` is the
 * emerald tint (D17); `fill` is the quiet grey of the white-page lists (My Journey, Memorisation,
 * Profile), with the icon in green.
 */
export function IconTile({ icon, tone = 'tint' }: { icon: IconName; tone?: 'tint' | 'fill' }) {
  const c = useTheme().colors;
  const fill = tone === 'fill';
  return (
    <View
      aria-hidden
      style={[styles.tile, { backgroundColor: fill ? c.surfaceMuted : c.accentSubtle }]}
    >
      <Icon name={icon} size={22} color={fill ? c.textAccent : c.textOnAccentSubtle} />
    </View>
  );
}
