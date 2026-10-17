import { createHash } from 'node:crypto';

/** Bump when shared rendering changes (fonts, layout helpers, fit rules): old results go stale. */
export const RENDERER_VERSION = 1;

/** JSON with object keys sorted at every level, so equal values always hash the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const sha256 = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

export interface CacheKeyParts {
  templateId: string;
  templateVersion: number;
  format: string;
  language: string;
  fields: unknown;
  /** The whole source snapshot, including `sessionVersion`: a new session version is a new key. */
  session: unknown;
  deepLink: string;
}

/** The cache key of one rendered file. */
export function cacheKey(parts: CacheKeyParts): string {
  return sha256(canonicalJson({ renderer: RENDERER_VERSION, ...parts }));
}

export interface CachedFile {
  bytes: Buffer;
  contentType: string;
}

/** A least-recently-used cache with a byte budget. A budget of 0 turns caching off. */
export class MemoryCache {
  private readonly entries = new Map<string, CachedFile>();
  private bytes = 0;

  constructor(readonly maxBytes: number) {}

  get size(): number {
    return this.bytes;
  }

  get count(): number {
    return this.entries.size;
  }

  get(key: string): CachedFile | undefined {
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  set(key: string, file: CachedFile): void {
    if (file.bytes.length > this.maxBytes) return;
    const old = this.entries.get(key);
    if (old) {
      this.entries.delete(key);
      this.bytes -= old.bytes.length;
    }
    this.entries.set(key, file);
    this.bytes += file.bytes.length;
    for (const [k, v] of this.entries) {
      if (this.bytes <= this.maxBytes) break;
      this.entries.delete(k);
      this.bytes -= v.bytes.length;
    }
  }
}
