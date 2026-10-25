import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, CodeField, Icon, Sheet, Text, TextField, radii, spacing, useTheme } from '@qc/ui';
import { issueMessageKey } from '@qc/contracts';
import { errorMessageKey } from '../core/errors';
import { useSignIn } from '../features/auth/useSignIn';
import { useFollowActions } from '../features/journey/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useAuthStatus } from '../providers/hooks';

export interface JoinHalqaSheetProps {
  visible: boolean;
  onClose: () => void;
  venueId?: string;
  venueName?: string;
  circleId?: string;
  circleName?: string;
  onSuccess?: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  row: { gap: spacing.sm },
  successBox: {
    padding: spacing.lg,
    borderRadius: radii.card,
    alignItems: 'center',
    gap: spacing.md,
  },
  tickCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function JoinHalqaSheet({
  visible,
  onClose,
  venueId,
  venueName,
  circleId,
  circleName,
  onSuccess,
  testID = 'join-halqa-sheet',
}: JoinHalqaSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const status = useAuthStatus();
  const { follow } = useFollowActions();
  const [completed, setCompleted] = useState(false);
  const [followingAction, setFollowingAction] = useState(false);

  const targetName = venueName ?? circleName ?? t('session.title');

  const executeFollow = useCallback(async () => {
    setFollowingAction(true);
    try {
      if (venueId) {
        await follow.run({ venueId });
      } else if (circleId) {
        await follow.run({ circleId });
      }
      setCompleted(true);
      onSuccess?.();
    } catch {
      // follow action handled
    } finally {
      setFollowingAction(false);
    }
  }, [venueId, circleId, follow, onSuccess]);

  const handleAuthDone = useCallback(() => {
    void executeFollow();
  }, [executeFollow]);

  const signInFlow = useSignIn(handleAuthDone);

  // If the user was already signed in when the sheet opened, immediately follow
  useEffect(() => {
    if (visible && status === 'signedIn' && !completed && !followingAction) {
      void executeFollow();
    }
  }, [visible, status, completed, followingAction, executeFollow]);

  const handleClose = () => {
    setCompleted(false);
    onClose();
  };

  const problemText =
    signInFlow.problem === 'invalid_phone'
      ? t('signIn.problem.phone')
      : signInFlow.problem === 'phone_not_pakistan_mobile'
        ? t(issueMessageKey('phone_not_pakistan_mobile'))
        : signInFlow.problem === 'invalid_code'
          ? t('signIn.problem.code')
          : signInFlow.problem === 'invalid_name'
            ? t('signIn.problem.name')
            : signInFlow.error
              ? signInFlow.error.code === 'rate_limited' ||
                signInFlow.error.code === 'otp_too_many_attempts'
                ? `${t(errorMessageKey(signInFlow.error.code))}${
                    signInFlow.error.retryAfterSeconds
                      ? ` ${t('signIn.retryAfter', { count: signInFlow.error.retryAfterSeconds })}`
                      : ''
                  }`
                : t(errorMessageKey(signInFlow.error.code))
              : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={completed ? t('venue.following') : t('venue.follow')}
      testID={testID}
    >
      {completed ? (
        <View style={styles.stack} testID="join-halqa-success">
          <View style={[styles.successBox, { backgroundColor: c.successSubtle }]}>
            <View style={[styles.tickCircle, { backgroundColor: c.success }]}>
              <Icon name="success" size={32} color={c.textOnAccent} />
            </View>
            <Text variant="title3" align="center" strong>
              {t('venue.following')} {targetName}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {t('venue.followDone')}
            </Text>
          </View>
          <Button
            label={t('ui.close')}
            size="large"
            fullWidth
            onPress={handleClose}
            testID="join-halqa-done"
          />
        </View>
      ) : (
        <View style={styles.stack}>
          {/* Subtitle / Promise */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: c.accentSubtle }]}>
              <Text variant="caption" color="textAccent" strong>
                {t('venue.followBadge')}
              </Text>
            </View>
          </View>

          <Text variant="body" color="textSecondary">
            {t('signIn.phone.intro')}
          </Text>

          {signInFlow.step === 'phone' ? (
            <>
              <TextField
                label={t('signIn.phone.label')}
                helper={t('signIn.phone.helper')}
                value={signInFlow.phoneInput}
                onChangeText={signInFlow.setPhoneInput}
                keyboardType="phone-pad"
                autoComplete="tel"
                contentDirection="ltr"
                required
                error={problemText}
                onSubmitEditing={() => void signInFlow.submitPhone()}
                testID="join-phone-input"
              />
              <Button
                label={t('signIn.phone.submit')}
                size="large"
                fullWidth
                trailingIcon="arrow-forward"
                loading={signInFlow.working || followingAction}
                onPress={() => void signInFlow.submitPhone()}
                testID="join-send-code"
              />
            </>
          ) : null}

          {signInFlow.step === 'code' ? (
            <>
              <Text variant="body" color="textSecondary">
                {signInFlow.channel === 'sms'
                  ? t('signIn.code.introSms')
                  : t('signIn.code.introWhatsapp')}
              </Text>
              <CodeField
                accessibilityLabel={t('signIn.code.label')}
                value={signInFlow.codeInput}
                onChangeText={signInFlow.setCodeInput}
                {...(problemText ? { error: problemText } : {})}
                testID="join-code-input"
              />
              <Button
                label={t('signIn.code.submit')}
                size="large"
                fullWidth
                loading={signInFlow.working || followingAction}
                onPress={() => void signInFlow.submitCode()}
                testID="join-verify-code"
              />
              <View style={styles.row}>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={signInFlow.resendIn > 0 || signInFlow.working}
                  label={
                    signInFlow.resendIn > 0
                      ? t('signIn.code.resendIn', { count: signInFlow.resendIn })
                      : t('signIn.code.resend')
                  }
                  onPress={() => void signInFlow.resend('whatsapp')}
                  testID="join-resend-code"
                />
                {signInFlow.resendIn === 0 ? (
                  <Button
                    variant="tertiary"
                    fullWidth
                    disabled={signInFlow.working}
                    label={t('signIn.code.useSms')}
                    onPress={() => void signInFlow.resend('sms')}
                    testID="join-resend-sms"
                  />
                ) : null}
                <Button
                  variant="tertiary"
                  fullWidth
                  label={t('signIn.code.changeNumber')}
                  onPress={signInFlow.changeNumber}
                  testID="join-change-number"
                />
              </View>
            </>
          ) : null}

          {signInFlow.step === 'name' ? (
            <>
              <Text variant="body" color="textSecondary">
                {t('signIn.name.intro')}
              </Text>
              <TextField
                label={t('signIn.name.label')}
                value={signInFlow.nameInput}
                onChangeText={signInFlow.setNameInput}
                autoComplete="name"
                error={problemText}
                onSubmitEditing={() => void signInFlow.submitName()}
                testID="join-name-input"
              />
              <Button
                label={t('signIn.name.submit')}
                size="large"
                fullWidth
                loading={signInFlow.working || followingAction}
                onPress={() => void signInFlow.submitName()}
                testID="join-submit-name"
              />
              <Button
                variant="tertiary"
                fullWidth
                label={t('signIn.name.skip')}
                onPress={signInFlow.skipName}
                testID="join-skip-name"
              />
            </>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
