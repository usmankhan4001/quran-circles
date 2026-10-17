import { startStack } from './stack';

/**
 * `pnpm --filter @qc/e2e stack`: starts the same stack the tests use and keeps it running until
 * Ctrl-C. Then run tests against it with `E2E_REUSE_STACK=1 pnpm --filter @qc/e2e test`.
 */
const stack = await startStack({ writeStackFile: true });
console.log(JSON.stringify(stack.info, null, 2));
console.log('Stack running. Ctrl-C to stop.');
const shutdown = (): void => {
  stack.stop().then(
    () => process.exit(0),
    () => process.exit(1),
  );
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
