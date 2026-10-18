import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, readlinkSync } from 'node:fs';

/**
 * CPU use of the processes a local run started, from /proc (Linux only): the API and the worker
 * (found by the port they listen on, so another stack on the same machine is never counted),
 * Postgres (the postmaster and its children) and the load generator itself. Figures are percent
 * of one CPU, averaged over the step.
 */
export interface CpuStats {
  api: number | null;
  worker: number | null;
  postgres: number | null;
  loadGenerator: number;
  cpus: number;
}

const TICKS = 100; // USER_HZ on Linux.

function ticksOf(pid: number): { ticks: number; ppid: number } | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    // The command name is in parentheses and may contain spaces: split after the last ')'.
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return { ppid: Number(rest[1]), ticks: Number(rest[11]) + Number(rest[12]) };
  } catch {
    return null;
  }
}

/** The socket inode listening on a TCP port, from /proc/net/tcp and tcp6 (state 0A is LISTEN). */
function listeningInode(port: number): string | null {
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      const local = cols[1];
      if (cols[3] === '0A' && local !== undefined && local.endsWith(`:${hexPort}`)) {
        return cols[9] ?? null;
      }
    }
  }
  return null;
}

/** The PID listening on a loopback TCP port: from `ss` when installed, otherwise from /proc. */
export function pidOnPort(port: number): number | null {
  try {
    const out = execFileSync('ss', ['-ltnpH', `sport = :${port}`], { encoding: 'utf8' });
    const match = /pid=(\d+)/.exec(out);
    if (match) return Number(match[1]);
  } catch {
    // Not installed: fall through to /proc.
  }
  const inode = listeningInode(port);
  if (!inode) return null;
  const target = `socket:[${inode}]`;
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      for (const fd of readdirSync(`/proc/${name}/fd`)) {
        if (readlinkSync(`/proc/${name}/fd/${fd}`) === target) return Number(name);
      }
    } catch {
      // Another user's process or one that just exited.
    }
  }
  return null;
}

function treeTicks(rootPid: number): number {
  let total = ticksOf(rootPid)?.ticks ?? 0;
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const t = ticksOf(Number(name));
    if (t && t.ppid === rootPid) total += t.ticks;
  }
  return total;
}

export class CpuSampler {
  private start: {
    at: number;
    api: number;
    worker: number;
    pg: number;
    self: NodeJS.CpuUsage;
  } | null = null;

  constructor(
    private readonly pids: { api: number | null; worker: number | null; postmaster: number | null },
  ) {}

  private read() {
    return {
      at: performance.now(),
      api: this.pids.api ? (ticksOf(this.pids.api)?.ticks ?? 0) : 0,
      worker: this.pids.worker ? (ticksOf(this.pids.worker)?.ticks ?? 0) : 0,
      pg: this.pids.postmaster ? treeTicks(this.pids.postmaster) : 0,
      self: process.cpuUsage(),
    };
  }

  begin(): void {
    this.start = this.read();
  }

  end(): CpuStats {
    const now = this.read();
    const start = this.start ?? now;
    const seconds = Math.max(0.001, (now.at - start.at) / 1000);
    const pct = (ticks: number): number => Math.round((ticks / TICKS / seconds) * 100);
    const self = process.cpuUsage(start.self);
    return {
      api: this.pids.api ? pct(now.api - start.api) : null,
      worker: this.pids.worker ? pct(now.worker - start.worker) : null,
      // Backends that exited during the step drop out of the sum, so this is a lower bound.
      postgres: this.pids.postmaster ? Math.max(0, pct(now.pg - start.pg)) : null,
      loadGenerator: Math.round(((self.user + self.system) / 1e6 / seconds) * 100),
      cpus: Number(execFileSync('nproc', { encoding: 'utf8' }).trim()),
    };
  }
}
