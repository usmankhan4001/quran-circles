/**
 * The daily occurrence top-up lives in `@qc/db` so the worker, which runs it every day, can import
 * it. The API keeps this re-export for its own callers and tests.
 */
export { topUpAllOccurrences, type TopUpSummary } from '@qc/db';
