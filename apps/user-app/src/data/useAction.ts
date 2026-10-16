import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError, type AppError } from '../core/errors';

export interface ActionState<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  running: boolean;
  error: AppError | undefined;
  clearError: () => void;
}

/**
 * Wraps a call that changes something (register, cancel, follow). It keeps `running` and the
 * last error for the screen, and never throws: the screen reads `error`.
 */
export function useAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
): ActionState<A, R> {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<AppError | undefined>();
  const actionRef = useRef(action);
  actionRef.current = action;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setRunning(true);
    setError(undefined);
    try {
      return await actionRef.current(...args);
    } catch (e) {
      if (mounted.current) setError(toAppError(e));
      return undefined;
    } finally {
      if (mounted.current) setRunning(false);
    }
  }, []);

  const clearError = useCallback(() => setError(undefined), []);
  return { run, running, error, clearError };
}
