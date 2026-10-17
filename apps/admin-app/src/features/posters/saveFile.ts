import { Linking, Platform } from 'react-native';

/**
 * Where a poster file can go on this device. On the web target the browser saves it. A phone
 * build has no file saving yet (no file-system module is installed), so it opens a signed https
 * link when the API gives one, and otherwise says to download from the console.
 */
export type SaveRoute = 'browser' | 'link' | 'none';

export function saveRouteFor(fileUrl: string | null): SaveRoute {
  if (Platform.OS === 'web' && typeof document !== 'undefined') return 'browser';
  return fileUrl && /^https:\/\//.test(fileUrl) ? 'link' : 'none';
}

/** Hands the bytes to the browser's download. Nothing is kept or logged. */
export function saveInBrowser(filename: string, bytes: Uint8Array, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const openLink = (url: string): Promise<void> => Linking.openURL(url).then(() => undefined);
