import { useLocalSearchParams } from 'expo-router';
import { ScheduleScreen } from '../../../features/schedule/ScheduleScreen';

export default function ScheduleRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <ScheduleScreen sessionId={sessionId} />;
}
