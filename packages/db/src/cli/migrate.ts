import { migrateUp } from '../migrate';
import { fail, withDatabase } from './connect';

try {
  const applied = await withDatabase((db) => migrateUp(db, { log: (line) => console.log(line) }));
  console.log(`done: ${applied.length} migration(s) applied`);
} catch (error) {
  fail(error);
}
