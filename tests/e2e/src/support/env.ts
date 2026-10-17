import type { StackInfo } from '../stack/stack';

/** The running stack, as global setup described it. */
export function stack(): StackInfo {
  const raw = process.env.E2E_STACK;
  if (!raw) throw new Error('E2E_STACK is not set: run through `pnpm --filter @qc/e2e test`');
  return JSON.parse(raw) as StackInfo;
}
