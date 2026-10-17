import { assertSeedAllowed, seedDatabase } from '../seed';
import { parseSeedArgs } from './args';
import { fail, loadDotEnv, withDrizzle } from './connect';

try {
  // Load the repository's .env first so APP_ENV from there counts, and refuse before connecting to anything.
  loadDotEnv();
  assertSeedAllowed();
  const { anchor } = parseSeedArgs(process.argv.slice(2));
  const { tables } = await withDrizzle((db) => seedDatabase(db, anchor ? { anchor } : {}));
  for (const { table, inserted, total } of tables) {
    console.log(`${table.padEnd(18)} +${inserted} (${total} total)`);
  }
  console.log(
    anchor
      ? `dates: moved to the week of ${anchor.toISOString().slice(0, 10)}`
      : 'dates: fixture dates (February 2027)',
  );
  console.log(`done: ${tables.reduce((sum, t) => sum + t.inserted, 0)} row(s) added`);
} catch (error) {
  fail(error);
}
