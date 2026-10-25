import { StyleSheet, View } from 'react-native';
import { issueMessageKey } from '@qc/contracts';
import { Button, CodeField, Text, TextField, spacing } from '@qc/ui';
import { Page } from '../components/Page';
import { errorMessageKey } from '../core/errors';
import { formatPhoneForDisplay, normalizePhone } from '../core/phone';
import { retryAfterText } from '../core/wait';
import { useSignIn } from '../features/auth/useSignIn';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { hrefToRoute, type Route } from '../nav/routes';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  intro: { gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.xs },
});

/** Where to go after sign-in: back to what the person was doing, or Home. */
export function routeAfterSignIn(returnTo: string | undefined): Route {
  return (returnTo ? hrefToRoute(returnTo) : null) ?? { name: 'home' };
}

/**
 * Sign in with a mobile number: the number, then "Enter the code" (WhatsApp first, SMS as a
 * fallback). A person whose account has no name yet is asked for one last. Creating an account
 * has its own screens (`SignUpScreen`).
 */
export function SignInScreen({ returnTo }: { returnTo?: string }) {
  const { t } = useI18n();
  const nav = useNav();
  const flow = useSignIn(() => nav.replace(routeAfterSignIn(returnTo)));

  const problemText =
    flow.problem === 'invalid_phone'
      ? t('signIn.problem.phone')
      : flow.problem === 'phone_not_pakistan_mobile'
        ? t(issueMessageKey('phone_not_pakistan_mobile'))
        : flow.problem === 'invalid_code'
          ? t('signIn.problem.code')
          : flow.problem === 'invalid_name'
            ? t('signIn.problem.name')
            : flow.error
              ? flow.error.code === 'rate_limited' || flow.error.code === 'otp_too_many_attempts'
                ? [
                    t(errorMessageKey(flow.error.code)),
                    retryAfterText(t, flow.error.retryAfterSeconds),
                  ]
                    .filter(Boolean)
                    .join(' ')
                : t(errorMessageKey(flow.error.code))
              : undefined;

  const shownPhone = formatPhoneForDisplay(normalizePhone(flow.phoneInput) ?? flow.phoneInput);
  const back = returnTo ? hrefToRoute(returnTo) : null;

  if (flow.step === 'code') {
    return (
      <Page
        testID="sign-in-screen"
        onBack={flow.changeNumber}
        footer={
          <Button
            label={t('signIn.code.submit')}
            icon="check"
            size="large"
            fullWidth
            loading={flow.working}
            onPress={() => void flow.submitCode()}
            testID="verify-code"
          />
        }
      >
        <View style={styles.stack}>
          <View style={styles.intro}>
            <Text variant="display" heading={1}>
              {t('signIn.code.title')}
            </Text>
            <Text variant="body" color="textMuted">
              {t(flow.channel === 'sms' ? 'signIn.code.introSmsTo' : 'signIn.code.intro', {
                phone: shownPhone,
              })}
            </Text>
          </View>
          <CodeField
            accessibilityLabel={t('signIn.code.label')}
            value={flow.codeInput}
            onChangeText={flow.setCodeInput}
            {...(problemText ? { error: problemText } : {})}
            testID="code-input"
          />
          <View style={styles.center}>
            {flow.resendIn > 0 ? (
              <Text variant="caption" color="textMuted">
                {t('signIn.code.resendIn', { count: flow.resendIn })}
              </Text>
            ) : (
              <Button
                variant="tertiary"
                label={t('signIn.code.resend')}
                disabled={flow.working}
                onPress={() => void flow.resend('whatsapp')}
                testID="resend-code"
              />
            )}
            {flow.resendIn === 0 ? (
              <Button
                variant="tertiary"
                label={t('signIn.code.useSms')}
                disabled={flow.working}
                onPress={() => void flow.resend('sms')}
                testID="resend-sms"
              />
            ) : null}
            <Button
              variant="tertiary"
              label={t('signIn.code.changeNumber')}
              onPress={flow.changeNumber}
              testID="change-number"
            />
          </View>
        </View>
      </Page>
    );
  }

  if (flow.step === 'name' || flow.step === 'done') {
    return (
      <Page
        testID="sign-in-screen"
        footer={
          <>
            <Button
              label={t('signIn.name.submit')}
              size="large"
              fullWidth
              loading={flow.working}
              onPress={() => void flow.submitName()}
              testID="save-name"
            />
            <Button
              variant="tertiary"
              fullWidth
              label={t('signIn.name.skip')}
              onPress={flow.skipName}
              testID="skip-name"
            />
          </>
        }
      >
        <View style={styles.stack}>
          <View style={styles.intro}>
            <Text variant="display" heading={1}>
              {t('signIn.name.heading')}
            </Text>
            <Text variant="body" color="textMuted">
              {t('signIn.name.intro')}
            </Text>
          </View>
          <TextField
            label={t('signIn.name.label')}
            value={flow.nameInput}
            onChangeText={flow.setNameInput}
            autoComplete="name"
            error={problemText}
            onSubmitEditing={() => void flow.submitName()}
            testID="name-input"
          />
        </View>
      </Page>
    );
  }

  return (
    <Page
      testID="sign-in-screen"
      onBack={() => nav.back()}
      trailing={
        <Button
          variant="tertiary"
          label={t('signIn.notNow')}
          onPress={() => nav.back()}
          testID="sign-in-not-now"
        />
      }
      footer={
        <>
          <Button
            label={t('signIn.phone.submit')}
            icon="paper-plane-tilt"
            size="large"
            fullWidth
            loading={flow.working}
            onPress={() => void flow.submitPhone()}
            testID="send-code"
          />
          <Button
            variant="tertiary"
            fullWidth
            label={t('signIn.newHere')}
            onPress={() => nav.replace({ name: 'signUp', ...(back ? { returnTo: back } : {}) })}
            testID="sign-in-new-here"
          />
        </>
      }
    >
      <View style={styles.stack}>
        <View style={styles.intro}>
          <Text variant="display" heading={1}>
            {t('signIn.welcomeBack')}
          </Text>
          <Text variant="body" color="textMuted">
            {t('signIn.intro')}
          </Text>
        </View>
        <TextField
          label={t('signIn.phone.label')}
          helper={t('signIn.phone.helper')}
          value={flow.phoneInput}
          onChangeText={flow.setPhoneInput}
          keyboardType="phone-pad"
          autoComplete="tel"
          contentDirection="ltr"
          required
          error={problemText}
          onSubmitEditing={() => void flow.submitPhone()}
          testID="phone-input"
        />
      </View>
    </Page>
  );
}
