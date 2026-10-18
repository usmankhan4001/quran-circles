import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_PROCESSES_MAX,
  apiProcessesFromEnv,
  superviseWorkers,
  type WorkerHandle,
} from '../cluster';
import { createLogger } from '../middleware/logger';

/**
 * `API_PROCESSES` and the cluster primary (`cluster.ts`): the setting, the supervisor against a
 * fake cluster (restarts and their waits, start-up failure, shutdown), then real processes through
 * `fixtures/cluster-app.ts` (shared limits across two workers, a crash restarted, SIGTERM).
 */

describe('API_PROCESSES', () => {
  it('defaults to one process and takes 1 to 8', () => {
    expect(apiProcessesFromEnv({})).toBe(1);
    expect(apiProcessesFromEnv({ API_PROCESSES: '1' })).toBe(1);
    expect(apiProcessesFromEnv({ API_PROCESSES: '2' })).toBe(2);
    expect(apiProcessesFromEnv({ API_PROCESSES: ' 4 ' })).toBe(4);
    expect(apiProcessesFromEnv({ API_PROCESSES: String(API_PROCESSES_MAX) })).toBe(8);
  });

  it.each(['0', '9', '-1', '1.5', 'two', '', '2x'])(
    'refuses %j with a message that names the variable and not the value',
    (value) => {
      let message = '';
      try {
        apiProcessesFromEnv({ API_PROCESSES: value });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe('API_PROCESSES must be a whole number from 1 to 8');
    },
  );
});

class FakeWorker extends EventEmitter implements WorkerHandle {
  readonly signals: string[] = [];
  readonly sent: unknown[] = [];
  connected = true;
  readonly process: WorkerHandle['process'];
  constructor(readonly id: number) {
    super();
    this.process = {
      pid: 5000 + id,
      kill: (signal?: NodeJS.Signals) => {
        this.signals.push(signal ?? 'SIGTERM');
        return true;
      },
    };
  }
  send(message: unknown): boolean {
    this.sent.push(message);
    return true;
  }
  isConnected(): boolean {
    return this.connected;
  }
}

class FakeCluster extends EventEmitter {
  readonly workers: FakeWorker[] = [];
  fork(): FakeWorker {
    const worker = new FakeWorker(this.workers.length + 1);
    this.workers.push(worker);
    return worker;
  }
  listen(worker: FakeWorker): void {
    this.emit('listening', worker);
  }
  die(worker: FakeWorker, code: number | null, signal: string | null = null): void {
    this.emit('exit', worker, code, signal);
  }
}

function setup(processes = 2) {
  const cluster = new FakeCluster();
  const logs: string[] = [];
  const exit = vi.fn<(code: number) => void>();
  let clock = 0;
  const supervisor = superviseWorkers({
    cluster,
    processes,
    logger: createLogger((line) => logs.push(line), 'debug'),
    exit,
    now: () => clock,
    restartBaseMs: 1_000,
    restartMaxMs: 8_000,
    stableAfterMs: 60_000,
    shutdownTimeoutMs: 12_000,
  });
  return {
    cluster,
    supervisor,
    exit,
    logs,
    advance: async (ms: number) => {
      clock += ms;
      await vi.advanceTimersByTimeAsync(ms);
    },
  };
}

describe('the cluster supervisor', () => {
  afterEach(() => vi.useRealTimers());

  it('starts the configured number of workers and passes their messages on', () => {
    vi.useFakeTimers();
    const onMessage = vi.fn();
    const cluster = new FakeCluster();
    superviseWorkers({
      cluster,
      processes: 3,
      logger: createLogger(() => undefined),
      exit: () => undefined,
      onMessage,
    });
    expect(cluster.workers).toHaveLength(3);
    cluster.emit('message', cluster.workers[1], { type: 'qc:limit', id: 1 });
    expect(onMessage).toHaveBeenCalledWith(cluster.workers[1], { type: 'qc:limit', id: 1 });
    // A channel error on a worker is logged, not thrown at the primary.
    expect(() => cluster.workers[0]!.emit('error', new Error('EPIPE'))).not.toThrow();
  });

  it('restarts a worker that dies, waiting longer after each crash in a row, up to the maximum', async () => {
    vi.useFakeTimers();
    const { cluster, supervisor, exit, logs, advance } = setup(2);
    cluster.workers.forEach((w) => cluster.listen(w));
    expect(supervisor.running).toBe(2);

    const waits: number[] = [];
    let victim = cluster.workers[0]!;
    for (let i = 0; i < 5; i++) {
      const before = cluster.workers.length;
      cluster.die(victim, 1);
      expect(supervisor.running).toBe(1);
      const line = JSON.parse(logs.at(-1)!) as {
        msg: string;
        restartInMs: number;
        exitCode: number;
      };
      expect(line).toMatchObject({ msg: 'api process exited', exitCode: 1 });
      waits.push(line.restartInMs);
      await advance(line.restartInMs - 1);
      expect(cluster.workers).toHaveLength(before);
      await advance(1);
      expect(cluster.workers).toHaveLength(before + 1);
      victim = cluster.workers.at(-1)!;
      cluster.listen(victim);
      expect(supervisor.running).toBe(2);
    }
    expect(waits).toEqual([1_000, 2_000, 4_000, 8_000, 8_000]);

    // A worker that served for a minute before it died starts the waits again.
    await advance(60_000);
    cluster.die(victim, null, 'SIGKILL');
    const line = JSON.parse(logs.at(-1)!) as { restartInMs: number; signal: string };
    expect(line).toMatchObject({ restartInMs: 1_000, signal: 'SIGKILL' });
    expect(exit).not.toHaveBeenCalled();
    // Nothing personal in the logs: ids, pids, codes and waits only.
    expect(logs.join('\n')).not.toMatch(/\+92/);
  });

  it('treats a worker dying before any worker served as a start-up failure and exits 1', async () => {
    vi.useFakeTimers();
    const { cluster, exit, logs, advance } = setup(2);
    const [first, second] = cluster.workers as [FakeWorker, FakeWorker];
    cluster.die(first, 1);
    expect(logs.some((l) => l.includes('api process failed to start'))).toBe(true);
    // The other worker is asked to stop, and nothing is restarted.
    expect(second.signals).toEqual(['SIGTERM']);
    await advance(5_000);
    expect(cluster.workers).toHaveLength(2);
    expect(exit).not.toHaveBeenCalled();
    cluster.die(second, 0);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('on shutdown sends SIGTERM to every worker, restarts nothing and exits 0 once all stopped', async () => {
    vi.useFakeTimers();
    const { cluster, supervisor, exit, advance } = setup(2);
    cluster.workers.forEach((w) => cluster.listen(w));
    // One worker crashed and waits for its restart when the stop comes.
    cluster.die(cluster.workers[0]!, 1);
    supervisor.shutdown('SIGTERM');
    supervisor.shutdown('SIGINT');
    const alive = cluster.workers[1]!;
    // A signal, not worker.kill(): the IPC channel stays open while requests finish.
    expect(alive.signals).toEqual(['SIGTERM']);
    await advance(2_000);
    expect(cluster.workers).toHaveLength(2);
    expect(exit).not.toHaveBeenCalled();
    cluster.die(alive, 0);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    await advance(20_000);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('kills workers that do not stop in time and exits 1', async () => {
    vi.useFakeTimers();
    const { cluster, supervisor, exit, advance, logs } = setup(2);
    cluster.workers.forEach((w) => cluster.listen(w));
    supervisor.shutdown('SIGTERM');
    cluster.die(cluster.workers[0]!, 0);
    await advance(11_999);
    expect(exit).not.toHaveBeenCalled();
    await advance(1);
    expect(cluster.workers[1]!.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(logs.some((l) => l.includes('api processes did not stop in time'))).toBe(true);
    // The late exit event does not exit a second time.
    cluster.die(cluster.workers[1]!, null, 'SIGKILL');
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('ignores exit and listening events for workers it does not know', () => {
    vi.useFakeTimers();
    const { cluster, supervisor, exit } = setup(1);
    const stranger = new FakeWorker(99);
    cluster.listen(stranger);
    cluster.die(stranger, 1);
    expect(supervisor.running).toBe(1);
    expect(exit).not.toHaveBeenCalled();
  });
});

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cluster-app.ts');
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('real processes (node:cluster)', () => {
  let child: ChildProcess | null = null;
  afterEach(() => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    child = null;
  });

  it('shares limits across two workers, restarts a crashed one and stops cleanly on SIGTERM', async () => {
    const port = await freePort();
    child = spawn(process.execPath, ['--import', 'tsx', FIXTURE], {
      cwd: API_DIR,
      env: { ...process.env, PORT: String(port), API_PROCESSES: '2' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
    const exited = new Promise<number | null>((resolve) => child!.once('exit', (c) => resolve(c)));
    const base = `http://127.0.0.1:${port}`;
    const listening = () => (output.match(/"msg":"api process listening"/g) ?? []).length;

    const deadline = Date.now() + 30_000;
    while (listening() < 2 && Date.now() < deadline) await sleep(50);
    expect(listening()).toBe(2);

    // 60 calls at once over both workers: exactly the bucket's 25 get through.
    const hits = await Promise.all(Array.from({ length: 60 }, () => fetch(`${base}/hit`)));
    expect(hits.filter((r) => r.status === 200)).toHaveLength(25);
    expect(hits.filter((r) => r.status === 429)).toHaveLength(35);
    const pids = new Set(hits.map((r) => r.headers.get('x-pid')));
    expect(pids.size).toBe(2);

    // A worker dies; the primary starts another (pid we have not seen) and the bucket is intact.
    await fetch(`${base}/crash`);
    const restartDeadline = Date.now() + 15_000;
    while (listening() < 3 && Date.now() < restartDeadline) await sleep(50);
    expect(output).toMatch(/"msg":"api process exited".*"exitCode":3/);
    expect(listening()).toBe(3);
    const seen = new Set<string>();
    for (let i = 0; i < 20 && seen.size < 2; i++) {
      const r = await fetch(`${base}/hit`);
      expect(r.status).toBe(429);
      seen.add(r.headers.get('x-pid') ?? '');
    }
    expect([...seen].some((pid) => !pids.has(pid))).toBe(true);

    // SIGTERM: a request in flight still gets its answer, then everything exits 0.
    const slow = fetch(`${base}/slow`).then((r) => r.text());
    await sleep(100);
    child.kill('SIGTERM');
    expect(await slow).toBe('done');
    expect(await exited).toBe(0);
    expect(output).toMatch(/"msg":"api stopping","signal":"SIGTERM"/);
    expect(output.match(/"msg":"api process stopped"/g)).toHaveLength(2);
  }, 60_000);
});
