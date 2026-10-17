import { Image, StyleSheet, View } from 'react-native';
import { radii, useTheme } from '@qc/ui';
import { Glyph } from './Glyph';

export interface PhotoBlockProps {
  /** The photo of the place. The contract has none yet, so most pages show the neutral block. */
  imageUri?: string;
  height?: number;
  testID?: string;
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
});

/**
 * The photo area on top of a session or venue page (S1). With no photo it is a neutral block
 * with a mark, on the glass of the green header; a photo, when there is one, fills it.
 * TODO(kit): replace with the @qc/ui photo header when the ui lane exports it.
 */
export function PhotoBlock({ imageUri, height = 168, testID }: PhotoBlockProps) {
  const c = useTheme().colors;
  return (
    <View
      testID={testID}
      aria-hidden
      style={[styles.block, { height, backgroundColor: c.heroGlass }]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <Glyph name="home" size={64} color={c.textOnHero} />
      )}
    </View>
  );
}
