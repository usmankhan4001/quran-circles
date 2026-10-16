import { useLocalSearchParams } from 'expo-router';
import { RegistrantsScreen } from '../../../features/registrants/RegistrantsScreen';

export default function RegistrantsRoute() {
  const { sessionId, occurrenceId } = useLocalSearchParams<{
    sessionId: string;
    occurrenceId?: string;
  }>();
  return <RegistrantsScreen sessionId={sessionId} occurrenceId={occurrenceId} />;
}
