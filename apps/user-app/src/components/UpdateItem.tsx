import { Pressable, StyleSheet, View } from 'react-native';
import {
  Icon,
  Text,
  radii,
  spacing,
  useTheme,
  type IconName,
  type SemanticColors,
  type TextColor,
} from '@qc/ui';
import type { Update, UpdateKind } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  open: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
  dotBox: { width: 12, alignItems: 'center', paddingTop: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

type ColorKey = keyof SemanticColors;

/** The picture of each kind of update: a clock for a new time, a cross for a cancellation. */
export const KIND_LOOK: Record<
  UpdateKind,
  { icon: IconName; tint: ColorKey; ink: ColorKey; label: TextColor }
> = {
  time_change: {
    icon: 'clock',
    tint: 'warningSubtle',
    ink: 'textOnWarningSubtle',
    label: 'textOnWarningSubtle',
  },
  cancellation: {
    icon: 'close',
    tint: 'dangerSubtle',
    ink: 'textOnDangerSubtle',
    label: 'textDanger',
  },
  special_lecture: {
    icon: 'star',
    tint: 'accentSubtle',
    ink: 'textOnAccentSubtle',
    label: 'textAccent',
  },
  announcement: {
    icon: 'megaphone',
    tint: 'surfaceMuted',
    ink: 'textSecondary',
    label: 'textSecondary',
  },
};

/**
 * One row of the Updates feed: the kind as a picture in a tinted square, its name in the kind's
 * colour, the title (bold while unread), a short body, and a green dot while it is unread. A
 * row with a session behind it ends with "Go to session" and opens that session.
 */
export function UpdateItem({ update, onPress }: { update: Update; onPress?: () => void }) {
  const { l, t, locale } = useI18n();
  const c = useTheme().colors;
  const title = l(update.title);
  const body = l(update.body);
  const look = KIND_LOOK[update.kind];
  const opensSession = Boolean(update.sessionId && onPress);
  const label = [
    update.isRead ? null : t('updates.unreadMarker'),
    t(`updates.kind.${update.kind}`),
    title.text,
    opensSession ? t('updates.goToSession') : null,
  ]
    .filter(Boolean)
    .join(', ');
  const when = new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(update.publishedAt));
  const content = (
    <>
      <View
        aria-hidden
        style={[styles.tile, { backgroundColor: c[look.tint] }]}
        testID={`update-${update.id}-kind`}
      >
        <Icon name={look.icon} size={22} color={c[look.ink]} />
      </View>
      <View style={styles.text}>
        <Text variant="caption" color={look.label} strong>
          {t(`updates.kind.${update.kind}`)}
        </Text>
        <Text variant="label" strong={!update.isRead} lang={title.lang}>
          {title.text}
        </Text>
        {body.text ? (
          <Text variant="caption" color="textSecondary" lang={body.lang}>
            {body.text}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {when}
        </Text>
        {opensSession ? (
          <View style={styles.open} testID={`update-${update.id}-open`}>
            <Text variant="caption" color="textAccent" strong decorative>
              {t('updates.goToSession')}
            </Text>
            <Icon name="chevron-forward" size={16} color={c.textAccent} />
          </View>
        ) : null}
      </View>
      <View style={styles.dotBox}>
        {update.isRead ? null : (
          <View aria-hidden style={[styles.dot, { backgroundColor: c.accent }]} />
        )}
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      testID={`update-${update.id}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: c.hairline,
          backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      aria-label={label}
      testID={`update-${update.id}`}
      style={[styles.row, { borderBottomColor: c.hairline }]}
    >
      {content}
    </View>
  );
}

export function UpdateBody({ update }: { update: Update }) {
  const { l } = useI18n();
  const body = l(update.body);
  return (
    <View>
      <Text variant="body" lang={body.lang}>
        {body.text}
      </Text>
    </View>
  );
}
