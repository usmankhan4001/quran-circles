import { useLocalSearchParams } from 'expo-router';
import { PostUpdateScreen } from '../features/post-update/PostUpdateScreen';

export default function PostUpdateRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  return <PostUpdateScreen sessionId={sessionId} />;
}
