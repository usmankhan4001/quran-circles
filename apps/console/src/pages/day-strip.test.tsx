import { describe, expect, it } from 'vitest';
import { renderConsole, screen, text } from '../test/harness';

describe('daily ayahs day strip', () => {
  it('shows seven days and narrows the list to the one pressed', async () => {
    const { user } = renderConsole({ role: 'national', path: '/ayah-of-the-day' });
    const strip = await screen.findByRole('navigation', {
      name: text('console.dailyAyahs.strip.label'),
    });
    const days = strip.querySelectorAll('button');
    expect(days).toHaveLength(7);
    await user.click(days[1] as HTMLElement);
    expect(days[1]?.getAttribute('aria-pressed')).toBe('true');
    const from = (await screen.findByLabelText(
      text('console.dailyAyahs.filter.from'),
    )) as HTMLInputElement;
    const to = screen.getByLabelText(text('console.dailyAyahs.filter.to')) as HTMLInputElement;
    expect(from.value).toBe(to.value);
  });
});
