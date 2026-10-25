import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  CodeField,
  Icon,
  SegmentedControl,
  Tag,
  Text,
  TextField,
  Toast,
  spacing,
  useTheme,
} from '@qc/ui';
import { useAppearance, useT } from '../../appearance/AppearanceProvider';
import { useAuth } from '../../auth/AuthProvider';
import { Screen, ScreenFooter } from '../../components/Screen';
import type { MessageKey, Translator } from '../../i18n/translate';
import { formatPhoneDisplay } from '../../lib/phone';
import { waitOf } from '../../lib/wait';
import { useSignIn } from './useSignIn';

/**
 * The refusal, then how long to wait in words ("Please wait about 15 minutes."), never a raw
 * count of seconds. No usable wait from the server: the refusal alone.
 */
export function noticeText(t: Translator, notice: MessageKey, waitSeconds: number | null): string {
  const wait = waitOf(waitSeconds);
  return wait
    ? `${t(notice)} ${t.plural(`admin.signIn.wait.${wait.unit}`, wait.count)}`
    : t(notice);
}

/** Phone-code sign-in. Only numbers an admin has invited get any access after this step. */
export function SignInScreen() {
  const { t, n } = useT();
  const { locale, setLocale } = useAppearance();
  const { publicApi, completeSignIn } = useAuth();
  const s = useSignIn(publicApi, completeSignIn, { locale });
  const [started, setStarted] = useState(false);

  // First screen: what the app is for and that it is by invitation. Sign-in follows.
  if (!started && s.step === 'phone') {
    return <WelcomeScreen onStart={() => setStarted(true)} />;
  }

  return (
    <Screen title={t('app.name')} subtitle={t('admin.signIn.subtitle')} testID="sign-in">
      <SegmentedControl
        accessibilityLabel={t('admin.account.language')}
        value={locale}
        onChange={setLocale}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ur', label: 'اردو' },
        ]}
      />
      {s.notice ? (
        <Toast
          testID="sign-in-notice"
          kind="danger"
          durationMs={0}
          message={noticeText(t, s.notice, s.waitSeconds)}
        />
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <Text variant="title3" heading={2}>
          {s.step === 'phone' ? t('admin.signIn.heading') : t('admin.signIn.codeLabel')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {s.step === 'phone'
            ? t('admin.signIn.phoneHelper')
            : t('admin.signIn.codeHelper', {
                phone: s.phone ? formatPhoneDisplay(s.phone) : '',
              })}
        </Text>
      </View>
      {s.step === 'phone' ? (
        <View style={{ gap: spacing.lg }}>
          <TextField
            testID="sign-in-phone"
            label={t('admin.signIn.phoneLabel')}
            value={s.phoneInput}
            onChangeText={s.setPhoneInput}
            error={s.phoneError ? t(s.phoneError) : undefined}
            keyboardType="phone-pad"
            autoComplete="tel"
            contentDirection="ltr"
            required
            loading={s.busy}
            onSubmitEditing={() => void s.submitPhone()}
          />
          <ScreenFooter>
            <Button
              testID="sign-in-send-code"
              label={t('admin.signIn.sendCode')}
              size="large"
              fullWidth
              loading={s.busy}
              onPress={() => void s.submitPhone()}
            />
          </ScreenFooter>
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <CodeField
            testID="sign-in-code"
            accessibilityLabel={t('admin.signIn.codeLabel')}
            value={s.code}
            onChangeText={s.setCode}
            error={s.codeError ? t(s.codeError) : undefined}
          />
          <ScreenFooter>
            <Button
              testID="sign-in-verify"
              label={t('admin.signIn.verify')}
              size="large"
              fullWidth
              loading={s.busy}
              onPress={() => void s.submitCode()}
            />
          </ScreenFooter>
          <Button
            testID="sign-in-resend"
            label={
              s.resendIn > 0
                ? t('admin.signIn.resendIn', { seconds: n(s.resendIn) })
                : t('admin.signIn.resend')
            }
            variant="secondary"
            fullWidth
            disabled={s.resendIn > 0 || s.busy}
            onPress={() => void s.resend()}
          />
          <Button
            testID="sign-in-change-number"
            label={t('admin.signIn.changeNumber')}
            variant="tertiary"
            fullWidth
            disabled={s.busy}
            onPress={s.changeNumber}
          />
        </View>
      )}
      <Text variant="caption" color="textSecondary">
        {t('admin.signIn.inviteOnly')}
      </Text>
    </Screen>
  );
}

const featureRows = [
  { icon: 'calendar-check', n: 1 },
  { icon: 'megaphone', n: 2 },
  { icon: 'qr-code', n: 3 },
] as const;

/**
 * Before sign-in (design: Welcome, Features): one welcome screen with the big logo, "Sign in with
 * your phone", the invitation-only note and a "What can I do here?" link to the features list.
 */
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const { locale, setLocale } = useAppearance();
  const { colors } = useTheme();
  const [features, setFeatures] = useState(false);

  if (features) {
    return (
      <Screen
        variant="plain"
        testID="sign-in"
        onBack={() => setFeatures(false)}
        backLabel={t('admin.signIn.back')}
      >
        <View testID="features" style={{ gap: spacing.lg }}>
          <Text variant="title1" heading={1}>
            {t('admin.signIn.features.title')}
          </Text>
          {featureRows.map((row) => (
            <View
              key={row.n}
              style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: colors.accentSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={row.icon} color={colors.textAccent} size={26} />
              </View>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="body" strong heading={2}>
                  {t(`admin.signIn.features.${row.n}.title`)}
                </Text>
                <Text color="textSecondary">{t(`admin.signIn.features.${row.n}.body`)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button
          testID="features-sign-in"
          label={t('admin.signIn.welcome.start')}
          icon="phone-call"
          size="large"
          fullWidth
          onPress={onStart}
        />
      </Screen>
    );
  }

  return (
    <Screen variant="plain" testID="sign-in">
      <SegmentedControl
        accessibilityLabel={t('admin.account.language')}
        value={locale}
        onChange={setLocale}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ur', label: 'اردو' },
        ]}
      />
      <View
        testID="welcome"
        style={{ alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl }}
      >
        <View
          style={{
            width: 160,
            height: 160,
            borderRadius: 40,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="star" color={colors.textOnAccent} size={72} weight="fill" />
        </View>
        <Tag kind="gilt" label={t('admin.signIn.welcome.tag')} />
        <Text variant="title1" heading={1} align="center">
          {t('admin.signIn.welcome.title')}
        </Text>
        <Text color="textSecondary" align="center">
          {t('admin.signIn.welcome.tagline')}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button
          testID="welcome-sign-in"
          label={t('admin.signIn.welcome.start')}
          icon="phone-call"
          size="large"
          fullWidth
          onPress={onStart}
        />
        <Button
          testID="welcome-features"
          label={t('admin.signIn.welcome.features')}
          variant="tertiary"
          fullWidth
          onPress={() => setFeatures(true)}
        />
        <Text variant="caption" color="textSecondary" align="center">
          {t('admin.signIn.inviteOnly')}
        </Text>
      </View>
    </Screen>
  );
}

/** Shown to a verified number that holds no staff role. It has no access to anything. */
export function NotInvitedScreen() {
  const { t } = useT();
  const { signOut } = useAuth();
  return (
    <Screen title={t('admin.signIn.notInvitedTitle')} testID="not-invited">
      <Text>{t('admin.signIn.notInvitedBody')}</Text>
      <Button
        testID="not-invited-sign-out"
        label={t('admin.account.signOut')}
        variant="secondary"
        fullWidth
        onPress={() => void signOut()}
      />
    </Screen>
  );
}
