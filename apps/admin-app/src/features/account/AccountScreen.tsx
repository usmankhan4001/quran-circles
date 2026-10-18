import { useState } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Select,
  SegmentedControl,
  Text,
  Toast,
  spacing,
  useTheme,
  type TextSizeStep,
} from '@qc/ui';
import {
  colorChoices,
  useAppearance,
  useT,
  type ColorChoice,
} from '../../appearance/AppearanceProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/NavigationContext';
import { Screen } from '../../components/Screen';
import { ScopeSwitcher } from '../../components/ScopeSwitcher';
import { isolate } from '@qc/ui';

/** Who is signed in, which role they are working as, and the display choices. */
export function AccountScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const { me, signOut } = useAuth();
  const nav = useNavigation();
  const { locale, setLocale, textSize, setTextSize, colorChoice, setColorChoice } = useAppearance();
  const sizes: TextSizeStep[] = [0, 1, 2, 3];
  // The web downloads the other language's words on a switch; offline, nothing changes.
  const [languageFailed, setLanguageFailed] = useState(false);
  return (
    <Screen title={t('admin.account.title')} onBack={nav.back} testID="account">
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            borderStartWidth: 3,
            borderStartColor: colors.accent,
            paddingStart: spacing.sm,
          }}
        >
          <Avatar name={me?.displayName ?? t('admin.account.noName')} size="lg" />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="caption" color="textSecondary">
              {t('admin.account.signedInAs')}
            </Text>
            <Text variant="label">
              {me?.displayName ? isolate(me.displayName) : t('admin.account.noName')}
            </Text>
          </View>
        </View>
      </Card>
      <Text variant="title3" heading={2}>
        {t('admin.account.lookAfter')}
      </Text>
      <ScopeSwitcher />
      <Text variant="title3" heading={2}>
        {t('admin.account.display')}
      </Text>
      <SegmentedControl
        accessibilityLabel={t('admin.account.language')}
        value={locale}
        onChange={(next) => {
          setLanguageFailed(false);
          setLocale(next).catch(() => setLanguageFailed(true));
        }}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ur', label: 'اردو' },
        ]}
      />
      {languageFailed ? (
        <Toast
          testID="account-language-failed"
          kind="warning"
          durationMs={0}
          message={t('ui.offlineBody')}
          onDismiss={() => setLanguageFailed(false)}
          dismissLabel={t('ui.dismiss')}
        />
      ) : null}
      <SegmentedControl
        accessibilityLabel={t('admin.account.textSize')}
        value={String(textSize)}
        onChange={(v) => setTextSize(Number(v) as TextSizeStep)}
        options={sizes.map((s) => ({ value: String(s), label: t(`admin.account.size.${s}`) }))}
      />
      <Select
        testID="account-color"
        label={t('admin.account.colors')}
        required
        value={colorChoice}
        onChange={(c: ColorChoice) => setColorChoice(c)}
        options={colorChoices.map((c) => ({ value: c, label: t(`admin.account.color.${c}`) }))}
      />
      <Button
        testID="account-sign-out"
        label={t('admin.account.signOut')}
        variant="outline"
        fullWidth
        onPress={() => void signOut()}
      />
    </Screen>
  );
}
