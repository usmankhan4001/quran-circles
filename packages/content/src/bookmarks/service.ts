import { z } from 'zod';
import { BookmarkCreate, type BookmarkKind } from '@qc/contracts';
import { classifyFailure, createMutex, newLocalId, type GetContentApi } from '../account/api';
import type { AyahRef } from '../meta/ayah';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';

export type BookmarkInput = z.input<typeof BookmarkCreate>;

export interface BookmarkEntry {
  /** Stable on this device. For an item that came from the server, the server's id. */
  id: string;
  kind: BookmarkKind;
  surah: number | null;
  ayah: number | null;
  para: number | null;
  note: string | null;
  createdAt: string;
  /** True once the server has it. Always false while signed out. */
  synced: boolean;
}

interface StoredBookmark extends Omit<BookmarkEntry, 'synced'> {
  remoteId: string | null;
}

const KIND = z.enum(['ayah', 'surah', 'para']);
const StoredSchema = z.object({
  id: z.string(),
  remoteId: z.string().nullable(),
  kind: KIND,
  surah: z.number().int().nullable(),
  ayah: z.number().int().nullable(),
  para: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
const StateSchema = z.object({
  version: z.literal(1),
  items: z.array(StoredSchema),
  /** Server ids removed on the device that the server has not been told about yet. */
  pendingDeletes: z.array(z.string()),
});
type State = z.infer<typeof StateSchema>;

const STORAGE_KEY = 'qc.bookmarks.v1';
const IMPORT_CHUNK = 500;

export type SyncResult =
  { ok: true; imported: number } | { ok: false; reason: 'signed_out' | 'offline' | 'failed' };

export interface BookmarkService {
  /** What is on the device right now. Never touches the network. */
  list(): Promise<BookmarkEntry[]>;
  isBookmarked(ref: AyahRef): Promise<boolean>;
  add(input: BookmarkInput): Promise<BookmarkEntry>;
  remove(id: string): Promise<void>;
  /** Adds the ayah if it is not bookmarked, removes it if it is. Returns the new state. */
  toggleAyah(ref: AyahRef): Promise<boolean>;
  /**
   * Brings the device and the account in line: sends deletions and new items, then takes the
   * server's list. Does nothing while signed out. Call it after sign-in and when the app opens.
   */
  sync(): Promise<SyncResult>;
  /** Forget what belongs to the account on this device. Call it when the person signs out. */
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export interface BookmarkServiceOptions {
  storage: KeyValueStorage;
  getApi: GetContentApi;
  now?: () => Date;
  newId?: () => string;
}

const keyOf = (b: {
  kind: string;
  surah: number | null;
  ayah: number | null;
  para: number | null;
}) => `${b.kind}:${b.surah ?? ''}:${b.ayah ?? ''}:${b.para ?? ''}`;

const toEntry = (b: StoredBookmark): BookmarkEntry => ({
  id: b.id,
  kind: b.kind,
  surah: b.surah,
  ayah: b.ayah,
  para: b.para,
  note: b.note,
  createdAt: b.createdAt,
  synced: b.remoteId !== null,
});

/** The fields each kind needs. The contract allows nulls, but a bookmark with no target is useless. */
function validate(input: BookmarkInput): z.output<typeof BookmarkCreate> {
  const parsed = BookmarkCreate.parse(input);
  const ok =
    (parsed.kind === 'ayah' && parsed.surah !== undefined && parsed.ayah !== undefined) ||
    (parsed.kind === 'surah' && parsed.surah !== undefined) ||
    (parsed.kind === 'para' && parsed.para !== undefined);
  if (!ok) throw new RangeError(`A ${parsed.kind} bookmark is missing its target`);
  return parsed;
}

export function createBookmarkService(options: BookmarkServiceOptions): BookmarkService {
  const { storage, getApi } = options;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? newLocalId;
  const exclusive = createMutex();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const load = async (): Promise<State> =>
    (await readJson(storage, STORAGE_KEY, StateSchema)) ?? {
      version: 1,
      items: [],
      pendingDeletes: [],
    };

  /**
   * Reads the state, lets `change` edit it, and writes it back, one change at a time. Network
   * calls never run inside this, so a slow connection cannot hold up a tap on the bookmark icon.
   */
  const update = <T>(change: (state: State) => T): Promise<T> =>
    exclusive(async () => {
      const state = await load();
      const result = change(state);
      await writeJson(storage, STORAGE_KEY, state);
      return result;
    });

  /** Sends one new item to the server, when signed in. Failure leaves it for sync() to settle. */
  const push = async (item: StoredBookmark): Promise<void> => {
    const api = getApi();
    if (!api) return;
    let created: { id: string; createdAt: string };
    try {
      created = await api.bookmarks.create({
        body: {
          kind: item.kind,
          surah: item.surah ?? undefined,
          ayah: item.ayah ?? undefined,
          para: item.para ?? undefined,
          note: item.note ?? undefined,
        },
      });
    } catch {
      return;
    }
    await update((state) => {
      const target = state.items.find((i) => i.id === item.id);
      if (target) {
        target.remoteId = created.id;
        target.createdAt = created.createdAt;
      } else {
        // It was removed on the device while the request was on its way.
        state.pendingDeletes.push(created.id);
      }
    });
    notify();
  };

  /** Tells the server about deletions made on the device. Returns what it could not do. */
  const sendDeletes = async (
    api: NonNullable<ReturnType<GetContentApi>>,
    ids: readonly string[],
  ): Promise<{ done: Set<string>; stoppedBy: 'offline' | 'signed_out' | null }> => {
    const done = new Set<string>();
    for (const remoteId of ids) {
      try {
        await api.bookmarks.delete({ params: { bookmarkId: remoteId } });
        done.add(remoteId);
      } catch (error) {
        const kind = classifyFailure(error);
        if (kind === 'not_found') done.add(remoteId);
        else if (kind === 'signed_out') return { done, stoppedBy: 'signed_out' };
        else return { done, stoppedBy: 'offline' };
      }
    }
    return { done, stoppedBy: null };
  };

  const service: BookmarkService = {
    async list() {
      const state = await load();
      return state.items.map(toEntry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async isBookmarked(ref) {
      const wanted = keyOf({ kind: 'ayah', surah: ref.surah, ayah: ref.ayah, para: null });
      return (await service.list()).some((b) => keyOf(b) === wanted);
    },

    async add(input) {
      const parsed = validate(input);
      const candidate = {
        kind: parsed.kind,
        surah: parsed.surah ?? null,
        ayah: parsed.ayah ?? null,
        para: parsed.para ?? null,
      };
      const { item, isNew } = await update((state) => {
        const existing = state.items.find((i) => keyOf(i) === keyOf(candidate));
        if (existing) return { item: existing, isNew: false };
        const created: StoredBookmark = {
          id: newId(),
          remoteId: null,
          ...candidate,
          note: parsed.note ?? null,
          createdAt: now().toISOString(),
        };
        state.items.push(created);
        return { item: created, isNew: true };
      });
      if (isNew) {
        notify();
        await push(item);
      }
      const latest = (await load()).items.find((i) => i.id === item.id) ?? item;
      return toEntry(latest);
    },

    async remove(id) {
      const removed = await update((state) => {
        const item = state.items.find((i) => i.id === id);
        if (!item) return null;
        state.items = state.items.filter((i) => i.id !== id);
        if (item.remoteId) state.pendingDeletes.push(item.remoteId);
        return item;
      });
      if (!removed) return;
      notify();
      const api = getApi();
      if (removed.remoteId && api) {
        const { done } = await sendDeletes(api, [removed.remoteId]);
        if (done.size > 0) {
          await update((state) => {
            state.pendingDeletes = state.pendingDeletes.filter((d) => !done.has(d));
          });
        }
      }
    },

    async toggleAyah(ref) {
      const wanted = keyOf({ kind: 'ayah', surah: ref.surah, ayah: ref.ayah, para: null });
      const existing = (await service.list()).find((b) => keyOf(b) === wanted);
      if (existing) {
        await service.remove(existing.id);
        return false;
      }
      await service.add({ kind: 'ayah', surah: ref.surah, ayah: ref.ayah });
      return true;
    },

    async sync() {
      const api = getApi();
      if (!api) return { ok: false, reason: 'signed_out' };
      try {
        // 1. Tell the server about deletions made on the device.
        const before = await load();
        const deletes = await sendDeletes(api, before.pendingDeletes);
        const afterDeletes = await update((state) => {
          state.pendingDeletes = state.pendingDeletes.filter((d) => !deletes.done.has(d));
          return state.items.filter((i) => !i.remoteId).map((i) => ({ ...i }));
        });
        if (deletes.stoppedBy) return { ok: false, reason: deletes.stoppedBy };

        // 2. Send what the server does not have. The import endpoint is idempotent, so a retry
        //    after a dropped connection cannot double anything.
        let imported = 0;
        for (let at = 0; at < afterDeletes.length; at += IMPORT_CHUNK) {
          const result = await api.bookmarks.import({
            body: {
              items: afterDeletes.slice(at, at + IMPORT_CHUNK).map((i) => ({
                kind: i.kind,
                surah: i.surah ?? undefined,
                ayah: i.ayah ?? undefined,
                para: i.para ?? undefined,
                note: i.note ?? undefined,
              })),
            },
          });
          imported += result.imported;
        }

        // 3. Take the server's list as the truth about what exists there.
        const remote = (await api.bookmarks.list()).items;
        const sentKeys = new Set(afterDeletes.map(keyOf));
        await update((state) => {
          const removing = new Set(state.pendingDeletes);
          const remoteByKey = new Map(
            remote.filter((r) => !removing.has(r.id)).map((r) => [keyOf(r), r]),
          );
          const remoteIds = new Set(remote.map((r) => r.id));
          const merged: StoredBookmark[] = [];
          for (const item of state.items) {
            const match = remoteByKey.get(keyOf(item));
            if (match) {
              merged.push({
                ...item,
                remoteId: match.id,
                createdAt: match.createdAt,
                note: match.note ?? item.note,
              });
              remoteByKey.delete(keyOf(item));
            } else if (!item.remoteId || remoteIds.has(item.remoteId)) {
              // Either not sent yet (added while the sync ran), or still there.
              merged.push(item);
            }
            // Otherwise it had a server id that is gone: deleted on another device.
          }
          for (const r of remoteByKey.values()) {
            if (sentKeys.has(keyOf(r))) {
              // Sent in step 2 but removed on the device since: take it off the server too.
              state.pendingDeletes.push(r.id);
              continue;
            }
            merged.push({
              id: r.id,
              remoteId: r.id,
              kind: r.kind,
              surah: r.surah,
              ayah: r.ayah,
              para: r.para,
              note: r.note,
              createdAt: r.createdAt,
            });
          }
          state.items = merged;
        });
        notify();
        return { ok: true, imported };
      } catch (error) {
        const kind = classifyFailure(error);
        return {
          ok: false,
          reason: kind === 'signed_out' ? 'signed_out' : kind === 'offline' ? 'offline' : 'failed',
        };
      }
    },

    async signOut() {
      await update((state) => {
        state.items = state.items.filter((i) => !i.remoteId);
        state.pendingDeletes = [];
      });
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
