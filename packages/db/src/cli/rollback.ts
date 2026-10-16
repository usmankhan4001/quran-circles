import { migrateDown } from '../migrate';
import { parseRollbackArgs } from './args';
import { fail, withDatabase } from './connect';

try {
  const args = parseRollbackArgs(process.argv.slice(2));
  const undone = await withDatabase((db) =>
    migrateDown(db, { ...args, log: (line) => console.log(line) }),
  );
  console.log(`done: ${undone.length} migration(s) rolled back`);
} catch (error) {
  fail(error);
}
