import { useLocalSearchParams } from 'expo-router';
import { SignInScreen } from '../screens/SignInScreen';

export default function SignInRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  return <SignInScreen {...(returnTo ? { returnTo } : {})} />;
}
