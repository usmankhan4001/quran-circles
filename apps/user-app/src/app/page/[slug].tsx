import { useLocalSearchParams } from 'expo-router';
import { ContentPageScreen } from '../../screens/ContentPageScreen';

export default function PageRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ContentPageScreen slug={String(slug)} />;
}
