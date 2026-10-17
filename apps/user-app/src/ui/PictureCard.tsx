import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import { Glyph } from './Glyph';

export interface PictureCardProps {
  title: string;
  /** A short line under the title: when, where. */
  caption?: string;
  /** A photo, when the place has one. Without it the card shows a green block with a mark. */
  imageUri?: string;
  width?: number;
  height?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, overflow: 'hidden', justifyContent: 'flex-end' },
  mark: { position: 'absolute', top: spacing.lg, alignSelf: 'center', opacity: 0.55 },
  image: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  caption: { padding: spacing.md, gap: spacing.xxs },
});

/**
 * A place or circle as a picture with its name on it (D12, H4). The contract has no photo
 * yet, so most cards show the green block; the words on it are the same either way.
 * TODO(kit): replace with @qc/ui SessionCard (picture variant) when the ui lane exports it.
 */
export function PictureCard({
  title,
  caption,
  imageUri,
  width,
  height = 168,
  onPress,
  accessibilityLabel,
  testID,
}: PictureCardProps) {
  const theme = useTheme();
  const c = theme.colors;
  const body = (
    <>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.mark}>
          <Glyph name="home" size={56} color={c.textOnHero} />
        </View>
      )}
      <View style={[styles.caption, { backgroundColor: c.hero }]}>
        <Text variant="label" color="textOnHero" numberOfLines={2}>
          {title}
        </Text>
        {caption ? (
          <Text variant="caption" color="textOnHero" numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
    </>
  );
  const style = [
    styles.card,
    {
      height,
      ...(width ? { width } : {}),
      backgroundColor: c.hero,
      boxShadow: theme.mode === 'light' ? elevation.low : undefined,
    },
  ];
  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? [title, caption].filter(Boolean).join(', ')}
      testID={testID}
      onPress={onPress}
      style={style}
    >
      {body}
    </Pressable>
  );
}
