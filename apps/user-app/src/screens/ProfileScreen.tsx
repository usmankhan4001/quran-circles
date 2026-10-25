import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Icon,
  ListItem,
  SectionHeader,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextField,
  minTouchTarget,
  textSizeSteps,
  spacing,
  useTheme,
  type IconName,
  type TextSizeStep,
} from '@qc/ui';
import { MEMORISATION_REVISE_AFTER_DAYS_DEFAULT, type Locale } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { QueryBoundary } from '../components/QueryBoundary';
import { Page } from '../components/Page';
import { COLOR_PREFERENCES, type ColorPreference } from '../core/preferences';
import { errorMessageKey } from '../core/errors';
import { formatPhoneForDisplay } from '../core/phone';
import { useAction } from '../data/useAction';
import { deleteAccount, signOut } from '../features/auth/actions';
import { checkName } from '../features/auth/validation';
import { useMyFollows } from '../features/journey/hooks';
import {
  useAlertToggle,
  useAyahNotification,
  useLocaleSync,
  useProfileName,
  useProfileSettings,
  useWhatsappConsent,
} from '../features/profile/hooks';
import { useFeature } from '../features/reading/hooks';
import {
  GOAL_PRESETS,
  REVISE_AFTER_PRESETS,
  goalFromValue,
  goalOptions,
  goalValue,
  reviseAfterOptions,
} from '../features/profile/readingSettings';
import { useI18n } from '../i18n/I18nProvider';
import { languages } from '../i18n/languages';
import { otherLocale, prefetchLanguage } from '../i18n/languageLoader';
import { useNav } from '../nav/NavProvider';
import { useAuthState, useAuthStatus, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';
import { ComingSoon } from '../ui/ComingSoon';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  group: { gap: spacing.xs },
  fields: { gap: spacing.md },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    borderBottomWidth: 1,
  },
  rowIcon: { width: 24, alignItems: 'center' },
  rowSwitch: { flex: 1 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.sm,
    borderBottomWidth: 1,
  },
  centre: { alignItems: 'center' },
});

/** A titled block of the profile: the small heading, then the controls with no frame around them. */
function Group({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.group} testID={testID}>
      <SectionHeader title={title} />
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

/** A row of a list: an icon, a title, what sits at the end, and a hairline under it. */
function LinkRow({
  icon,
  title,
  value,
  danger,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={value ? `${title}, ${value}` : title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.link,
        {
          borderBottomColor: c.hairline,
          backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        },
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={22} color={danger ? c.textDanger : c.textMuted} />
      </View>
      <View style={styles.grow}>
        <Text variant="label" color={danger ? 'textDanger' : 'text'} decorative>
          {title}
        </Text>
      </View>
      {value ? (
        <Text variant="caption" color="textSecondary" decorative>
          {value}
        </Text>
      ) : null}
      {danger ? null : <Icon name="chevron-forward" size={18} color={c.textMuted} />}
    </Pressable>
  );
}

export function ProfileScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();

  return (
    <Page barTitle={t('profile.title')} onBack={() => nav.back()} testID="profile-screen">
      <AccountSection signedIn={status === 'signedIn'} />
      <PreferencesSections />
      {status === 'signedIn' ? <AlertsSections /> : null}
      {status === 'signedIn' ? <ReadingSettingsSection /> : null}
      <SupportSection />
    </Page>
  );
}

function AccountSection({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const nav = useNav();
  const services = useServices();
  const toast = useToast();
  const { me } = useAuthState();
  const saveName = useProfileName();
  const [name, setName] = useState('');
  const [nameProblem, setNameProblem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (me?.displayName) setName(me.displayName);
  }, [me?.displayName]);

  const remove = useAction(async () => {
    await deleteAccount(services);
    setConfirmDelete(false);
    toast.show(t('profile.account.delete.done'), 'success');
    nav.tab({ name: 'home' });
  });

  const leave = useAction(async () => {
    await signOut(services);
    toast.show(t('profile.account.signOut.done'), 'info');
    nav.tab({ name: 'home' });
  });

  if (!signedIn) {
    return (
      <Group title={t('profile.account.title')}>
        <Text variant="body" color="textSecondary">
          {t('profile.account.signedOut')}
        </Text>
        <Button
          label={t('profile.account.signIn')}
          fullWidth
          onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'profile' } })}
          testID="profile-sign-in"
        />
      </Group>
    );
  }

  return (
    <View style={styles.stack} testID="profile-account">
      <View style={styles.account}>
        <Avatar name={me?.displayName ?? t('profile.guestName')} size="md" />
        <View style={styles.grow}>
          <Text variant="title3">{me?.displayName ?? t('profile.guestName')}</Text>
          {me ? (
            <Text variant="caption" color="textSecondary" direction="ltr" testID="profile-phone">
              {formatPhoneForDisplay(me.phone)}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.fields}>
        <TextField
          label={t('profile.name.label')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameProblem(false);
          }}
          {...(nameProblem ? { error: t('signIn.problem.name') } : {})}
          testID="profile-name"
        />
        <Button
          variant="secondary"
          fullWidth
          label={t('profile.save')}
          loading={saveName.running}
          onPress={async () => {
            const checked = checkName(name);
            if ('problem' in checked) {
              setNameProblem(true);
              return;
            }
            const saved = await saveName.run(checked.name);
            if (saved) toast.show(t('profile.saved'), 'success');
          }}
          testID="profile-name-save"
        />
      </View>
      <View>
        <ComingSoon
          label={t('profile.details.title')}
          role="button"
          testID="profile-details-soon"
        />
        <LinkRow
          icon="sign-out"
          title={t('profile.account.signOut')}
          onPress={() => void leave.run()}
          testID="profile-sign-out"
        />
        <LinkRow
          icon="trash"
          title={t('profile.account.delete')}
          danger
          onPress={() => setConfirmDelete(true)}
          testID="profile-delete"
        />
      </View>
      <ConfirmSheet
        visible={confirmDelete}
        title={t('profile.account.delete.title')}
        body={t('profile.account.delete.body')}
        confirmLabel={t('profile.account.delete.confirm')}
        cancelLabel={t('profile.account.delete.keep')}
        destructive
        busy={remove.running}
        {...(remove.error ? { errorText: t(errorMessageKey(remove.error.code)) } : {})}
        onConfirm={() => void remove.run()}
        onCancel={() => {
          remove.clearError();
          setConfirmDelete(false);
        }}
        testID="delete-sheet"
      />
    </View>
  );
}

