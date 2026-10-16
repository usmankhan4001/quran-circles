import { useLocalSearchParams } from 'expo-router';
import { VenueEditorScreen } from '../../features/venues/VenueEditorScreen';

export default function VenueRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <VenueEditorScreen venueId={venueId} />;
}
