import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import type { Section } from '@qc/contracts';
import { SectionIcon } from './SectionIcon';
import { VenueArt } from './VenueArt';

export interface PictureCardProps {
  /** Picks the colouring of the drawn place. Use the venue id, so a place looks the same everywhere. */
  seed: string;
  title: string;
  /** A short line under the title: when. */
  caption?: string;
  /** How far away, written on the picture ("1.2 km"). */
  distance?: string;
  /** Shown as a small picture next to the caption. */
  section?: Section;
  /** The section's name, said with the card. */
  sectionLabel?: string;
  /** Anything under the caption, such as a seat meter. */
  footer?: ReactNode;
  width?: number;
  artHeight?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, overflow: 'hidden' },
  tag: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  body: { padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grow: { flexShrink: 1 },
});

/**
 * A circle or place as a picture card (H4, N2): the drawn place on top with how far it is,
 * and the name and time under it on white. The contract has no photo of a place, so the
 * picture is drawn; the words are the same either way.
 * TODO(kit): replace with @qc/ui SessionCard (picture variant) when the ui lane exports it.
 */
export function PictureCard({
  seed,
  title,
  caption,
  distance,
  section,
  sectionLabel,
  footer,
  width,
  artHeight = 92,
  onPress,
  accessibilityLabel,
  testID,
}: PictureCardProps) {
  const theme = useTheme();
  const c = theme.colors;
  const body = (
    <>
      <VenueArt seed={seed} height={artHeight}>
        {distance ? (
          <View style={[styles.tag, { backgroundColor: c.surface }]}>
            <Text variant="caption" strong decorative>
              {distance}
            </Text>
          </View>
        ) : null}
      </VenueArt>
      <View style={styles.body}>
        <Text variant="label" numberOfLines={2}>
          {title}
        </Text>
        {caption || section ? (
          <View style={styles.row}>
            {section ? <SectionIcon section={section} size={16} color={c.textSecondary} /> : null}
            {caption ? (
              <View style={styles.grow}>
                <Text variant="caption" color="textSecondary" numberOfLines={2}>
                  {caption}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {footer}
      </View>
    </>
  );
  const style = [
    styles.card,
    {
      ...(width ? { width } : {}),
      backgroundColor: c.surface,
      borderWidth: theme.mode === 'light' ? 0 : 1,
      borderColor: c.border,
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
  const label =
    accessibilityLabel ?? [title, caption, sectionLabel, distance].filter(Boolean).join(', ');
  return (
    <Pressable role="button" aria-label={label} testID={testID} onPress={onPress} style={style}>
      {body}
    </Pressable>
  );
}
