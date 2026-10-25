import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { issueMessageKey, type Registration, type Section, type Session } from '@qc/contracts';
import {
  Button,
  Checkbox,
  Chip,
  CodeField,
  Icon,
  QuranPortion,
  Text,
  TextField,
  radii,
  spacing,
  elevation,
  useTheme,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { Page } from '../components/Page';
import { QueryBoundary } from '../components/QueryBoundary';
import { errorMessageKey } from '../core/errors';
import { formatPhoneForDisplay, normalizePhone } from '../core/phone';
import { retryAfterText } from '../core/wait';
import { useSignIn } from '../features/auth/useSignIn';
import { splitClock } from '../features/home/clock';
import { describeWhenParts } from '../features/nearby/schedule';
import { useSession } from '../features/nearby/useSessions';
import { useAreas } from '../features/places/usePlaces';
import {
  allowedSections,
  isWaitlisted,
  validateRegistration,
  type RegistrationProblems,
} from '../features/registration/form';
import { useRegistration } from '../features/registration/useRegistration';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState } from '../providers/hooks';

const styles = StyleSheet.create({
  summary: { gap: spacing.lg },
  head: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  when: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  panel: {
    borderTopStartRadius: radii.sheet,
    borderTopEndRadius: radii.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.sm },
  areaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  grow: { flex: 1 },
  alert: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.control },
  center: { alignItems: 'center', gap: spacing.xs },
  tick: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { gap: spacing.xl, paddingTop: spacing.xxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

/**
 * Joining is a pledge, not a booking: no seat is reserved and no party size is asked. The page
 * shows the session; the pledge sheet sits under it. A signed-in person only picks a section
 * (when the session has more than one) and ticks the WhatsApp reminder. A first-time visitor also
 * gives a name, the WhatsApp number and the area, and checks the number with a code inside the
 * same sheet; the pledge is recorded as soon as the code is right. Sign in is never a separate
 * step the person is sent away to.
 */
export function RegistrationScreen({
  sessionId,
  occurrenceId,
}: {
  sessionId: string;
  occurrenceId?: string;
}) {
  const nav = useNav();
  const session = useSession(sessionId);
  return (
    <Page onBack={() => nav.back()} testID="registration-screen">
      <QueryBoundary query={session}>
        {(s) => <JoinBody session={s} {...(occurrenceId ? { occurrenceId } : {})} />}
      </QueryBoundary>
    </Page>
  );
}

function SessionSummary({ session }: { session: Session }) {
  const { t, l, locale } = useI18n();
  const c = useTheme().colors;
  const venue = l(session.venue.name);
  const when = describeWhenParts(session, t, locale, true);
  const clock = splitClock(when.time);
  const portion = session.nextOccurrence
    ? describePortion(session.nextOccurrence, t, locale)
    : null;
  return (
    <View style={styles.summary} testID="registration-summary">
      <View style={styles.head}>
        <Text variant="eyebrow" color="textAccent">
          {when.day}
        </Text>
        <Text variant="display" heading={1} lang={venue.lang}>
          {venue.text}
        </Text>
        <View style={styles.line}>
          <Icon name="pin" size={14} color={c.textMuted} />
          <Text variant="caption" color="textMuted">
            {l(session.title).text}
          </Text>
        </View>
      </View>
      <View style={styles.when}>
        <Text variant="countdown" lang="en" direction="ltr">
          {clock.clock}
        </Text>
        {clock.period ? (
          <Text variant="caption" color="textMuted">
            {clock.period}
          </Text>
        ) : null}
      </View>
      {portion ? <QuranPortion label={portion} /> : null}
      <View style={styles.detail}>
        <Icon name="people" size={18} color={c.textMuted} />
        <Text variant="body">{t(`sections.${session.section}`)}</Text>
      </View>
    </View>
  );
}

function JoinBody({ session, occurrenceId }: { session: Session; occurrenceId?: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const auth = useAuthState();
  const me = auth.me;
  const signedIn = auth.status === 'signedIn';
  const reg = useRegistration({
    session,
    ...(occurrenceId ? { occurrenceId } : {}),
    displayName: me?.displayName ?? null,
  });
  const signIn = useSignIn(() => void reg.submit(), { presetName: reg.form.name });
  const areas = useAreas(reg.form.cityId);
  const [showAreas, setShowAreas] = useState(false);
  const [local, setLocal] = useState<RegistrationProblems>({});

  if (reg.result) {
    return <JoinDone registration={reg.result} session={session} />;
  }

  const sections = allowedSections(session);
  const area = areas.data?.find((a) => a.id === reg.form.areaId);
  const when = describeWhenParts(session, t, locale, true);
  const problems = { ...reg.problems, ...local };
  const codeStep = !signedIn && signIn.step !== 'phone';

  const problemText =
    signIn.problem === 'invalid_phone'
      ? t('signIn.problem.phone')
      : signIn.problem === 'phone_not_pakistan_mobile'
        ? t(issueMessageKey('phone_not_pakistan_mobile'))
        : signIn.problem === 'invalid_code'
          ? t('signIn.problem.code')
          : signIn.error
            ? signIn.error.code === 'rate_limited' || signIn.error.code === 'otp_too_many_attempts'
              ? [
                  t(errorMessageKey(signIn.error.code)),
                  retryAfterText(t, signIn.error.retryAfterSeconds),
                ]
                  .filter(Boolean)
                  .join(' ')
              : t(errorMessageKey(signIn.error.code))
            : undefined;

  const send = async () => {
    if (signedIn) {
      await reg.submit();
      return;
    }
    const found = validateRegistration(reg.form, { needsName: true, session });
    setLocal(found);
    if (Object.keys(found).length > 0) return;
    await signIn.submitPhone();
  };

  const failure = reg.error;
  const panelLook = {
    backgroundColor: c.surface,
    borderColor: c.hairline,
    boxShadow: elevation.high,
  };

  return (
    <View testID="registration-form" style={{ gap: spacing.xl }}>
      <SessionSummary session={session} />
      <View style={[styles.panel, panelLook]} role="group" aria-label={t('registration.heading')}>
        <View style={[styles.grab, { backgroundColor: c.borderStrong }]} aria-hidden />
        {codeStep ? (
          <>
            <Text variant="title2" heading={2}>
              {t('join.code.title')}
            </Text>
            <Text variant="body" color="textMuted">
              {t(signIn.channel === 'sms' ? 'signUp.code.introSms' : 'signUp.code.intro', {
                phone: formatPhoneForDisplay(
                  normalizePhone(signIn.phoneInput) ?? signIn.phoneInput,
                ),
              })}
            </Text>
            <CodeField
              accessibilityLabel={t('signIn.code.label')}
              value={signIn.codeInput}
              onChangeText={signIn.setCodeInput}
              {...(problemText ? { error: problemText } : {})}
              testID="code-input"
            />
            {failure ? (
              <Text variant="body" color="textDanger" testID="registration-error">
                {t(errorMessageKey(failure.code))}
              </Text>
            ) : null}
            <View style={styles.center}>
              {signIn.resendIn > 0 ? (
                <Text variant="caption" color="textMuted">
                  {t('signIn.code.resendIn', { count: signIn.resendIn })}
                </Text>
              ) : (
                <>
                  <Button
                    variant="tertiary"
                    label={t('signIn.code.resend')}
                    onPress={() => void signIn.resend('whatsapp')}
                    testID="resend-code"
                  />
                  <Button
                    variant="tertiary"
                    label={t('signIn.code.useSms')}
                    onPress={() => void signIn.resend('sms')}
                    testID="resend-sms"
                  />
                </>
              )}
              <Button
                variant="tertiary"
                label={t('signIn.code.changeNumber')}
                onPress={signIn.changeNumber}
                testID="change-number"
              />
            </View>
            <Button
              label={t('registration.pledge')}
              size="large"
              fullWidth
              loading={signIn.working || reg.submitting}
              onPress={() => void signIn.submitCode()}
              testID="verify-code"
            />
          </>
        ) : (
          <>
            <Text variant="title2" heading={2}>
              {t('join.title', { when: when.day, venue: l(session.venue.name).text })}
            </Text>
            <Text variant="body" color="textMuted">
              {t('join.noSeat')}
            </Text>

            {!signedIn ? (
              <>
                <TextField
                  label={t('signUp.name.label')}
                  value={reg.form.name}
                  onChangeText={(name) => reg.setForm({ name })}
                  autoComplete="name"
                  required
                  {...(problems.name ? { error: t(problems.name) } : {})}
                  testID="registration-name"
                />
                <TextField
                  label={t('signUp.phone.label')}
                  helper={t('join.firstTime')}
                  value={signIn.phoneInput}
                  onChangeText={signIn.setPhoneInput}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  contentDirection="ltr"
                  required
                  {...(problemText ? { error: problemText } : {})}
                  testID="phone-input"
                />
              </>
            ) : null}

            {!signedIn || !reg.form.areaId ? (
              <View style={styles.group}>
                <Text variant="label">{t('registration.area.label')}</Text>
                <Pressable
                  role="button"
                  aria-label={`${t('registration.area.label')}, ${area ? l(area.name).text : t('registration.area.placeholder')}`}
                  onPress={() => setShowAreas(true)}
                  testID="registration-area"
                  style={[
                    styles.areaBox,
                    {
                      borderColor: problems.area ? c.danger : c.borderStrong,
                      backgroundColor: c.surface,
                    },
                  ]}
                >
                  <Icon name="pin" size={20} color={c.textMuted} />
                  <View style={styles.grow}>
                    <Text variant="body" color={area ? 'text' : 'textMuted'}>
                      {area ? l(area.name).text : t('registration.area.placeholder')}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={c.textMuted} />
                </Pressable>
                {problems.area ? (
                  <Text variant="caption" color="textDanger" testID="registration-area-problem">
                    {t(problems.area)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {sections.length > 1 ? (
              <View style={styles.group}>
                <Text variant="label">{t('registration.section.label')}</Text>
                <View
                  style={styles.chips}
                  role="group"
                  aria-label={t('registration.section.label')}
                >
                  {sections.map((x: Section) => (
                    <Chip
                      key={x}
                      label={t(`sections.${x}`)}
                      selected={reg.form.section === x}
                      onPress={() => reg.setForm({ section: x })}
                      testID={`registration-section-${x}`}
                    />
                  ))}
                </View>
                {problems.section ? (
                  <Text variant="caption" color="textDanger">
                    {t(problems.section)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="body" color="textMuted" testID="registration-section-fixed">
                {t('registration.section.fixed', {
                  section: t(`sections.${sections[0] ?? 'family'}`),
                })}
              </Text>
            )}

            <Checkbox
              label={t('join.remind')}
              checked={reg.form.allowWhatsapp}
              onChange={(allowWhatsapp) => reg.setForm({ allowWhatsapp })}
              testID="registration-consent"
            />

            {failure && !reg.signInRequired ? (
              <View
                role="alert"
                testID="registration-error"
                style={[styles.alert, { backgroundColor: c.dangerSubtle }]}
              >
                <Text variant="body" color="textOnDangerSubtle" strong>
                  {t(errorMessageKey(failure.code))}
                </Text>
                {failure.code === 'already_registered' ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    label={t('registration.success.journey')}
                    onPress={() => nav.tab({ name: 'journey' })}
                  />
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Button
                label={t('registration.pledge')}
                size="large"
                fullWidth
                loading={reg.submitting || signIn.working}
                onPress={() => void send()}
                testID="registration-submit"
              />
              <Button
                variant="tertiary"
                label={t('join.notNow')}
                onPress={() => nav.back()}
                testID="registration-not-now"
              />
            </View>
          </>
        )}
      </View>
      <AreaPickerSheet
        visible={showAreas}
        onClose={() => setShowAreas(false)}
        cityId={reg.form.cityId}
        value={reg.form.areaId}
        onCityChange={(cityId) => reg.setForm({ cityId, areaId: null })}
        onChange={(areaId) => reg.setForm({ areaId })}
      />
    </View>
  );
}

function JoinDone({ registration, session }: { registration: Registration; session: Session }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const waitlisted = isWaitlisted(registration);
  const venue = l(session.venue.name);
  const when = describeWhenParts(session, t, locale, true);
  return (
    <View style={styles.done} testID="registration-confirmation">
      <View style={[styles.tick, { backgroundColor: c.accentSubtle }]}>
        <Icon name="check" size={36} color={c.textAccent} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="display" heading={1}>
          {waitlisted ? t('registration.waitlist.title') : t('join.done.title')}
        </Text>
        <Text variant="body" color="textMuted">
          {waitlisted ? t('registration.waitlist.body') : t('join.done.body')}
        </Text>
      </View>
      <View
        style={[
          styles.panel,
          { borderBottomWidth: 1, borderRadius: radii.card, borderColor: c.hairline },
        ]}
      >
        <Text variant="title3" lang={l(session.title).lang}>
          {l(session.title).text}
        </Text>
        <View style={styles.line}>
          <Icon name="pin" size={14} color={c.textMuted} />
          <Text variant="caption" color="textMuted" lang={venue.lang}>
            {venue.text}
          </Text>
        </View>
        <View style={styles.line}>
          <Icon name="clock" size={14} color={c.textMuted} />
          <Text variant="caption" color="textMuted">
            {`${when.day}, ${when.time}`}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Icon name="check" size={16} color={c.textAccent} />
          <Text variant="label" color="textAccent">
            {t('join.done.status', { section: t(`sections.${registration.section}`) })}
          </Text>
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button
          label={t('join.done.journey')}
          size="large"
          fullWidth
          onPress={() => nav.tab({ name: 'journey' })}
          testID="view-journey"
        />
        <Button
          variant="tertiary"
          label={t('join.done.done')}
          onPress={() => nav.replace({ name: 'session', sessionId: session.id })}
          testID="join-done"
        />
      </View>
    </View>
  );
}
