import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeviceStore, createMemoryStore } from './storage';

describe('createMemoryStore', () => {
  it('keeps, reads and removes values', async () => {
    const store = createMemoryStore({ a: '1' });
    expect(await store.get('a')).toBe('1');
    expect(await store.get('b')).toBeNull();
    await store.set('b', '2');
    expect(await store.get('b')).toBe('2');
    await store.remove('a');
    expect(await store.get('a')).toBeNull();
  });
});

describe('createDeviceStore on the web', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('keeps sign-in values in the session by default', async () => {
    const store = createDeviceStore();
    await store.set('k', 'v');
    expect(window.sessionStorage.getItem('k')).toBe('v');
    expect(window.localStorage.getItem('k')).toBeNull();
    expect(await store.get('k')).toBe('v');
    await store.remove('k');
    expect(await store.get('k')).toBeNull();
  });

  it('keeps appearance values on the device when asked', async () => {
    const store = createDeviceStore('local');
    await store.set('k', 'v');
    expect(window.localStorage.getItem('k')).toBe('v');
  });

  it('behaves like an empty store when the browser refuses', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = createDeviceStore();
    await expect(store.set('k', 'v')).resolves.toBeUndefined();
    await expect(store.get('k')).resolves.toBeNull();
    await expect(store.remove('k')).resolves.toBeUndefined();
  });
});
