import { describe, expect, it } from 'vitest';
import { BusyError, Limiter } from './limiter';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('Limiter', () => {
  it('runs at most `concurrency` tasks at once and queues the next ones', async () => {
    const limiter = new Limiter(2, 5);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, deferred);
    const tasks = gates.map((gate) =>
      limiter.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
      }),
    );
    await Promise.resolve();
    expect(limiter.active).toBe(2);
    expect(limiter.queued).toBe(3);
    gates.forEach((g) => g.resolve());
    await Promise.all(tasks);
    expect(peak).toBe(2);
    expect(limiter.active).toBe(0);
    expect(limiter.queued).toBe(0);
  });

  it('refuses work at once when every slot and queue place is taken', async () => {
    const limiter = new Limiter(1, 1);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(async () => 'second');
    await expect(limiter.run(async () => 'third')).rejects.toBeInstanceOf(BusyError);
    gate.resolve();
    await first;
    await expect(second).resolves.toBe('second');
  });

  it('frees the slot when a task fails', async () => {
    const limiter = new Limiter(1, 0);
    await expect(limiter.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
    expect(limiter.active).toBe(0);
  });

  it('rejects a nonsensical configuration', () => {
    expect(() => new Limiter(0, 1)).toThrow(RangeError);
    expect(() => new Limiter(1, -1)).toThrow(RangeError);
  });
});
