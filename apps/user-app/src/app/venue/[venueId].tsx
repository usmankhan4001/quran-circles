import { useLocalSearchParams } from 'expo-router';
import { VenueScreen } from '../../screens/VenueScreen';

export default function VenueRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <VenueScreen venueId={String(venueId)} />;
}
