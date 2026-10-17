import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Icon,
  ListItem,
  SegmentedControl,
  Switch,
  Text,
  TextField,
  textSizeSteps,
  radii,
  spacing,
  useTheme,
  type IconName,
  type TextSizeStep,
} from '@qc/ui';
import type { Locale } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { COLOR_PREFERENCES, type ColorPreference } from '../core/preferences';
import { errorMessageKey } from '../core/errors';
import { formatPhoneForDisplay } from '../core/phone';
import { useAction } from '../data/useAction';
import { deleteAccount, signOut } from '../features/auth/actions';
import { checkName } from '../features/auth/validation';
import { useMyFollows } from '../features/journey/hooks';
import {
  useAlertToggle,
  useLocaleSync,
  useProfileName,
  useWhatsappConsent,
} from '../features/profile/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.section,
  },
  stack: { gap: spacing.xl },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  grow: { flex: 1 },
  gap: { gap: spacing.md },
});

/** The quick tiles the profile opens with (B): the places a person comes here to reach. */
function QuickTiles() {
  const { t } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const tiles: { key: string; icon: IconName; label: string; onPress: () => void }[] = [
    {
      key: 'journey',
      icon: 'calendar',
      label: t('tabs.myJourney'),
      onPress: () => nav.tab({ name: 'journey' }),
    },
    {
      key: 'updates',
      icon: 'bell',
      label: t('updates.title'),
      onPress: () => nav.go({ name: 'updates' }),
    },
    {
      key: 'help',
      icon: 'people',
      label: t('profile.support.help'),
      onPress: () => nav.go({ name: 'page', slug: 'faq' }),
    },
  ];
  return (
    <View style={styles.tiles} testID="profile-tiles">
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          role="button"
          aria-label={tile.label}
          testID={`profile-tile-${tile.key}`}
          onPress={tile.onPress}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass },
          ]}
        >
          <Icon name={tile.icon} size={24} color={c.textOnHero} />
          <Text variant="caption" color="textOnHero" align="center" decorative>
            {tile.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProfileScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const { status } = useAuthState();

  return (
    <ScreenFrame
      title={t('profile.title')}
      onBack={() => nav.back()}
      hero={<QuickTiles />}
      testID="profile-screen"
    >
      <View style={styles.stack}>
        <AccountSection signedIn={status === 'signedIn'} />
        <PreferencesSections />
        {status === 'signedIn' ? <AlertsSections /> : null}
        <SupportSection />
      </View>
    </ScreenFrame>
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
      <Section title={t('profile.account.title')} card>
        <Text variant="body">{t('profile.account.signedOut')}</Text>
        <Button
          label={t('profile.account.signIn')}
          fullWidth
          onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'profile' } })}
          testID="profile-sign-in"
        />
      </Section>
    );
  }

  return (
    <Section title={t('profile.account.title')} testID="profile-account" card>
      <View style={styles.account}>
        <Avatar name={me?.displayName ?? t('profile.guestName')} size="lg" />
        <View style={styles.grow}>
          <Text variant="title3">{me?.displayName ?? t('profile.guestName')}</Text>
          {me ? (
            <Text variant="body" color="textSecondary" direction="ltr" testID="profile-phone">
              {formatPhoneForDisplay(me.phone)}
            </Text>
          ) : null}
        </View>
      </View>
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
      <Button
        variant="secondary"
        fullWidth
        label={t('profile.account.signOut')}
        loading={leave.running}
        onPress={() => void leave.run()}
        testID="profile-sign-out"
      />
      <Button
        variant="tertiary"
        fullWidth
        label={t('profile.account.delete')}
        onPress={() => setConfirmDelete(true)}
        testID="profile-delete"
      />
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
    </Section>
  );
}

function PreferencesSections() {
  const { t } = useI18n();
  const prefs = usePreferences();
  const syncLocale = useLocaleSync();

  return (
    <>
      <Section title={t('profile.language.title')} card>
        <SegmentedControl<Locale>
          accessibilityLabel={t('profile.language.title')}
          value={prefs.locale}
          onChange={(locale) => {
            void prefs.update({ locale });
            void syncLocale(locale);
          }}
          options={[
            { value: 'en', label: t('profile.language.en') },
            { value: 'ur', label: t('profile.language.ur') },
          ]}
          testID="profile-language"
        />
      </Section>

      <Section title={t('profile.textSize.title')} card>
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
      </Section>

      <Section title={t('profile.appearance.title')} card>
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
      </Section>
    </>
  );
}

function AlertsSections() {
  const { t, l, locale } = useI18n();
  const { push, api } = useServices();
  const toast = useToast();
  const follows = useMyFollows();
  const alerts = useAlertToggle();
  const whatsapp = useWhatsappConsent();
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
      <Section title={t('profile.notifications.title')} testID="profile-notifications" card>
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
      </Section>

      <Section title={t('profile.alerts.title')} testID="profile-alerts" card>
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
                        label={t('profile.alerts.venue', { name: l(follow.name).text })}
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
      </Section>
    </>
  );
}

function SupportSection() {
  const { t } = useI18n();
  const nav = useNav();
  const { appVersion } = useServices();
  return (
    <Section title={t('profile.support')} testID="profile-support" card>
      <View>
        <ListItem
          title={t('profile.support.help')}
          onPress={() => nav.go({ name: 'page', slug: 'faq' })}
          divider
          testID="profile-help"
        />
        <ListItem
          title={t('profile.about')}
          onPress={() => nav.go({ name: 'page', slug: 'about' })}
          divider
          testID="profile-about"
        />
        <ListItem
          title={t('credits.open')}
          onPress={() => nav.go({ name: 'credits' })}
          divider
          testID="profile-credits"
        />
      </View>
      <Text variant="caption" color="textSecondary" testID="profile-version">
        {t('profile.support.version', { version: appVersion })}
      </Text>
    </Section>
  );
}
