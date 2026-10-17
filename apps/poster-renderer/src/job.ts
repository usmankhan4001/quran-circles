import {
  posterStorageKey,
  type PosterFailureCode,
  type PosterFormat,
  type RendererRenderResponse,
} from '@qc/contracts';
import { classify } from './errors';
import type { RenderRequestInput } from './input';
import type { PosterRenderer } from './renderer';

/** Where finished files go (object storage or a volume; the platform lane decides). */
export interface FileStore {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
}

/** One queued poster job: the poster rows it fills, and the render request. */
export interface PosterJob {
  request: RenderRequestInput;
}

export type PosterJobResult =
  | {
      status: 'ready';
      locale: RendererRenderResponse['locale'];
      sourceSnapshot: RendererRenderResponse['sourceSnapshot'];
      altText: RendererRenderResponse['altText'];
      deepLink: string;
      /** One storage key per format, for `posters.storage_key`. */
      files: Array<{
        format: PosterFormat;
        storageKey: string;
        contentType: 'image/png' | 'application/pdf';
        cached: boolean;
      }>;
    }
  | { status: 'failed'; code: PosterFailureCode; retryable: boolean };

/**
 * The poster queue job: render, then store each file under a content-addressed key
 * (`posters/<session id>/<cache key>.<ext>`, the contract's `posterStorageKey`). The same
 * template, fields and session version give the same key, so a retried or repeated job does not
 * render again and stores the same bytes. A changed session version gives a new key: the
 * regenerated poster sits beside the old one until the API swaps the row's `storage_key`.
 *
 * The worker lane runs this behind pg-boss (change request 2026-10-17-poster-renderer); for now
 * `cli/render-sample.ts` drives it with sample data.
 */
export async function runPosterJob(
  job: PosterJob,
  deps: { renderer: PosterRenderer; store: FileStore },
): Promise<PosterJobResult> {
  try {
    const result = await deps.renderer.render(job.request);
    const files = [];
    for (const file of result.files) {
      const storageKey = posterStorageKey(
        result.sourceSnapshot.sessionId,
        file.cacheKey,
        file.contentType,
      );
      // Always written: the key is content-addressed, so a repeat overwrites with the same bytes.
      await deps.store.put(storageKey, file.bytes, file.contentType);
      files.push({
        format: file.format,
        storageKey,
        contentType: file.contentType,
        cached: file.cached,
      });
    }
    return {
      status: 'ready',
      locale: result.locale,
      sourceSnapshot: result.sourceSnapshot,
      altText: result.altText,
      deepLink: result.deepLink,
      files,
    };
  } catch (error) {
    return { status: 'failed', ...classify(error) };
  }
}
