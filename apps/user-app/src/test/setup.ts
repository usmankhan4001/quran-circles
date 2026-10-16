import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React reads this flag to know it runs inside a test environment, so state updates in
// event handlers are flushed with act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
