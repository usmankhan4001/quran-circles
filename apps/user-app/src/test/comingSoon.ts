import { expect } from 'vitest';
import { messages } from '@qc/i18n';

/**
 * Asserts the shared "Coming soon" treatment (`ui/ComingSoon`): the element is turned off for
 * screen readers (`aria-disabled`), says its visible name followed by "coming soon" in the
 * screen's language, and shows the badge unless the layout draws the badge elsewhere.
 */
export function expectComingSoon(
  element: HTMLElement,
  feature: string,
  locale: 'en' | 'ur',
  options: { badge?: boolean; role?: string } = {},
): void {
  const words = messages[locale];
  expect(element.getAttribute('aria-disabled')).toBe('true');
  expect(element.getAttribute('aria-label')).toBe(
    words['comingSoon.label'].replace('{feature}', feature),
  );
  if (options.role) expect(element.getAttribute('role')).toBe(options.role);
  if (options.badge !== false) {
    expect(element.textContent).toContain(words['comingSoon.badge']);
  }
  // Nothing inside it can be pressed or reached with the keyboard.
  expect(element.querySelector('[tabindex="0"]')).toBeNull();
}
