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

/** A small emerald-tint square with a line icon (D17), at the start of a venue or host row. */
export function IconTile({ icon }: { icon: IconName }) {
  const c = useTheme().colors;
  return (
    <View aria-hidden style={[styles.tile, { backgroundColor: c.accentSubtle }]}>
      <Icon name={icon} size={22} color={c.textOnAccentSubtle} />
    </View>
  );
}
