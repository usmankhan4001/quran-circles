import { useLocalSearchParams } from 'expo-router';
import { DailyAyahScreen } from '../features/daily-ayah/DailyAyahScreen';

export default function DailyAyahRoute() {
  const { venueId, circleId } = useLocalSearchParams<{ venueId?: string; circleId?: string }>();
  return <DailyAyahScreen venueId={venueId} circleId={circleId} />;
}
