import { z } from 'zod';
import { classifyFailure, createMutex, type GetContentApi } from '../account/api';
import { isValidAyah } from '../meta/ayah';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';

export interface ReadingPositionValue {
  surah: number;
  ayah: number;
  /** When it was saved, as an ISO instant. The newer of device and account wins. */
  updatedAt: string;
}

const StoredSchema = z.object({
  surah: z.number().int(),
  ayah: z.number().int(),
  updatedAt: z.string(),
  /** True while the server has not been told about this position. */
  dirty: z.boolean(),
});
type Stored = z.infer<typeof StoredSchema>;
const KEY = 'qc.reading.position.v1';

export interface ReadingPositionService {
  /** The last position saved on this device. Never touches the network. */
  getLocal(): Promise<ReadingPositionValue | null>;
  /** Saves on the device at once, then tells the server when signed in. */
  save(surah: number, ayah: number): Promise<ReadingPositionValue>;
  /**
   * When signed in: sends a position the server has not seen, or takes the server's if it is
   * newer. Returns what the device holds afterwards.
   */
  sync(): Promise<ReadingPositionValue | null>;
  /** Forget the account's position. Call it when the person signs out. */
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export interface ReadingPositionOptions {
  storage: KeyValueStorage;
  getApi: GetContentApi;
  now?: () => Date;
}

const strip = (s: Stored): ReadingPositionValue => ({
  surah: s.surah,
  ayah: s.ayah,
  updatedAt: s.updatedAt,
});

export function createReadingPositionService(
  options: ReadingPositionOptions,
): ReadingPositionService {
  const { storage, getApi } = options;
  const now = options.now ?? (() => new Date());
  const exclusive = createMutex();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const read = async (): Promise<Stored | null> => {
    const stored = await readJson(storage, KEY, StoredSchema);
    return stored && isValidAyah(stored.surah, stored.ayah) ? stored : null;
  };

  const markSent = (sentAt: string) =>
    exclusive(async () => {
      const current = await read();
      // Only clear the flag if nothing newer was saved while the request was on its way.
      if (current && current.updatedAt === sentAt) {
        await writeJson(storage, KEY, { ...current, dirty: false });
      }
    });

  const send = async (value: Stored): Promise<boolean> => {
    const api = getApi();
    if (!api) return false;
    try {
      await api.readingPosition.put({ body: { surah: value.surah, ayah: value.ayah } });
      await markSent(value.updatedAt);
      return true;
    } catch {
      return false;
    }
  };

  const service: ReadingPositionService = {
    async getLocal() {
      const stored = await read();
      return stored ? strip(stored) : null;
    },

    async save(surah, ayah) {
      if (!isValidAyah(surah, ayah)) throw new RangeError(`There is no ayah ${surah}:${ayah}`);
      const value: Stored = { surah, ayah, updatedAt: now().toISOString(), dirty: true };
      await exclusive(() => writeJson(storage, KEY, value));
      notify();
      await send(value);
      return strip(value);
    },

    async sync() {
      const api = getApi();
      const local = await read();
      if (!api) return local ? strip(local) : null;

      if (local?.dirty) {
        // The device has a position the server has not seen. Compare before overwriting.
        let remote: { surah: number; ayah: number; updatedAt: string } | null = null;
        try {
          remote = await api.readingPosition.get();
        } catch (error) {
          if (classifyFailure(error) !== 'not_found') return strip(local);
        }
        if (!remote || remote.updatedAt <= local.updatedAt) {
          await send(local);
          return strip(local);
        }
      }

      try {
        const remote = await api.readingPosition.get();
        if (!local || remote.updatedAt > local.updatedAt) {
          const adopted: Stored = { ...remote, dirty: false };
          await exclusive(() => writeJson(storage, KEY, adopted));
          notify();
          return strip(adopted);
        }
        return strip(local);
      } catch {
        return local ? strip(local) : null;
      }
    },

    async signOut() {
      await exclusive(() => storage.removeItem(KEY).catch(() => undefined));
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return service;
}