function PreferencesSections() {
  const { t, locale: shown } = useI18n();
  const prefs = usePreferences();
  const syncLocale = useLocaleSync();
  const toast = useToast();

  // The web downloads one language's words at a time: fetch the other one now, since this is
  // where people switch.
  useEffect(() => prefetchLanguage(languages, otherLocale(shown)), [shown]);

  return (
    <>
      <Group title={t('profile.language.title')}>
        <SegmentedControl<Locale>
          accessibilityLabel={t('profile.language.title')}
          value={prefs.locale}
          onChange={(locale) => {
            // The words first, so the switch happens in one go. Without them (offline, before
            // the other language was ever downloaded) nothing changes and the person is told.
            languages.load(locale).then(
              () => {
                void prefs.update({ locale });
                void syncLocale(locale);
              },
              () => toast.show(t('ui.offlineBody'), 'warning'),
            );
          }}
          options={[
            { value: 'en', label: t('profile.language.en') },
            { value: 'ur', label: t('profile.language.ur') },
          ]}
          testID="profile-language"
        />
      </Group>

      <Group title={t('profile.textSize.title')}>
        <SegmentedControl<`${TextSizeStep}`>
          accessibilityLabel={t('profile.textSize.title')}
          value={`${prefs.textSize}`}
          onChange={(value) => void prefs.update({ textSize: Number(value) as TextSizeStep })}
          options={textSizeSteps.map((step) => ({
            value: `${step}` as `${TextSizeStep}`,
            label: t(`profile.textSize.step${step}`),
          }))}
          testID="profile-text-size"
        />
        <Text variant="body" color="textSecondary">
          {t('profile.textSize.sample')}
        </Text>
      </Group>

      <Group title={t('profile.appearance.title')}>
        <SegmentedControl<ColorPreference>
          accessibilityLabel={t('profile.appearance.title')}
          value={prefs.color}
          onChange={(color) => void prefs.update({ color })}
          options={COLOR_PREFERENCES.map((c) => ({
            value: c,
            label: t(`profile.appearance.${c}`),
          }))}
          testID="profile-appearance"
        />
      </Group>
    </>
  );
}

/**
 * Reading settings on the profile (rc.4): the optional daily goal (`reading_days`) and how long
 * before a memorised surah shows in "revise this week" (`memorisation`). Both live on the
 * profile, so they follow the account to a new phone.
 */
function ReadingSettingsSection() {
  const { t } = useI18n();
  const toast = useToast();
  const { me } = useAuthState();
  const goalFeature = useFeature('reading_days');
  const memorisationFeature = useFeature('memorisation');
  const save = useProfileSettings();
  if (!goalFeature.on && !memorisationFeature.on) return null;
  const goal = me?.profile.dailyGoal ?? null;
  const reviseAfter = me?.profile.memorisationReviseAfterDays ?? null;

  const apply = async (change: Parameters<typeof save.run>[0]) => {
    if (await save.run(change)) toast.show(t('profile.saved'), 'success');
  };

  return (
    <Group title={t('profile.reading.title')} testID="profile-reading">
      {goalFeature.on ? (
        <Select<string>
          label={t('profile.goal.label')}
          helper={t('profile.goal.helper')}
          value={goalValue(goal)}
          options={goalOptions(goal, GOAL_PRESETS, t)}
          disabled={save.running || !me}
          onChange={(value) => void apply({ dailyGoal: goalFromValue(value) })}
          testID="profile-goal"
        />
      ) : null}
      {memorisationFeature.on ? (
        <Select<string>
          label={t('profile.reviseAfter.label')}
          helper={t('profile.reviseAfter.helper')}
          value={`${reviseAfter ?? MEMORISATION_REVISE_AFTER_DAYS_DEFAULT}`}
          options={reviseAfterOptions(reviseAfter, REVISE_AFTER_PRESETS, t)}
          disabled={save.running || !me}
          onChange={(value) => {
            const days = Number(value);
            void apply({
              memorisationReviseAfterDays:
                days === MEMORISATION_REVISE_AFTER_DAYS_DEFAULT ? null : days,
            });
          }}
          testID="profile-revise-after"
        />
      ) : null}
      {save.error ? (
        <Text variant="caption" color="textDanger" testID="profile-reading-error">
          {t(errorMessageKey(save.error.code))}
        </Text>
      ) : null}
    </Group>
  );
}

