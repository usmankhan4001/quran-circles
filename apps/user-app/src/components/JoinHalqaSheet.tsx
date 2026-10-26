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

  const signInFlow = useSignIn(handleAuthDone, { askPhone: true });

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
      ? t('signUp.problem.phone')
      : signInFlow.problem === 'phone_in_use'
        ? t(issueMessageKey('phone_in_use'))
        : signInFlow.problem === 'no_account'
          ? t(issueMessageKey('phone_required'))
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
  const emailProblemText =
    signInFlow.problem === 'invalid_email' ? t('signIn.problem.email') : undefined;

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
            {t('signIn.email.intro')}
          </Text>

          {signInFlow.step === 'email' ? (
            <>
              <TextField
                label={t('signIn.email.label')}
                helper={t('signIn.email.helper')}
                value={signInFlow.emailInput}
                onChangeText={signInFlow.setEmailInput}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                contentDirection="ltr"
                required
                {...(emailProblemText ? { error: emailProblemText } : {})}
                testID="join-email-input"
              />
              <TextField
                label={t('signUp.phone.label')}
                helper={t('signUp.phone.hint')}
                value={signInFlow.phoneInput}
                onChangeText={signInFlow.setPhoneInput}
                keyboardType="phone-pad"
                autoComplete="tel"
                contentDirection="ltr"
                required
                error={problemText}
                onSubmitEditing={() => void signInFlow.submitEmail()}
                testID="join-phone-input"
              />
              <Button
                label={t('signIn.email.submit')}
                size="large"
                fullWidth
                trailingIcon="arrow-forward"
                loading={signInFlow.working || followingAction}
                onPress={() => void signInFlow.submitEmail()}
                testID="join-send-code"
              />
            </>
          ) : null}

          {signInFlow.step === 'code' ? (
            <>
              <Text variant="body" color="textSecondary">
                {t('signIn.code.intro', { email: signInFlow.email ?? '' })}
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
                  onPress={() => void signInFlow.resend()}
                  testID="join-resend-code"
                />
                <Button
                  variant="tertiary"
                  fullWidth
                  label={t('signIn.code.changeEmail')}
                  onPress={signInFlow.changeEmail}
                  testID="join-change-email"
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
