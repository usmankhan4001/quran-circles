import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connectivity } from '../core/connectivity';
import { browserNetworkStatus, deviceNetworkStatus } from './networkStatus';

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
}

afterEach(() => {
  setNavigatorOnline(true);
});

describe('the browser connection state', () => {
  it('reads navigator.onLine', () => {
    const target = {
      navigator: { onLine: false },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    expect(browserNetworkStatus(target).isOnline()).toBe(false);
    target.navigator.onLine = true;
    expect(browserNetworkStatus(target).isOnline()).toBe(true);
  });

  it('treats a browser without navigator.onLine as online', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    expect(browserNetworkStatus(target).isOnline()).toBe(true);
  });

  it('reports the online and offline events and removes its listeners when stopped', () => {
    setNavigatorOnline(true);
    const source = browserNetworkStatus(window);
    const seen: boolean[] = [];
    const stop = source.subscribe((online) => seen.push(online));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(seen).toEqual([false, true]);
    stop();
    window.dispatchEvent(new Event('offline'));
    expect(seen).toEqual([false, true]);
  });

  it('is what the web target uses for the device', () => {
    setNavigatorOnline(false);
    const source = deviceNetworkStatus();
    expect(source).not.toBeNull();
    expect(source?.isOnline()).toBe(false);
  });

  it('drives the offline state from the window events', () => {
    setNavigatorOnline(true);
    const connectivity = new Connectivity();
    const stop = connectivity.watch(browserNetworkStatus(window));
    expect(connectivity.isOffline()).toBe(false);
    window.dispatchEvent(new Event('offline'));
    expect(connectivity.isOffline()).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(connectivity.isOffline()).toBe(false);
    stop();
  });
});
