import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text, colors, elevation, radii, spacing, useTheme } from '@qc/ui';
import { useTextWeight } from './textWeight';
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
  /**
   * `stacked` (the default): the picture on top and the words under it on white. `portrait`
   * (Home's "Circles near you", D17): a tall picture with the section, title and caption written
   * on a dark fade at its foot.
   */
  variant?: 'stacked' | 'portrait';
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
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  body: { padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grow: { flexShrink: 1 },
  // Portrait (`.iq-photo-shade`): the fade covers the whole picture, the distance at the top and
  // the words at the foot, 10 × 12 inside.
  shade: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  photoTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});

/** Height of a portrait picture card (`.iq-photo-card`, D17). */
export const PORTRAIT_HEIGHT = 182;

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
  variant = 'stacked',
  onPress,
  accessibilityLabel,
  testID,
}: PictureCardProps) {
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  const distanceTag = distance ? (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: c.surface,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
        },
      ]}
    >
      <Text variant="caption" strong decorative>
        {distance}
      </Text>
    </View>
  ) : null;
  // As drawn: a faint shade at the top, clear to a third, then a deep green-black at the foot,
  // so the words read white on any colouring (it darkens a little sooner than the drawing, as
  // the drawn place is paler than a photo). High contrast and native draw the foot solid.
  const fade: ViewStyle =
    Platform.OS === 'web' && theme.mode !== 'highContrast'
      ? ({
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${colors.green[975]} 5%, transparent) 0%, transparent 35%, color-mix(in srgb, ${colors.green[975]} 88%, transparent) 78%, color-mix(in srgb, ${colors.green[975]} 92%, transparent) 100%)`,
        } as ViewStyle)
      : {};
  const solidFoot = Platform.OS !== 'web' || theme.mode === 'highContrast';
  const portrait = (
    <VenueArt seed={seed} height={artHeight === 92 ? PORTRAIT_HEIGHT : artHeight}>
      <View style={[styles.shade, fade]}>
        {distance ? (
          <View style={[styles.photoTag, { backgroundColor: c.surface }]}>
            <Text variant="eyebrow" decorative style={w('700', { letterSpacing: 0 })}>
              {distance}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View
          style={
            solidFoot
              ? { backgroundColor: c.hero, borderRadius: radii.sm, padding: spacing.xs }
              : null
          }
        >
          {sectionLabel ? (
            <Text
              numberOfLines={1}
              variant="eyebrow"
              style={[w('700', { letterSpacing: 0 }), { color: colors.green[200] }]}
              decorative
            >
              {sectionLabel}
            </Text>
          ) : null}
          <Text
            color="textOnHero"
            numberOfLines={2}
            decorative
            variant="label"
            style={[w('700'), { marginTop: 1 }]}
          >
            {title}
          </Text>
          {caption ? (
            <Text
              color="textOnHero"
              numberOfLines={1}
              decorative
              variant="eyebrow"
              style={[w('500', { letterSpacing: 0 }), { marginTop: 2, opacity: 0.82 }]}
            >
              {caption}
            </Text>
          ) : null}
          {footer}
        </View>
      </View>
    </VenueArt>
  );
  const body =
    variant === 'portrait' ? (
      portrait
    ) : (
      <>
        <VenueArt seed={seed} height={artHeight}>
          {distanceTag}
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
      ...(variant === 'portrait' ? { borderRadius: radii.section } : {}),
      backgroundColor: c.surface,
      borderWidth: variant === 'portrait' && theme.mode !== 'highContrast' ? 0 : 1,
      borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
      boxShadow:
        theme.mode === 'light'
          ? variant === 'portrait'
            ? elevation.medium
            : elevation.low
          : undefined,
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
    <Pressable
      role="button"
      aria-label={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed ? { backgroundColor: c.surfaceMuted } : undefined,
        pressed && !theme.reduceMotion ? { transform: [{ scale: 0.992 }] } : undefined,
      ]}
    >
      {body}
    </Pressable>
  );
}
