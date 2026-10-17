import { useLocalSearchParams } from 'expo-router';
import { PostersScreen } from '../../../features/posters/PostersScreen';

export default function PostersRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <PostersScreen sessionId={sessionId} />;
}
