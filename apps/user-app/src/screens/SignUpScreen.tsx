import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { issueMessageKey, type Section } from '@qc/contracts';
import {
  Button,
  CodeField,
  Icon,
  SegmentedControl,
  Text,
  TextField,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { Page } from '../components/Page';
import { errorMessageKey } from '../core/errors';
import { retryAfterText } from '../core/wait';
import { checkName } from '../features/auth/validation';
import { useSignIn } from '../features/auth/useSignIn';
import { useAreas } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { hrefToRoute, type Route } from '../nav/routes';
import { usePreferences } from '../providers/hooks';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  intro: { gap: spacing.sm },
  areaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  areaText: { flex: 1 },
  group: { gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.xs },
});

const SIGN_UP_SECTIONS: readonly Section[] = ['men', 'women'];

/** Where to go after signing up: back to what the person was doing, or Home. */
export function routeAfterSignUp(returnTo: string | undefined): Route {
  return (returnTo ? hrefToRoute(returnTo) : null) ?? { name: 'home' };
}

/**
 * Two steps on one route. Step 1 asks for the name, the WhatsApp number, the area and the
 * section. Step 2, "Check your number", takes the code that was sent to that number; only then is
 * the account made. Area and section are kept on the device (preferences).
 */
export function SignUpScreen({ returnTo }: { returnTo?: string }) {
  const { t, l } = useI18n();
  const nav = useNav();
  const prefs = usePreferences();
  const c = useTheme().colors;
  const [name, setName] = useState('');
  const [section, setSection] = useState<Section | null>(prefs.section);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [missing, setMissing] = useState<'name' | 'area' | 'section' | null>(null);
  const areas = useAreas(prefs.cityId);
  const area = areas.data?.find((a) => a.id === prefs.areaId);

  const flow = useSignIn(() => nav.replace(routeAfterSignUp(returnTo)), {
    presetName: name,
    askPhone: true,
  });

  const submitDetails = async () => {
    setMissing(null);
    if (!('name' in checkName(name))) return setMissing('name');
    if (!prefs.areaId) return setMissing('area');
    if (!section) return setMissing('section');
    await prefs.update({ section });
    await flow.submitEmail();
  };

  const problemText =
    flow.problem === 'invalid_phone'
      ? t('signUp.problem.phone')
      : flow.problem === 'phone_in_use'
        ? t(issueMessageKey('phone_in_use'))
        : flow.problem === 'no_account'
          ? t(issueMessageKey('phone_required'))
          : flow.problem === 'invalid_code'
            ? t('signIn.problem.code')
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

  const emailProblem = flow.problem === 'invalid_email' ? t('signIn.problem.email') : undefined;
  const onCode = flow.step !== 'email';

  if (onCode) {
    return (
      <Page
        testID="sign-up-code-screen"
        barTitle={t('signUp.step', { step: 2 })}
        onBack={flow.changeEmail}
        footer={
          <Button
            label={t('signUp.code.submit')}
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
              {t('signUp.code.title')}
            </Text>
            <Text variant="body" color="textMuted">
              {t('signUp.code.intro', { email: flow.email ?? '' })}
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
                onPress={() => void flow.resend()}
                testID="resend-code"
              />
            )}
            <Button
              variant="tertiary"
              label={t('signIn.code.changeEmail')}
              onPress={flow.changeEmail}
              testID="change-email"
            />
          </View>
        </View>
      </Page>
    );
  }

  return (
    <Page
      testID="sign-up-screen"
      barTitle={t('signUp.step', { step: 1 })}
      onBack={() => nav.back()}
      footer={
        <>
          <Button
            label={t('signUp.submit')}
            icon="paper-plane-tilt"
            size="large"
            fullWidth
            loading={flow.working}
            onPress={() => void submitDetails()}
            testID="send-code"
          />
          <Text variant="caption" color="textMuted" align="center">
            {t('signUp.privacy')}
          </Text>
        </>
      }
    >
      <View style={styles.stack}>
        <View style={styles.intro}>
          <Text variant="display" heading={1}>
            {t('signUp.title')}
          </Text>
          <Text variant="body" color="textMuted">
            {t('signUp.intro')}
          </Text>
        </View>
        <TextField
          label={t('signUp.name.label')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          required
          error={missing === 'name' ? t('signIn.problem.name') : undefined}
          testID="name-input"
        />
        <TextField
          label={t('signUp.email.label')}
          helper={t('signUp.email.hint')}
          value={flow.emailInput}
          onChangeText={flow.setEmailInput}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          contentDirection="ltr"
          required
          error={emailProblem}
          testID="email-input"
        />
        <TextField
          label={t('signUp.phone.label')}
          helper={t('signUp.phone.hint')}
          value={flow.phoneInput}
          onChangeText={flow.setPhoneInput}
          keyboardType="phone-pad"
          autoComplete="tel"
          contentDirection="ltr"
          required
          error={problemText}
          testID="phone-input"
        />
        <View style={styles.group}>
          <Text variant="label">{t('signUp.area.label')}</Text>
          <Pressable
            role="button"
            aria-label={`${t('signUp.area.label')}: ${area ? l(area.name).text : t('signUp.area.choose')}`}
            onPress={() => setPickerOpen(true)}
            style={[
              styles.areaBox,
              {
                borderColor: missing === 'area' ? c.danger : c.borderStrong,
                backgroundColor: c.surface,
              },
            ]}
            testID="area-field"
          >
            <Icon name="pin" size={20} color={c.textMuted} />
            <View style={styles.areaText}>
              <Text variant="body" color={area ? 'text' : 'textMuted'}>
                {area ? l(area.name).text : t('signUp.area.choose')}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
          {missing === 'area' ? (
            <Text variant="caption" color="textDanger">
              {t('signUp.problem.area')}
            </Text>
          ) : null}
        </View>
        <View style={styles.group}>
          <Text variant="label">{t('signUp.section.label')}</Text>
          <SegmentedControl<Section>
            accessibilityLabel={t('signUp.section.label')}
            value={section ?? ('' as Section)}
            onChange={setSection}
            options={SIGN_UP_SECTIONS.map((s) => ({ value: s, label: t(`sections.${s}`) }))}
            testID="section-choice"
          />
          {missing === 'section' ? (
            <Text variant="caption" color="textDanger">
              {t('signUp.problem.section')}
            </Text>
          ) : null}
        </View>
      </View>
      <AreaPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        cityId={prefs.cityId}
        value={prefs.areaId}
        onCityChange={(cityId) => void prefs.update({ cityId, areaId: null })}
        onChange={(areaId) => void prefs.update({ areaId })}
      />
    </Page>
  );
}
