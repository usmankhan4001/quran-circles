import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  ListItem,
  SegmentedControl,
  Select,
  Text,
  TextField,
  formatNumber,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Registration, Section, Session } from '@qc/contracts';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { QueryBoundary } from '../components/QueryBoundary';
import { ReminderToggle } from '../components/ReminderToggle';
import { ScreenFrame } from '../components/ScreenFrame';
import { errorMessageKey } from '../core/errors';
import { allowedSections, MAX_PARTY_SIZE, isWaitlisted } from '../features/registration/form';
import { useRegistration } from '../features/registration/useRegistration';
import { describeSchedule } from '../features/nearby/schedule';
import { useSession } from '../features/nearby/useSessions';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState } from '../providers/hooks';

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.md },
  actions: { gap: spacing.sm },
});

export function RegistrationScreen({
  sessionId,
  occurrenceId,
}: {
  sessionId: string;
  occurrenceId?: string;
}) {
  const { t, l } = useI18n();
  const nav = useNav();
  const auth = useAuthState();
  const session = useSession(sessionId);

  // Registering needs an account: browsing does not.
  useEffect(() => {
    if (auth.status === 'signedOut') {
      nav.replace({
        name: 'signIn',
        returnTo: { name: 'register', sessionId, ...(occurrenceId ? { occurrenceId } : {}) },
      });
    }
  }, [auth.status, nav, sessionId, occurrenceId]);

  return (
    <ScreenFrame
      title={session.data ? l(session.data.title).text : t('registration.title')}
      onBack={() => nav.back()}
      testID="registration-screen"
    >
      <QueryBoundary query={session}>
        {(s) =>
          auth.status === 'signedIn' ? (
            <RegistrationBody session={s} {...(occurrenceId ? { occurrenceId } : {})} />
          ) : null
        }
      </QueryBoundary>
    </ScreenFrame>
  );
}

