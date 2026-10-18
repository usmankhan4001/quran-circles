import { describe, expect, it } from 'vitest';
import { START_SCREEN_ID, hideStartScreen } from './startScreen';

describe('hideStartScreen', () => {
  it('takes the start screen off the page, and can be called again', () => {
    const doc = document.implementation.createHTMLDocument('start');
    doc.body.innerHTML = `<div id="${START_SCREEN_ID}"></div><div id="root"></div>`;
    hideStartScreen(doc);
    expect(doc.getElementById(START_SCREEN_ID)).toBeNull();
    expect(doc.getElementById('root')).not.toBeNull();
    expect(() => hideStartScreen(doc)).not.toThrow();
  });

  it('does nothing where there is no page', () => {
    expect(() => hideStartScreen(undefined)).not.toThrow();
  });
});
