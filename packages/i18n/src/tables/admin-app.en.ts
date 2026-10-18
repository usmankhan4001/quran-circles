// English for the coordinator app: the shared part and its own, as one table. The app loads it on demand
// and hands it to `installMessages` (`@qc/i18n/client`); its bundler puts it in a file of its own.
import shared from '../en/shared.json';
import own from '../en/admin-app.json';

const table: Readonly<Record<string, string>> = { ...shared, ...own };
export default table;
