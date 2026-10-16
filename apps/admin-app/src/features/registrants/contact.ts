import { Linking } from 'react-native';
import { contactUrl, type ContactKind } from '../../lib/phone';

export type ContactOpener = (kind: ContactKind, url: string) => void;

/**
 * Opens the phone dialler or WhatsApp for a number. Failure to open is not an error the person
 * can fix here (no WhatsApp installed, no dialler on a tablet), so it is swallowed. Nothing about
 * the number is logged.
 */
export const openContact: ContactOpener = (_kind, url) => {
  void Linking.openURL(url).catch(() => undefined);
};

export { contactUrl };
