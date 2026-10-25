import { useLocalSearchParams } from 'expo-router';
import { SignUpScreen } from '../screens/SignUpScreen';

export default function SignUpRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  return <SignUpScreen {...(returnTo ? { returnTo } : {})} />;
}
