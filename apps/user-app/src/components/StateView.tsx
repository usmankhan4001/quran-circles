import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, spacing, useTheme, type IconName } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';

export interface StateAction {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  testID?: string;
}

export interface StateViewProps {
  icon: IconName;
  /** `careful` tints the ring terracotta, for something that went wrong. */
  tone?: 'calm' | 'careful';
  title: string;
  body?: string;
  primary?: StateAction;
  secondary?: StateAction;
  /** Announces the state at once, for an error. */
  alert?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.huge,
  },
  ring: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', gap: spacing.sm, maxWidth: 300 },
  actions: { alignSelf: 'stretch', gap: spacing.sm + spacing.xxs, maxWidth: 300, width: '100%' },
});

/**
 * The page-sized "nothing here / could not load" view of the member app: a tinted ring with one
 * icon, a plain title, one sentence, and one or two actions (the first is the main one). Every
 * empty, offline and error state of the member screens draws through it so they read the same.
 */
export function StateView({
  icon,
  tone = 'calm',
  title,
  body,
  primary,
  secondary,
  alert,
  testID,
}: StateViewProps) {
  const c = useTheme().colors;
  const careful = tone === 'careful';
  return (
    <View
      testID={testID}
      style={styles.box}
      {...(alert ? { role: 'alert' as const, 'aria-live': 'assertive' as const } : {})}
    >
      <View
        aria-hidden
        style={[styles.ring, { backgroundColor: careful ? c.dangerSubtle : c.accentSubtle }]}
      >
        <Icon name={icon} size={34} color={careful ? c.textOnDangerSubtle : c.textOnAccentSubtle} />
      </View>
      <View style={styles.text}>
        <Text variant="title2" heading={2} align="center">
          {title}
        </Text>
        {body ? (
          <Text variant="body" color="textSecondary" align="center">
            {body}
          </Text>
        ) : null}
      </View>
      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? (
            <Button
              label={primary.label}
              fullWidth
              {...(primary.icon ? { icon: primary.icon } : {})}
              {...(primary.loading ? { loading: true } : {})}
              onPress={primary.onPress}
              {...(primary.testID ? { testID: primary.testID } : {})}
            />
          ) : null}
          {secondary ? (
            <Button
              variant="outline"
              label={secondary.label}
              fullWidth
              {...(secondary.icon ? { icon: secondary.icon } : {})}
              onPress={secondary.onPress}
              {...(secondary.testID ? { testID: secondary.testID } : {})}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** No circle in the chosen area (Nearby): widen the area, or ask for one. */
export function NoCirclesState({
  onWiden,
  onAsk,
  testID = 'state-no-circles',
}: {
  onWiden?: () => void;
  onAsk?: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <StateView
      icon="pin"
      title={t('states.noCircles.title')}
      body={t('states.noCircles.body')}
      {...(onWiden
        ? { primary: { label: t('states.noCircles.widen'), icon: 'map-trifold', onPress: onWiden } }
        : {})}
      {...(onAsk
        ? { secondary: { label: t('states.noCircles.ask'), icon: 'plus', onPress: onAsk } }
        : {})}
      testID={testID}
    />
  );
}

/**
 * Something failed on our side. `onSaved` offers the saved copy when there is one (the circles
 * the phone already holds), so the person is never left with nothing.
 */
export function LoadErrorState({
  onRetry,
  retrying,
  onSaved,
  title,
  body,
  testID = 'state-load-error',
}: {
  onRetry: () => void;
  retrying?: boolean;
  onSaved?: () => void;
  title?: string;
  body?: string;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <StateView
      icon="warning"
      tone="careful"
      alert
      title={title ?? t('states.loadError.title')}
      body={body ?? t('states.loadError.body')}
      primary={{
        label: t('ui.retry'),
        icon: 'repeat',
        onPress: onRetry,
        ...(retrying ? { loading: true } : {}),
        testID: 'state-retry',
      }}
      {...(onSaved
        ? { secondary: { label: t('states.loadError.saved'), icon: 'star', onPress: onSaved } }
        : {})}
      testID={testID}
    />
  );
}

/** Offline with nothing saved to show: the calm version of the error, with the same retry. */
export function OfflineState({
  onRetry,
  retrying,
  testID = 'state-offline',
}: {
  onRetry: () => void;
  retrying?: boolean;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <StateView
      icon="cloud-slash"
      alert
      title={t('ui.offlineTitle')}
      body={t('ui.offlineBody')}
      primary={{
        label: t('ui.retry'),
        icon: 'repeat',
        onPress: onRetry,
        ...(retrying ? { loading: true } : {}),
        testID: 'state-retry',
      }}
      testID={testID}
    />
  );
}

/** My Journey before anything has happened: one page to read, or a circle to find. */
export function EmptyJourneyState({
  onQuran,
  onFind,
  testID = 'journey-empty',
}: {
  onQuran: () => void;
  onFind: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <StateView
      icon="book"
      title={t('states.journey.title')}
      body={t('states.journey.body')}
      primary={{ label: t('states.journey.quran'), icon: 'book', onPress: onQuran }}
      secondary={{ label: t('states.journey.find'), icon: 'pin', onPress: onFind }}
      testID={testID}
    />
  );
}
