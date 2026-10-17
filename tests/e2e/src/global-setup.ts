import type { FullConfig } from '@playwright/test';
import { exportStackEnv, readStackFile, startStack } from './stack/stack';

/**
 * Starts the whole stack once for the run and stops it afterwards (the returned function is the
 * teardown). With E2E_REUSE_STACK=1 it uses a stack already started by
 * `pnpm --filter @qc/e2e stack` instead, which is faster while writing tests.
 */
export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  if (process.env.E2E_REUSE_STACK === '1') {
    const info = readStackFile();
    if (!info)
      throw new Error(
        'E2E_REUSE_STACK=1 but no running stack; start `pnpm --filter @qc/e2e stack`',
      );
    const health = await fetch(`${info.apiUrl}/health`).catch(() => null);
    if (!health?.ok)
      throw new Error(`E2E_REUSE_STACK=1 but the API at ${info.apiUrl} is not answering`);
    exportStackEnv(info);
    return async () => {};
  }
  const stack = await startStack();
  exportStackEnv(stack.info);
  return stack.stop;
}
