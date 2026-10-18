import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Card,
  Icon,
  Text,
  radii,
  spacing,
  useTheme,
  type IconName,
  type SemanticColors,
} from '@qc/ui';
import type { Update, UpdateKind } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';

const styles = StyleSheet.create({
  inner: { padding: spacing.lg, gap: spacing.xs },
  bar: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 4 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + spacing.xxs, flex: 1 },
  kind: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  open: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
});

type ColorKey = keyof SemanticColors;

/** The picture of each kind of update (B): a clock for a new time, a cross for a cancellation. */
export const KIND_LOOK: Record<UpdateKind, { icon: IconName; tint: ColorKey; ink: ColorKey }> = {
  time_change: { icon: 'clock', tint: 'warningSubtle', ink: 'textOnWarningSubtle' },
  cancellation: { icon: 'close', tint: 'dangerSubtle', ink: 'textOnDangerSubtle' },
  special_lecture: { icon: 'star', tint: 'successSubtle', ink: 'textOnSuccessSubtle' },
  announcement: { icon: 'bell', tint: 'accentSubtle', ink: 'textOnAccentSubtle' },
};

/**
 * One card of the Updates feed (B): the kind as a picture in a tinted square, the title, a
 * short body, and a dot while it is unread. A card with a session behind it ends with "Go to
 * session" and opens that session.
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
  return (
    <Card
      onPress={onPress}
      padding="none"
      accessibilityLabel={label}
      testID={`update-${update.id}`}
    >
      {/* Unread: an emerald edge on the start side (D17), and the dot. */}
      {update.isRead ? null : (
        <View aria-hidden style={[styles.bar, { backgroundColor: c.accent }]} />
      )}
      <View style={styles.inner}>
        <View style={styles.head}>
          <View style={styles.kindRow}>
            <View
              style={[styles.kind, { backgroundColor: c[look.tint] }]}
              testID={`update-${update.id}-kind`}
            >
              <Icon name={look.icon} size={14} color={c[look.ink]} />
            </View>
            <Text variant="caption" color="textAccent" strong>
              {t(`updates.kind.${update.kind}`)}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary">
            {when}
          </Text>
          {update.isRead ? null : <Badge dot />}
        </View>
        <Text variant="label" lang={title.lang}>
          {title.text}
        </Text>
        <Text variant="caption" color="textSecondary" lang={body.lang}>
          {body.text}
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
    </Card>
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
