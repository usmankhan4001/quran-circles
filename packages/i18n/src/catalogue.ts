// The message catalogue: English and Urdu, each in four parts by who shows the words.
//
// - `shared`: words every app shows (`app`, `ui`, `errors`, `issues`, `time`).
// - `user-app`: the user app, and the packages only it uses (`@qc/content`), plus the server's
//   own wording (`notifications`, `reminders`, `poster`, ...).
// - `admin-app`: the coordinator app (`admin.*`).
// - `console`: the national console (`console.*`).
//
// `partOf` is the rule; a test checks every key is in the part it names. Node (the API, the
// worker, the poster renderer, the console and every test) imports the whole catalogue from
// `index.ts`. An app bundle loads only its own parts, one language at a time (`client.ts`).
import enAdminApp from './en/admin-app.json';
import enConsole from './en/console.json';
import enShared from './en/shared.json';
import enUserApp from './en/user-app.json';
import urAdminApp from './ur/admin-app.json';
import urConsole from './ur/console.json';
import urShared from './ur/shared.json';
import urUserApp from './ur/user-app.json';

export const PARTS = ['shared', 'user-app', 'admin-app', 'console'] as const;
export type Part = (typeof PARTS)[number];

/** The namespaces in the `shared` part. */
export const SHARED_NAMESPACES = ['app', 'ui', 'errors', 'issues', 'time'] as const;

/** The part a key belongs in, by its namespace (the text before the first dot). */
export function partOf(key: string): Part {
  const namespace = key.split('.')[0] ?? '';
  if (namespace === 'console') return 'console';
  if (namespace === 'admin') return 'admin-app';
  if ((SHARED_NAMESPACES as readonly string[]).includes(namespace)) return 'shared';
  return 'user-app';
}

/** Each part in both languages, as written in `src/<language>/<part>.json`. */
export const parts = {
  shared: { en: enShared, ur: urShared },
  'user-app': { en: enUserApp, ur: urUserApp },
  'admin-app': { en: enAdminApp, ur: urAdminApp },
  console: { en: enConsole, ur: urConsole },
} as const;

const en = { ...enShared, ...enUserApp, ...enAdminApp, ...enConsole };
const ur = { ...urShared, ...urUserApp, ...urAdminApp, ...urConsole };

/** Every message, in both languages. Keys starting with `_` are notes, not messages. */
export const messages = { en, ur } as const;

type Keys<T> = Exclude<keyof T, `_${string}`>;
export type MessageKey = Keys<typeof en>;
export type SharedKey = Keys<typeof enShared>;
/** The keys the user app's table has: the shared part and its own. */
export type UserAppKey = SharedKey | Keys<typeof enUserApp>;
/** The keys the coordinator app's table has: the shared part and its own. */
export type AdminAppKey = SharedKey | Keys<typeof enAdminApp>;
export type ConsoleKey = Keys<typeof enConsole>;
