// Public API of @qc/i18n: every message in English and Urdu, loaded at once. The API, the worker,
// the poster renderer, the console and tests use this. The user and coordinator apps' web
// bundles load one language at a time through `@qc/i18n/client` instead (see client.ts).
export {
  messages,
  parts,
  partOf,
  PARTS,
  SHARED_NAMESPACES,
  type AdminAppKey,
  type ConsoleKey,
  type MessageKey,
  type Part,
  type SharedKey,
  type UserAppKey,
} from './catalogue';
export { TIME_PERIOD_KEYS, timePeriodKey, type TimePeriodKey } from './time';
