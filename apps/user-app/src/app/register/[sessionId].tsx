import { useLocalSearchParams } from 'expo-router';
import { RegistrationScreen } from '../../screens/RegistrationScreen';

export default function RegisterRoute() {
  const { sessionId, occurrenceId } = useLocalSearchParams<{
    sessionId: string;
    occurrenceId?: string;
  }>();
  return (
    <RegistrationScreen
      sessionId={String(sessionId)}
      {...(occurrenceId ? { occurrenceId: String(occurrenceId) } : {})}
    />
  );
}
