import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, screenGutter, spacing } from '@qc/ui';
import { useAuth } from '../auth/AuthProvider';
import { SessionDirectoryProvider } from '../features/home/sessionDirectory';
import { NotInvitedScreen, SignInScreen } from '../features/sign-in/SignInScreen';
import { isStaff } from '../scope/principal';
import { WorkingScopeProvider } from '../scope/WorkingScopeProvider';
import type { KeyValueStore } from '../storage/storage';

/**
 * The one place that decides what the person may see at all: nothing until the saved sign-in is
 * checked, the sign-in screen when signed out, a dead end for a number with no staff role, and
 * otherwise the app with the working scope and the session cache around it.
 */
export function AuthGate({
  prefsStore,
  children,
}: {
  prefsStore: KeyValueStore;
  children: ReactNode;
}) {
  const { status, me } = useAuth();
  if (status === 'restoring') {
    return (
      <View testID="auth-restoring" style={{ padding: screenGutter, gap: spacing.md }}>
        <Skeleton height={32} />
        <Skeleton height={96} />
      </View>
    );
  }
  if (status === 'signedOut' || !me) return <SignInScreen />;
  if (!isStaff(me)) return <NotInvitedScreen />;
  return (
    <WorkingScopeProvider store={prefsStore}>
      <SessionDirectoryProvider>{children}</SessionDirectoryProvider>
    </WorkingScopeProvider>
  );
}
