import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// React reads this flag to know it runs inside a test environment, so state updates in
// event handlers are flushed with act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A loaded machine (the whole repo's tests running at once) can take longer than the default
// second to render a long surah. Waiting longer only costs time when something is really wrong.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
