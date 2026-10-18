import { useEffect, useState } from 'react';

let armed = false;

/**
 * Asks the next screen that calls `useStartFrameDeferral` to mount what is below the fold a frame
 * after its first frame. The web root layout arms it for the start on Home only: that first frame
 * is the one a slow phone waits for, and later visits to Home draw everything at once.
 */
export function armStartFrameDeferral(): void {
  armed = true;
}

/**
 * True when what is below the fold may be drawn. On the start frame armed by
 * `armStartFrameDeferral` it is false on the first render and true from the frame after it has
 * been drawn (where there are no animation frames, one task later); otherwise it is always true.
 */
export function useStartFrameDeferral(): boolean {
  const [ready, setReady] = useState(() => {
    const deferred = armed;
    armed = false;
    return !deferred;
  });
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      if (!cancelled) setReady(true);
    };
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
    // The frame callback runs just before the first paint; the task after it, once it is drawn.
    const frame = raf
      ? raf(() => {
          timer = setTimeout(show, 0);
        })
      : null;
    if (!raf) timer = setTimeout(show, 0);
    return () => {
      cancelled = true;
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
    };
    // Runs once: `ready` only ever turns true.
  }, []);
  return ready;
}