function RegistrationBody({ session, occurrenceId }: { session: Session; occurrenceId?: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { me } = useAuthState();
  const flow = useRegistration({
    session,
    ...(occurrenceId ? { occurrenceId } : {}),
    displayName: me?.displayName ?? null,
  });
  const cities = useCities();
  const areas = useAreas(flow.form.cityId);
  const [showAreas, setShowAreas] = useState(false);

  useEffect(() => {
    if (flow.signInRequired) {
      nav.replace({
        name: 'signIn',
        returnTo: { name: 'register', sessionId: session.id },
      });
    }
  }, [flow.signInRequired, nav, session.id]);

  if (flow.result) {
    return <Confirmation registration={flow.result} session={session} />;
  }

  const waitlist = session.registration.enabled && session.registration.full;
  const sections = allowedSections(session);
  const area = areas.data?.find((a) => a.id === flow.form.areaId);
  const cityOptions = (cities.data ?? []).map((c) => ({ value: c.id, label: l(c.name).text }));
  const partyOptions = Array.from({ length: MAX_PARTY_SIZE }, (_, i) => ({
    value: String(i + 1),
    label: formatNumber(i + 1, locale),
  }));
  const failure = flow.error;

  return (
    <View style={styles.stack} testID="registration-form">
      <Text variant="bodyLarge">
        {waitlist ? t('registration.waitlistIntro') : t('registration.intro')}
      </Text>

      {flow.needsName ? (
        <TextField
          label={t('registration.name.label')}
          value={flow.form.name}
          onChangeText={(name) => flow.setForm({ name })}
          autoComplete="name"
          required
          {...(flow.problems.name ? { error: t(flow.problems.name) } : {})}
          testID="registration-name"
        />
      ) : null}

      <Select
        label={t('registration.city.label')}
        required
        options={cityOptions}
        value={flow.form.cityId ?? undefined}
        onChange={(cityId) => flow.setForm({ cityId, areaId: null })}
        testID="registration-city"
      />

      <View>
        <ListItem
          title={t('registration.area.label')}
          subtitle={area ? l(area.name).text : t('registration.area.placeholder')}
          onPress={() => setShowAreas(true)}
          testID="registration-area"
        />
        {flow.problems.area ? (
          <Text variant="caption" color="textDanger" testID="registration-area-problem">
            {t(flow.problems.area)}
          </Text>
        ) : null}
      </View>

      {sections.length > 1 ? (
        <View>
          <Text variant="label">{t('registration.section.label')}</Text>
          <SegmentedControl<Section>
            accessibilityLabel={t('registration.section.label')}
            value={flow.form.section ?? sections[0]!}
            onChange={(section) => flow.setForm({ section })}
            options={sections.map((s) => ({ value: s, label: t(`sections.${s}`) }))}
            testID="registration-section"
          />
          {flow.problems.section ? (
            <Text variant="caption" color="textDanger">
              {t(flow.problems.section)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="body" color="textSecondary" testID="registration-section-fixed">
          {t('registration.section.fixed', { section: t(`sections.${sections[0] ?? 'family'}`) })}
        </Text>
      )}

      <Select
        label={t('registration.partySize.label')}
        helper={t('registration.partySize.help')}
        required
        options={partyOptions}
        value={String(flow.form.partySize)}
        onChange={(value) => flow.setForm({ partySize: Number(value) })}
        testID="registration-party"
      />

      <Card variant="flat">
        <Checkbox
          label={t('registration.consent.whatsapp')}
          description={t('registration.consent.help')}
          checked={flow.form.allowWhatsapp}
          onChange={(allowWhatsapp) => flow.setForm({ allowWhatsapp })}
          testID="registration-consent"
        />
      </Card>

      {failure && !flow.signInRequired ? (
        <View role="alert" testID="registration-error" style={styles.actions}>
          <Text variant="body" color="textDanger" strong>
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

      <Button
        label={waitlist ? t('registration.submitWaitlist') : t('registration.submit')}
        size="large"
        fullWidth
        loading={flow.submitting}
        onPress={() => void flow.submit()}
        testID="registration-submit"
      />

      <AreaPickerSheet
        visible={showAreas}
        onClose={() => setShowAreas(false)}
        cityId={flow.form.cityId}
        value={flow.form.areaId}
        onChange={(areaId) => flow.setForm({ areaId })}
      />
    </View>
  );
}

function Confirmation({ registration, session }: { registration: Registration; session: Session }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const theme = useTheme();
  const waitlisted = isWaitlisted(registration);
  const venue = l(session.venue.name);
  return (
    <View style={styles.stack} testID="registration-confirmation">
      <View style={styles.center}>
        <Icon name="success" size={48} color={theme.colors.success} />
        <Text variant="title2" align="center" heading={2}>
          {waitlisted ? t('registration.waitlist.title') : t('registration.success.title')}
        </Text>
        {waitlisted && registration.waitlistPosition ? (
          <Text variant="bodyLarge" align="center" testID="waitlist-position">
            {t('registration.confirmation.position', {
              count: registration.waitlistPosition,
            })}
          </Text>
        ) : null}
        <Text variant="body" align="center" color="textSecondary">
          {waitlisted ? t('registration.waitlist.body') : t('registration.success.body')}
        </Text>
      </View>
      <Card variant="flat">
        <Text variant="label" lang={l(session.title).lang}>
          {l(session.title).text}
        </Text>
        <Text variant="body" lang={venue.lang}>
          {venue.text}
        </Text>
        <Text variant="body" color="textSecondary">
          {describeSchedule(session, t, locale)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('registration.confirmation.party', { count: registration.partySize })}
        </Text>
      </Card>
      {!waitlisted ? <ReminderToggle sessionId={session.id} registration={registration} /> : null}
      <View style={styles.actions}>
        <Button
          label={t('registration.success.journey')}
          size="large"
          fullWidth
          onPress={() => nav.tab({ name: 'journey' })}
          testID="view-journey"
        />
        <Button
          variant="tertiary"
          fullWidth
          label={t('registration.backToSession')}
          onPress={() => nav.replace({ name: 'session', sessionId: session.id })}
        />
      </View>
    </View>
  );
}
