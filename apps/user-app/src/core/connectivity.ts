import { Observable } from './observable';

/** The platform's own idea of whether the device has a network connection. */
export interface NetworkStatusSource {
  /** True unless the platform knows the device has no connection. */
  isOnline(): boolean;
  /** Called with the new state each time the platform reports a change. Returns an unsubscribe. */
  subscribe(listener: (online: boolean) => void): () => void;
}

/**
 * Whether the app should say it is offline. Two signals feed it:
 *
 * - the platform's connection state, where there is one (the browser's `navigator.onLine` and
 *   its `online`/`offline` events on the web target); it shows the banner as soon as the device
 *   loses its connection, before any call fails, and clears it when the connection returns;
 * - the last call to the server: a call that could not reach it marks the app offline, and one
 *   that reaches it clears that mark. On native, which has no network-status module, this is
 *   the only signal.
 */
export class Connectivity {
  private readonly deviceOffline = new Observable(false);
  private readonly requestOffline = new Observable(false);

  isOffline = (): boolean => this.deviceOffline.get() || this.requestOffline.get();

  subscribe = (listener: () => void): (() => void) => {
    const offDevice = this.deviceOffline.subscribe(listener);
    const offRequest = this.requestOffline.subscribe(listener);
    return () => {
      offDevice();
      offRequest();
    };
  };

  /** A call could not reach the server. */
  markOffline(): void {
    this.requestOffline.set(true);
  }

  /** A call reached the server. */
  markOnline(): void {
    this.requestOffline.set(false);
  }

  /**
   * Follows the platform's connection state from now on. Going offline shows the banner at
   * once; coming back online clears it, including a mark left by an earlier failed call (the
   * next call that fails sets it again). Returns a function that stops following.
   */
  watch(source: NetworkStatusSource): () => void {
    const apply = (online: boolean) => {
      if (online) this.requestOffline.set(false);
      this.deviceOffline.set(!online);
    };
    apply(source.isOnline());
    return source.subscribe(apply);
  }
}
