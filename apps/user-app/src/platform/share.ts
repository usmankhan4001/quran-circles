import { Share } from 'react-native';

/**
 * Opens the system share sheet with a line of text. On the web it uses the browser's share
 * where there is one. Resolves false when sharing is not possible here, so the screen can say
 * so; a person closing the sheet without sharing is not a failure.
 */
export async function shareText(message: string): Promise<boolean> {
  try {
    await Share.share({ message });
    return true;
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError';
  }
}
