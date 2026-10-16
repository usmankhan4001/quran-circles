import { useLocalSearchParams } from 'expo-router';
import { AttendanceScreen } from '../../../../../features/attendance/AttendanceScreen';

export default function AttendanceRoute() {
  const { sessionId, occurrenceId } = useLocalSearchParams<{
    sessionId: string;
    occurrenceId: string;
  }>();
  return <AttendanceScreen sessionId={sessionId} occurrenceId={occurrenceId} />;
}
