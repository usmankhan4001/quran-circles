import { ApiClientError, type ApiClient } from '@qc/contracts';

/**
 * The part of the typed API client this package uses. The user app passes `createApiClient(...)`
 * when the person is signed in and nothing when they are not; the content package never builds
 * a client of its own.
 */
export type ContentApi = Pick<ApiClient, 'bookmarks' | 'readingPosition'>;

/** Returns the client while someone is signed in, and null otherwise. Called on every use. */
export type GetContentApi = () => ContentApi | null;

export type FailureKind =
  /** No connection, or the server could not be reached. Worth retrying later. */
  | 'offline'
  /** The server said the thing is not there. */
  | 'not_found'
  /** The server said it already exists. */
  | 'conflict'
  /** The sign-in is no longer valid. */
  | 'signed_out'
  /** Anything else. */
  | 'failed';

export function classifyFailure(error: unknown): FailureKind {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'network_error':
        return 'offline';
      case 'not_found':
        return 'not_found';
      case 'conflict':
        return 'conflict';
      case 'unauthenticated':
      case 'token_expired':
      case 'refresh_token_invalid':
        return 'signed_out';
      case 'service_unavailable':
      case 'internal_error':
      case 'rate_limited':
        return 'offline';
      default:
        return 'failed';
    }
  }
  return 'failed';
}

/** A quick unique id for items that exist on the device before the server knows them. */
export function newLocalId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Runs tasks one at a time, in the order they were queued. */
export function createMutex(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
