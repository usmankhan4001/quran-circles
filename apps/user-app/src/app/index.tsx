import { Redirect } from 'expo-router';
import { useAuthStatus, usePreferences } from '../providers/hooks';

/** A signed-out person who has not seen Welcome yet starts there; everyone else starts on Home. */
export default function Index() {
  const status = useAuthStatus();
  const { welcomed } = usePreferences();
  return <Redirect href={status === 'signedOut' && !welcomed ? '/welcome' : '/home'} />;
}
