import { Observable } from './observable';

/**
 * Whether the last call to the server reached it. The apps have no network-status module;
 * a failed call is the honest signal, and a good one clears it.
 */
export class Connectivity {
  private readonly offline = new Observable(false);

  isOffline = (): boolean => this.offline.get();
  subscribe = (listener: () => void): (() => void) => this.offline.subscribe(listener);

  markOffline(): void {
    this.offline.set(true);
  }

  markOnline(): void {
    this.offline.set(false);
  }
}
