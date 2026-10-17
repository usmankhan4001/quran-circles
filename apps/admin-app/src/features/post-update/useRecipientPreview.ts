import { useEffect, useRef, useState } from 'react';
import type { PostUpdateBody } from '@qc/contracts';
import { useApi } from '../../auth/AuthProvider';

/** How long the draft must stay still before the count is asked for again. */
export const PREVIEW_DELAY_MS = 600;

export interface RecipientPreview {
  /** idle: no complete draft yet. error: the count could not be read; the screen goes on without it. */
  status: 'idle' | 'counting' | 'ready' | 'error';
  recipients: number | null;
}

/** What decides who an update reaches. The text does not, so typing does not ask again. */
const audienceKey = (body: PostUpdateBody): string =>
  JSON.stringify([body.scope, body.sessionId ?? null, body.kind, body.notify, body.templateKey]);

/**
 * How many people a draft would reach, from `adminUpdates.preview`. It sends the whole draft, as
 * the contract asks, but only once the audience has stayed the same for `delayMs`, and only the
 * latest answer counts. It never posts: sending stays with the screen's confirm step, and the
 * count shown after sending is the one the post itself returns.
 */
export function useRecipientPreview(
  body: PostUpdateBody | undefined,
  delayMs: number = PREVIEW_DELAY_MS,
): RecipientPreview {
  const api = useApi();
  const [state, setState] = useState<RecipientPreview>({ status: 'idle', recipients: null });
  const draft = useRef(body);
  draft.current = body;
  const key = body ? audienceKey(body) : null;

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle', recipients: null });
      return;
    }
    let live = true;
    setState({ status: 'counting', recipients: null });
    const timer = setTimeout(() => {
      const latest = draft.current;
      if (!latest) return;
      api.adminUpdates.preview({ body: latest }).then(
        (res) => {
          if (live) setState({ status: 'ready', recipients: res.recipients });
        },
        () => {
          if (live) setState({ status: 'error', recipients: null });
        },
      );
    }, delayMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, delayMs, api]);

  return state;
}
