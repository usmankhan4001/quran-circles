/** A render could not start because every slot and every queue place is taken. */
export class BusyError extends Error {
  override name = 'BusyError';
}

/**
 * Runs at most `concurrency` tasks at once and lets at most `maxQueue` more wait. Anything beyond
 * that is refused at once with `BusyError`, so a burst cannot pile up unbounded work (and memory).
 */
export class Limiter {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    readonly concurrency: number,
    readonly maxQueue: number,
  ) {
    if (concurrency < 1) throw new RangeError('concurrency must be at least 1');
    if (maxQueue < 0) throw new RangeError('maxQueue must not be negative');
  }

  get active(): number {
    return this.running;
  }

  get queued(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      if (this.waiting.length >= this.maxQueue) throw new BusyError('renderer is busy');
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      // Hand the slot straight to the next waiter; otherwise free it.
      if (next) next();
      else this.running -= 1;
    }
  }
}
