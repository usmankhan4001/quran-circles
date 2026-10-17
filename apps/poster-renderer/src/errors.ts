import { POSTER_FAILURE_RETRYABLE, type PosterFailureCode } from '@qc/contracts';
import { ZodError } from 'zod';
import { RenderTimeoutError, TextTooLongError } from './browser';
import { BusyError } from './limiter';

const failure = (code: PosterFailureCode) => ({ code, retryable: POSTER_FAILURE_RETRYABLE[code] });

/**
 * The contract's `posters.failure_code` for an error from `PosterRenderer.render`, and whether
 * trying again may help (`POSTER_FAILURE_RETRYABLE`, the rule the worker's retry follows).
 */
export function classify(error: unknown): { code: PosterFailureCode; retryable: boolean } {
  if (error instanceof ZodError) return failure('invalid_request');
  if (error instanceof TextTooLongError) return failure('text_too_long');
  if (error instanceof BusyError) return failure('busy');
  if (error instanceof RenderTimeoutError) return failure('render_timeout');
  return failure('render_failed');
}