function AlertsSections() {
  const { t, l, locale } = useI18n();
  const { push, api } = useServices();
  const toast = useToast();
  const follows = useMyFollows();
  const alerts = useAlertToggle();
  const whatsapp = useWhatsappConsent();
  const ayahFeature = useFeature('ayah_of_the_day');
  const ayahPush = useAyahNotification();
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void push.isEnabled().then((on) => {
      if (!cancelled) setPushOn(on);
    });
    return () => {
      cancelled = true;
    };
  }, [push]);

  const togglePush = useAction(async (enabled: boolean) => {
    if (enabled) {
      const result = await push.enable(api, locale);
      if (result !== 'granted') {
        toast.show(
          t(result === 'denied' ? 'profile.push.denied' : 'profile.push.unsupported'),
          'warning',
        );
        return;
      }
      setPushOn(true);
    } else {
      await push.disable(api);
      setPushOn(false);
    }
  });

  return (
    <>
      <Group title={t('profile.notifications.title')} testID="profile-notifications">
        <Switch
          label={t('profile.push.label')}
          description={
            push.supported ? t('profile.push.description') : t('profile.push.unsupported')
          }
          value={pushOn}
          disabled={!push.supported || togglePush.running}
          onValueChange={(value) => void togglePush.run(value)}
          testID="profile-push"
        />
        <Switch
          label={t('profile.whatsapp')}
          description={t('profile.whatsapp.description')}
          value={whatsapp.enabled}
          disabled={whatsapp.change.running || whatsapp.query.status !== 'success'}
          onValueChange={(value) => void whatsapp.change.run(value)}
          testID="profile-whatsapp"
        />
        {ayahFeature.on ? (
          <Switch
            label={t('profile.ayahPush.label')}
            description={t('profile.ayahPush.description')}
            value={ayahPush.enabled}
            disabled={ayahPush.change.running || ayahPush.query.status !== 'success'}
            onValueChange={(value) => void ayahPush.change.run(value)}
            testID="profile-ayah-push"
          />
        ) : null}
        {ayahPush.change.error ? (
          <Text variant="caption" color="textDanger" testID="profile-ayah-push-error">
            {t(errorMessageKey(ayahPush.change.error.code))}
          </Text>
        ) : null}
      </Group>

      <Group title={t('profile.alerts.title')} testID="profile-alerts">
        <QueryBoundary query={follows}>
          {(items) =>
            items.length === 0 ? (
              <Text variant="body" color="textSecondary">
                {t('profile.alerts.empty')}
              </Text>
            ) : (
              <View>
                {items.map((follow) => (
                  <ListItem
                    key={follow.id}
                    title={l(follow.name).text}
                    chevron={false}
                    divider
                    trailing={
                      <Switch
                        label={t('profile.alerts.venue', { venue: l(follow.name).text })}
                        value={follow.alertsEnabled}
                        onValueChange={(value) => void alerts.run(follow, value)}
                        testID={`alerts-${follow.id}`}
                      />
                    }
                  />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      </Group>
    </>
  );
}

function SupportSection() {
  const { t } = useI18n();
  const nav = useNav();
  const { appVersion } = useServices();
  return (
    <View testID="profile-support">
      <LinkRow
        icon="info"
        title={t('profile.support.help')}
        onPress={() => nav.go({ name: 'page', slug: 'faq' })}
        testID="profile-help"
      />
      <LinkRow
        icon="masjid"
        title={t('profile.about')}
        onPress={() => nav.go({ name: 'page', slug: 'about' })}
        testID="profile-about"
      />
      <LinkRow
        icon="star"
        title={t('credits.open')}
        onPress={() => nav.go({ name: 'credits' })}
        testID="profile-credits"
      />
      <View style={[styles.centre, { paddingTop: spacing.lg }]}>
        <Text variant="caption" color="textSecondary" testID="profile-version">
          {t('profile.support.version', { version: appVersion })}
        </Text>
      </View>
    </View>
  );
}
