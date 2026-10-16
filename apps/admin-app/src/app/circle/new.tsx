import { useLocalSearchParams } from 'expo-router';
import { CircleEditorScreen } from '../../features/circles/CircleEditorScreen';

export default function NewCircleRoute() {
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  return <CircleEditorScreen venueId={venueId} />;
}
