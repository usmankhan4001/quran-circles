import { StyleSheet, View } from 'react-native';
import { issueMessageKey } from '@qc/contracts';
import { Button, Card, CodeField, Text, TextField, spacing } from '@qc/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { MasjidLineArt } from '../ui/MasjidLineArt';
import { errorMessageKey } from '../core/errors';
import { useSignIn } from '../features/auth/useSignIn';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { hrefToRoute, type Route } from '../nav/routes';

const styles = StyleSheet.create({ stack: { gap: spacing.lg }, row: { gap: spacing.sm } });

/** Where to go after sign-in: back to what the person was doing, or Home. */
export function routeAfterSignIn(returnTo: string | undefined): Route {
  return (returnTo ? hrefToRoute(returnTo) : null) ?? { name: 'home' };
}

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
                ? `${t(errorMessageKey(flow.error.code))}${
                    flow.error.retryAfterSeconds
                      ? ` ${t('signIn.retryAfter', { count: flow.error.retryAfterSeconds })}`
                      : ''
                  }`
                : t(errorMessageKey(flow.error.code))
              : undefined;

  return (
    <ScreenFrame
      title={t('signIn.title')}
      onBack={() => nav.back()}
      hero={<MasjidLineArt height={120} testID="sign-in-art" />}
      testID="sign-in-screen"
    >
      <Card>
        <View style={styles.stack}>
          {flow.step === 'phone' ? (
            <>
              <Text variant="bodyLarge">{t('signIn.phone.intro')}</Text>
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
              <Button
                label={t('signIn.phone.submit')}
                size="large"
                fullWidth
                loading={flow.working}
                onPress={() => void flow.submitPhone()}
                testID="send-code"
              />
            </>
          ) : null}

          {flow.step === 'code' ? (
            <>
              <Text variant="bodyLarge">
                {flow.channel === 'sms'
                  ? t('signIn.code.introSms')
                  : t('signIn.code.introWhatsapp')}
              </Text>
              <CodeField
                accessibilityLabel={t('signIn.code.label')}
                value={flow.codeInput}
                onChangeText={flow.setCodeInput}
                {...(problemText ? { error: problemText } : {})}
                testID="code-input"
              />
              <Button
                label={t('signIn.code.submit')}
                size="large"
                fullWidth
                loading={flow.working}
                onPress={() => void flow.submitCode()}
                testID="verify-code"
              />
              <View style={styles.row}>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={flow.resendIn > 0 || flow.working}
                  label={
                    flow.resendIn > 0
                      ? t('signIn.code.resendIn', { count: flow.resendIn })
                      : t('signIn.code.resend')
                  }
                  onPress={() => void flow.resend('whatsapp')}
                  testID="resend-code"
                />
                {flow.resendIn === 0 ? (
                  <Button
                    variant="tertiary"
                    fullWidth
                    disabled={flow.working}
                    label={t('signIn.code.useSms')}
                    onPress={() => void flow.resend('sms')}
                    testID="resend-sms"
                  />
                ) : null}
                <Button
                  variant="tertiary"
                  fullWidth
                  label={t('signIn.code.changeNumber')}
                  onPress={flow.changeNumber}
                  testID="change-number"
                />
              </View>
            </>
          ) : null}

          {flow.step === 'name' ? (
            <>
              <Text variant="bodyLarge">{t('signIn.name.intro')}</Text>
              <TextField
                label={t('signIn.name.label')}
                value={flow.nameInput}
                onChangeText={flow.setNameInput}
                autoComplete="name"
                error={problemText}
                onSubmitEditing={() => void flow.submitName()}
                testID="name-input"
              />
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
          ) : null}
        </View>
      </Card>
    </ScreenFrame>
  );
}
