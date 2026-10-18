import { arg, checkTarget, required, writeReport } from '../args';
import { formatMatrix, runScope } from './run';

/**
 * `pnpm --filter @qc/load scope --base-url <url> --admin-phone <E.164>`
 *
 * Fires the generated scope matrix at a running API. Needs the API's test-mode sign-in code
 * (`--fixed-code`, or QC_FIXED_CODE) and a number with a pending national-admin invite
 * (`pnpm --filter @qc/db bootstrap-admin --phone <number>` on that database). Exits 1 on any
 * mismatch. `pnpm --filter @qc/load local` starts a local stack and does all of this for you.
 */
const argv = process.argv.slice(2);
const baseUrl = required(arg(argv, 'base-url', 'QC_BASE_URL'), '--base-url (or QC_BASE_URL)');
checkTarget(baseUrl);
const report = await runScope({
  baseUrl,
  fixedCode: required(arg(argv, 'fixed-code', 'QC_FIXED_CODE'), '--fixed-code (or QC_FIXED_CODE)'),
  adminPhone: required(
    arg(argv, 'admin-phone', 'QC_ADMIN_PHONE'),
    '--admin-phone (or QC_ADMIN_PHONE)',
  ),
  log: (line) => console.log(line),
});
console.log(`\n${formatMatrix(report)}\n`);
const file = writeReport(`scope-${report.runTag}.json`, report);
console.log(
  `${report.totals.calls} calls, ${report.totals.mismatches} mismatch(es), ` +
    `${report.tampered.length} tampered record(s), ${report.endpoints.covered}/${report.endpoints.total} endpoints. Report: ${file}`,
);
for (const m of report.mismatches)
  console.log(`MISMATCH ${m.scenario} as ${m.caller}: ${m.reason}`);
process.exitCode = report.totals.mismatches + report.tampered.length > 0 ? 1 : 0;
