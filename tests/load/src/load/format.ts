import type { LoadReport } from './run';

/** A plain-text summary of a load report: one block per step. */
export function formatLoad<T>(report: LoadReport<T>, dbLine?: (db: T) => string[]): string {
  const lines: string[] = [];
  for (const { step, push, db, thresholds, pass } of report.steps) {
    lines.push(
      `== ${step.vus} VUs, ${step.durationS} s: ${step.requests} requests (${step.rps}/s), ` +
        `${step.iterations} journeys, failed ${(step.failedRate * 100).toFixed(2)}%, ` +
        `429 ${(step.rateLimitedRate * 100).toFixed(2)}% -> ${pass ? 'PASS' : 'FAIL'}`,
    );
    lines.push(
      `   ${'op'.padEnd(20)}${['n', 'p50', 'p90', 'p95', 'p99', 'max'].map((h) => h.padStart(8)).join('')}  outcomes`,
    );
    for (const [op, s] of Object.entries(step.ops)) {
      const outcomes = Object.entries(s.outcomes)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      lines.push(
        `   ${op.padEnd(20)}${[s.count, s.p50, s.p90, s.p95, s.p99, s.max].map((v) => String(v).padStart(8)).join('')}  ${outcomes}`,
      );
    }
    const o = step.overall;
    lines.push(
      `   ${'all'.padEnd(20)}${[o.count, o.p50, o.p90, o.p95, o.p99, o.max].map((v) => String(v).padStart(8)).join('')}`,
    );
    if (push) {
      const f = push.final;
      lines.push(
        `   push burst: post ${push.postStatus} in ${push.postMs} ms, ${push.rowsQueued} rows for ${push.recipients} recipients; ` +
          `rows written ${push.pushesWrittenS ?? '-'} s, first sent ${push.firstSentS ?? '-'} s, all sent ${push.allSentS ?? 'timeout'} s (${push.drainPerSecond ?? '-'} /s); ` +
          `under load ${push.sentUnderLoad ?? '-'} sent (${push.underLoadPerSecond ?? '-'} /s)`,
      );
      lines.push(
        `   push outbox: queued=${f.queued} sending=${f.sending} sent=${f.sent} other=${f.other}` +
          (f.workerLost !== undefined ? ` worker_lost=${f.workerLost}` : '') +
          (f.maxAttempts !== undefined ? ` max_attempts=${f.maxAttempts}` : '') +
          (f.pushesPending ? ` pushes_pending=${f.pushesPending}` : ''),
      );
    }
    if (db && dbLine) lines.push(...dbLine(db).map((l) => `   ${l}`));
    const over = thresholds.filter((t) => !t.pass);
    if (over.length) {
      lines.push(
        `   over threshold: ${over.map((t) => `${t.name} ${t.actual} > ${t.limit}`).join('; ')}`,
      );
    }
  }
  return lines.join('\n');
}
