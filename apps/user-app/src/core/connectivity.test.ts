import { describe, expect, it, vi } from 'vitest';
import { FakeNetwork } from '../test/harness';
import { Connectivity } from './connectivity';

describe('Connectivity', () => {
  it('starts online', () => {
    expect(new Connectivity().isOffline()).toBe(false);
  });

  describe('the failed-call signal (the only one on native)', () => {
    it('goes offline when a call cannot reach the server and back after one that does', () => {
      const connectivity = new Connectivity();
      const listener = vi.fn();
      connectivity.subscribe(listener);
      connectivity.markOffline();
      expect(connectivity.isOffline()).toBe(true);
      connectivity.markOnline();
      expect(connectivity.isOffline()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("the platform's connection state", () => {
    it('is offline at once when the device starts with no connection', () => {
      const connectivity = new Connectivity();
      connectivity.watch(new FakeNetwork(false));
      expect(connectivity.isOffline()).toBe(true);
    });

    it('goes offline as soon as the device loses its connection, before any call fails', () => {
      const connectivity = new Connectivity();
      const network = new FakeNetwork(true);
      const listener = vi.fn();
      connectivity.watch(network);
      connectivity.subscribe(listener);
      expect(connectivity.isOffline()).toBe(false);
      network.set(false);
      expect(connectivity.isOffline()).toBe(true);
      expect(listener).toHaveBeenCalled();
      network.set(true);
      expect(connectivity.isOffline()).toBe(false);
    });

    it('stays offline while the device has no connection, even after a call got through', () => {
      const connectivity = new Connectivity();
      const network = new FakeNetwork(false);
      connectivity.watch(network);
      connectivity.markOnline();
      expect(connectivity.isOffline()).toBe(true);
    });

    it('clears a failed-call mark when the device comes back online', () => {
      const connectivity = new Connectivity();
      const network = new FakeNetwork(true);
      connectivity.watch(network);
      connectivity.markOffline();
      expect(connectivity.isOffline()).toBe(true);
      network.set(false);
      network.set(true);
      expect(connectivity.isOffline()).toBe(false);
    });

    it('still counts a failed call while the platform says it is online', () => {
      const connectivity = new Connectivity();
      connectivity.watch(new FakeNetwork(true));
      connectivity.markOffline();
      expect(connectivity.isOffline()).toBe(true);
    });

    it('stops following the platform when asked', () => {
      const connectivity = new Connectivity();
      const network = new FakeNetwork(true);
      const stop = connectivity.watch(network);
      expect(network.listenerCount).toBe(1);
      stop();
      expect(network.listenerCount).toBe(0);
      network.set(false);
      expect(connectivity.isOffline()).toBe(false);
    });
  });
});
