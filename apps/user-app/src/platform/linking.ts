import { Linking, Platform } from 'react-native';

/** Opens a link outside the app: a phone call, a map address or a web page. */
export async function openExternalUrl(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (/^https?:/i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
    return;
  }
  await Linking.openURL(url);
}
