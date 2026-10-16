import { useLocalSearchParams } from 'expo-router';
import { CircleEditorScreen } from '../../features/circles/CircleEditorScreen';

export default function CircleRoute() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  return <CircleEditorScreen circleId={circleId} />;
}
