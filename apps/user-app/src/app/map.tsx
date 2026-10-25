import { useLocalSearchParams } from 'expo-router';
import { FullMapScreen } from '../screens/FullMapScreen';

export default function MapRoute() {
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  return <FullMapScreen {...(venueId ? { venueId: String(venueId) } : {})} />;
}
