import { arg, checkTarget, required, writeReport } from '../args';
import { Synthetic, signIn, type Api } from '../people';
import { healthzProbe } from './push';
import { runEvening } from './run';
import { SCENARIO } from './scenario';
import { seedEvening } from './seed';

/**
 * `pnpm --filter @qc/load load --base-url <api> --worker-url <worker> --admin-phone <E.164>`
 *
 * The Node runner of the Ramadan-evening scenario against a running API (no k6 needed). Seeds
 * through the API, then runs the steps in `scenario.json` with a push burst in each step. Without
 * database access the push burst is measured through the worker's /healthz counts. For database
 * load, use `pnpm --filter @qc/load local` (local stack) or the database's own monitoring.
 */
const argv = process.argv.slice(2);
const baseUrl = required(arg(argv, 'base-url', 'QC_BASE_URL'), '--base-url (or QC_BASE_URL)');
checkTarget(baseUrl);
const workerUrl = arg(argv, 'worker-url', 'QC_WORKER_URL');
if (workerUrl) checkTarget(workerUrl);
const api: Api = {
  baseUrl,
  fixedCode: required(arg(argv, 'fixed-code', 'QC_FIXED_CODE'), '--fixed-code (or QC_FIXED_CODE)'),
  synthetic: new Synthetic('+92315'),
  options: { retry429: 4 },
};
const admin = await signIn(
  api,
  'national admin',
  required(arg(argv, 'admin-phone', 'QC_ADMIN_PHONE'), '--admin-phone (or QC_ADMIN_PHONE)'),
);
const log = (line: string): void => console.log(line);
const data = await seedEvening(api, admin, SCENARIO, log);
const report = await runEvening({
  api,
  admin,
  scenario: SCENARIO,
  data,
  probe: workerUrl ? healthzProbe(workerUrl) : null,
  log,
});
const file = writeReport(`load-${data.runTag}.json`, report);
console.log(`Report: ${file}`);
process.exitCode = report.steps.every((s) => s.pass) ? 0 : 1;
