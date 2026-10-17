import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Card,
  Icon,
  Tag,
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  kind: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stack: { flex: 1, gap: spacing.xs },
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
  const { l, t } = useI18n();
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
  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`update-${update.id}`}>
      <View style={styles.row}>
        <View
          style={[styles.kind, { backgroundColor: c[look.tint] }]}
          testID={`update-${update.id}-kind`}
        >
          <Icon name={look.icon} size={20} color={c[look.ink]} />
        </View>
        <View style={styles.stack}>
          <View style={styles.head}>
            <Tag label={t(`updates.kind.${update.kind}`)} kind="neutral" />
            {update.isRead ? null : <Badge dot />}
          </View>
          <Text variant="label" lang={title.lang}>
            {title.text}
          </Text>
          <Text variant="body" color="textSecondary" lang={body.lang}>
            {body.text}
          </Text>
          {opensSession ? (
            <View style={styles.open} testID={`update-${update.id}-open`}>
              <Text variant="label" color="textAccent" decorative>
                {t('updates.goToSession')}
              </Text>
              <Icon name="chevron-forward" size={18} color={c.textAccent} />
            </View>
          ) : null}
        </View>
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
