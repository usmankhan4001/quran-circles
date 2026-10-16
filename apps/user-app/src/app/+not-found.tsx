import { Redirect } from 'expo-router';

/** An address the app does not know goes to Home rather than a dead end. */
export default function NotFound() {
  return <Redirect href="/home" />;
}
