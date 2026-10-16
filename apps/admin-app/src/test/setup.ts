import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// React reads this flag to know it runs inside a test environment, so state updates in
// event handlers are flushed with act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia; react-native-web asks for the colour scheme through it.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// The machine is shared with other builds; give async queries room before they give up.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
