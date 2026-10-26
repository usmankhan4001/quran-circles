import {
  assertBootstrapAllowed,
  bootstrapNationalAdmin,
  parseBootstrapArgs,
} from '../bootstrap-admin';
import { fail, loadDotEnv, withDrizzle } from './connect';

try {
  // Parse and load the repository's .env first, so a usage error or a production refusal never connects.
  const args = parseBootstrapArgs(process.argv.slice(2));
  loadDotEnv();
  assertBootstrapAllowed(process.env, args.yes);
  const result = await withDrizzle((db) =>
    bootstrapNationalAdmin(db, {
      phone: args.phone,
      ...(args.email ? { email: args.email } : {}),
      forceAdditional: args.forceAdditional,
      confirmProduction: args.yes,
    }),
  );
  // The invite id only: never the phone number.
  console.log(`invite ${result.inviteId}`);
  console.log(
    `done: pending national admin invite, expires ${result.expiresAt.toISOString()}. ` +
      'The person signs in with a code to accept it.',
  );
} catch (error) {
  fail(error);
}
