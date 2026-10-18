// Urdu for the user app: the shared part and its own, as one table. The app loads it on demand
// and hands it to `installMessages` (`@qc/i18n/client`); its bundler puts it in a file of its own.
import shared from '../ur/shared.json';
import own from '../ur/user-app.json';

const table: Readonly<Record<string, string>> = { ...shared, ...own };
export default table;
