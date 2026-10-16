/**
 * The small storage interface every persisted thing in the app is written against. Real
 * implementations live in `platform/`; tests and the first render use the in-memory one.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}

/** Reads JSON and returns `undefined` for a missing, unreadable or invalid value. */
export async function readJson<T>(
  store: KeyValueStore,
  key: string,
  guard: (value: unknown) => value is T,
): Promise<T | undefined> {
  try {
    const raw = await store.get(key);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  try {
    await store.set(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private browsing). The app still works without it.
  }
}
