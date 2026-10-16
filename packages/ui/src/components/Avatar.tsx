import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** The person's name. Used for the initials and as the accessible name. */
  name: string;
  /** A picture. If it is missing or fails to load, the initials are shown. */
  imageUri?: string;
  size?: AvatarSize;
  testID?: string;
}

const px: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 72 };

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

/** Up to two initials from the first letters of the first two words. Works for Urdu names. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toLocaleUpperCase();
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h;
}

export function Avatar({ name, imageUri, size = 'md', testID }: AvatarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [failed, setFailed] = useState(false);
  const dim = px[size];
  const tints = [
    { bg: c.accentSubtle, fg: 'textOnAccentSubtle' },
    { bg: c.successSubtle, fg: 'textOnSuccessSubtle' },
    { bg: c.warningSubtle, fg: 'textOnWarningSubtle' },
    { bg: c.surfaceMuted, fg: 'text' },
  ] as const;
  const tint = tints[hash(name) % tints.length] ?? tints[0];
  const showImage = Boolean(imageUri) && !failed;
  const initials = initialsOf(name);
  return (
    <View
      testID={testID}
      role="img"
      aria-label={name}
      style={[
        styles.circle,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: tint.bg, borderWidth: 1, borderColor: c.border },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          accessibilityIgnoresInvertColors
          aria-hidden
          onError={() => setFailed(true)}
          style={{ width: dim, height: dim }}
        />
      ) : (
        <Text
          decorative
          variant={size === 'lg' ? 'title2' : size === 'md' ? 'label' : 'caption'}
          color={tint.fg}
          align="center"
          strong
          style={{ lineHeight: undefined }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
