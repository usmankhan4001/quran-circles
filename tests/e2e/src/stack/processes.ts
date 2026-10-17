import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

/** A free TCP port on the loopback interface. */
export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('no port'));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}

export interface Managed {
  name: string;
  child: ChildProcess;
  logFile: string;
  stop(): Promise<void>;
}

export interface StartOptions {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  /** Where `<name>.log` goes. */
  logDir?: string;
}

/**
 * Starts a long-running child in its own process group (so `tsx` and whatever it spawns stop
 * together) with output to `logs/<name>.log`. The logs hold what the services log; the services
 * promise never to log phone numbers, names or message bodies.
 */
export function startProcess(options: StartOptions): Managed {
  const logFile = join(options.logDir ?? '.', `${options.name}.log`);
  const log = createWriteStream(logFile, { flags: 'w' });
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: { ...cleanEnv(), ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  const stop = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
    const exited = new Promise<void>((done) => child.once('exit', () => done()));
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }, 10_000);
    await exited;
    clearTimeout(timer);
  };
  return { name: options.name, child, logFile, stop };
}

/** Runs a command to completion; rejects with the tail of its output when it fails. */
export function run(options: StartOptions & { timeoutMs?: number }): Promise<string> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...cleanEnv(), ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs ?? 300_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolveRun(output);
      else reject(new Error(`${options.name} failed (exit ${code}):\n${output.slice(-4000)}`));
    });
  });
}

/**
 * The parent environment without anything that would point a child at another database or turn
 * on live messaging by accident (a developer's own .env values, for example).
 */
function cleanEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const drop =
    /^(DATABASE_URL|APP_ENV|NODE_ENV|MESSAGING_MODE|CODE_DELIVERY_MODE|WHATSAPP_|FCM_|APNS_|VAPID_|SMS_|AUTH_|PORT$|CORS_ORIGINS|EXPO_PUBLIC_|VITE_|CONSOLE_API_PROXY_TARGET)/;
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !drop.test(key)) out[key] = value;
  }
  return out;
}

/** Polls `url` until it answers 2xx. */
export async function waitForHttp(url: string, timeoutMs: number, proc?: Managed): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    if (proc && proc.child.exitCode !== null) {
      throw new Error(
        `${proc.name} exited early (code ${proc.child.exitCode}); see ${proc.logFile}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`${url} did not come up in ${timeoutMs} ms (${last})`);
}
