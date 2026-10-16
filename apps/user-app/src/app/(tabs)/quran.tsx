import { useLocalSearchParams } from 'expo-router';
import { hrefToRoute, routeToHref } from '../../nav/routes';
import { QuranPrayerScreen } from '../../screens/QuranPrayerScreen';

export default function QuranTab() {
  const params = useLocalSearchParams<{ surah?: string; ayah?: string; at?: string }>();
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  ).toString();
  const route = hrefToRoute(query ? `/quran?${query}` : routeToHref({ name: 'quran' }));
  return (
    <QuranPrayerScreen
      {...(route?.name === 'quran' && route.reader ? { reader: route.reader } : {})}
    />
  );
}
