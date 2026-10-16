import { useLocalSearchParams } from 'expo-router';
import { OccurrenceScreen } from '../../../../../features/occurrence/OccurrenceScreen';

export default function OccurrenceRoute() {
  const { sessionId, occurrenceId } = useLocalSearchParams<{
    sessionId: string;
    occurrenceId: string;
  }>();
  return <OccurrenceScreen sessionId={sessionId} occurrenceId={occurrenceId} />;
}
