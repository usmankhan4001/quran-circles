import { assertSeedAllowed, seedDatabase } from '../seed';
import { fail, loadDotEnv, withDrizzle } from './connect';

try {
  // Load v2/.env first so APP_ENV from there counts, and refuse before connecting to anything.
  loadDotEnv();
  assertSeedAllowed();
  const { tables } = await withDrizzle((db) => seedDatabase(db));
  for (const { table, inserted, total } of tables) {
    console.log(`${table.padEnd(18)} +${inserted} (${total} total)`);
  }
  console.log(`done: ${tables.reduce((sum, t) => sum + t.inserted, 0)} row(s) added`);
} catch (error) {
  fail(error);
}
