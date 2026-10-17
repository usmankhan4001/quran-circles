import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// The machine is shared with other builds; give async queries room before they give up.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-text-step');
});

// jsdom has no object URLs or media queries; the console needs both.
if (!('createObjectURL' in URL)) {
  Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => undefined });
}
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
