import { StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';

export interface SkeletonProps {
  /** `text` draws lines, `block` a rectangle, `circle` an avatar-sized disc. */
  shape?: 'text' | 'block' | 'circle';
  width?: DimensionValue;
  height?: number;
  /** For `text`: the number of lines. The last line is shorter. */
  lines?: number;
  /** Set on the first skeleton of a group; later ones are hidden from screen readers. */
  announce?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  line: { borderRadius: radii.sm },
  gap: { marginTop: spacing.sm },
});

/**
 * A grey placeholder shown while content loads. It is static (no shimmer), so it is calm and
 * needs no reduced-motion handling. The group is announced once as "Loading".
 */
export function Skeleton({ shape = 'text', width = '100%', height, lines = 1, announce = true, testID }: SkeletonProps) {
  const theme = useTheme();
  const fill = theme.colors.skeleton;
  const a11y = announce
    ? ({ role: 'progressbar', 'aria-busy': true, 'aria-label': theme.t('ui.loading') } as const)
    : ({ 'aria-hidden': true } as const);
  if (shape === 'circle') {
    const size = height ?? 48;
    return (
      <View testID={testID} {...a11y} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill }} />
    );
  }
  if (shape === 'block') {
    return (
      <View
        testID={testID}
        {...a11y}
        style={[styles.line, { width, height: height ?? 96, backgroundColor: fill, borderRadius: radii.md }]}
      />
    );
  }
  const lineHeight = height ?? Math.round(theme.type('body').fontSize * 0.9);
  return (
    <View testID={testID} {...a11y}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <View
          key={i}
          style={[
            styles.line,
            i > 0 ? styles.gap : undefined,
            {
              height: lineHeight,
              backgroundColor: fill,
              width: lines > 1 && i === lines - 1 ? '60%' : width,
            },
          ]}
        />
      ))}
    </View>
  );
}
