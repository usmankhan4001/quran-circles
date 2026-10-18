/** The id of the start screen that `public/index.html` draws before any script has run. */
export const START_SCREEN_ID = 'qc-start';

/**
 * Takes the start screen away once the app's first screen is ready. Web only: on a phone there
 * is no page and this does nothing. Safe to call more than once.
 */
export function hideStartScreen(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  doc?.getElementById(START_SCREEN_ID)?.remove();
}
