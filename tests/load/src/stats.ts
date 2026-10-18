/** Latency figures in milliseconds, nearest-rank percentiles (as k6 reports them). */
export interface Summary {
  count: number;
  min: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? 0;
}

export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, v) => sum + v, 0);
  const round = (v: number): number => Math.round(v * 10) / 10;
  return {
    count: sorted.length,
    min: round(sorted[0] ?? 0),
    mean: round(sorted.length ? total / sorted.length : 0),
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1] ?? 0),
  };
}

/** Per-operation recorder for the load runner. */
export class Recorder {
  readonly latencies = new Map<string, number[]>();
  readonly statuses = new Map<string, Map<string, number>>();

  record(op: string, ms: number, outcome: string): void {
    let list = this.latencies.get(op);
    if (!list) this.latencies.set(op, (list = []));
    list.push(ms);
    let counts = this.statuses.get(op);
    if (!counts) this.statuses.set(op, (counts = new Map()));
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }

  /** Every operation together. */
  all(): number[] {
    return [...this.latencies.values()].flat();
  }

  outcomes(op?: string): Record<string, number> {
    const out: Record<string, number> = {};
    const maps = op ? [this.statuses.get(op) ?? new Map<string, number>()] : this.statuses.values();
    for (const counts of maps) {
      for (const [k, v] of counts) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  }
}
