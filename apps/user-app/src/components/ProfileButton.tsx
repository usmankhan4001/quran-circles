import { Pressable, StyleSheet } from 'react-native';
import { Avatar, minTouchTarget } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState } from '../providers/hooks';

const styles = StyleSheet.create({
  button: { minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});

/**
 * The avatar at the top of every tab; it opens Profile.
 * TODO(ui lane): a pressable Avatar in the kit would replace this wrapper.
 */
export function ProfileButton() {
  const nav = useNav();
  const { t } = useI18n();
  const { me } = useAuthState();
  return (
    <Pressable
      role="button"
      aria-label={t('profile.open')}
      testID="profile-button"
      onPress={() => nav.go({ name: 'profile' })}
      style={styles.button}
    >
      <Avatar name={me?.displayName ?? t('profile.guestName')} size="sm" />
    </Pressable>
  );
}
