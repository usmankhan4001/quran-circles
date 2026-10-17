import { RenderTimeoutError, TextTooLongError } from './browser';
import { ZodError } from 'zod';
import { BusyError } from './limiter';

export type RenderFailure =
  'invalid_request' | 'text_too_long' | 'busy' | 'render_timeout' | 'render_failed';

/** The failure code for an error from `PosterRenderer.render`, and whether trying again may help. */
export function classify(error: unknown): { code: RenderFailure; retryable: boolean } {
  if (error instanceof ZodError) return { code: 'invalid_request', retryable: false };
  if (error instanceof TextTooLongError) return { code: 'text_too_long', retryable: false };
  if (error instanceof BusyError) return { code: 'busy', retryable: true };
  if (error instanceof RenderTimeoutError) return { code: 'render_timeout', retryable: true };
  return { code: 'render_failed', retryable: true };
}
