import { fireEvent } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { MATRIX, directionOf, renderScreen } from '../test/harness';
import { expectComingSoon } from '../test/comingSoon';
import { ComingSoon, ComingSoonBadge } from './ComingSoon';

describe('ComingSoon', () => {
  it.each(MATRIX)(
    'draws an action that is not built as a greyed button with the badge in $name',
    async ({ locale, color, textSize }) => {
      const label = locale === 'ur' ? 'آن لائن نشست میں شامل ہوں' : 'Join online';
      const view = await renderScreen(<ComingSoon label={label} testID="soon" />, {
        locale,
        color,
        textSize,
      });
      const soon = view.getByTestId('soon');
      expectComingSoon(soon, label, locale, { role: 'button' });
      expect(soon.textContent).toContain(label);
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    },
  );

  it.each(['en', 'ur'] as const)(
    'fades drawn content and says it as one group, in %s',
    async (locale) => {
      const view = await renderScreen(
        <ComingSoon label="Teacher" testID="soon">
          <Text testID="drawn">Teacher</Text>
        </ComingSoon>,
        { locale },
      );
      const soon = view.getByTestId('soon');
      expectComingSoon(soon, 'Teacher', locale, { role: 'group' });
      // The drawn part and the badge are hidden from screen readers: the group says it all.
      const drawn = view.getByTestId('drawn').parentElement!;
      expect(drawn.getAttribute('aria-hidden')).toBe('true');
      expect(Number(drawn.style.opacity)).toBeLessThan(1);
      expect(view.getByTestId('coming-soon-badge').getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('keeps more of the drawing in high contrast', async () => {
    const view = await renderScreen(
      <ComingSoon label="Teacher">
        <Text testID="drawn">Teacher</Text>
      </ComingSoon>,
      { color: 'highContrast' },
    );
    expect(Number(view.getByTestId('drawn').parentElement!.style.opacity)).toBe(0.75);
  });

  it('takes no press, and is not a button anyone can reach with the keyboard', async () => {
    const view = await renderScreen(<ComingSoon label="Ask for a circle" testID="soon" />);
    const soon = view.getByTestId('soon');
    fireEvent.click(soon);
    fireEvent.click(view.getByText('Ask for a circle'));
    expect(view.world.nav.last()).toBeUndefined();
    expect(view.queryByRole('alert')).toBeNull();
    expect(soon.getAttribute('tabindex')).not.toBe('0');
  });

  it('leaves the badge to the layout when asked, and the badge reads in each language', async () => {
    const en = await renderScreen(
      <>
        <ComingSoon label="Photos" badge={false} testID="soon">
          <Text>art</Text>
        </ComingSoon>
        <ComingSoonBadge testID="badge" />
      </>,
    );
    expectComingSoon(en.getByTestId('soon'), 'Photos', 'en', { badge: false });
    expect(en.getByTestId('soon').textContent).not.toContain(messages.en['comingSoon.badge']);
    expect(en.getByTestId('badge').textContent).toBe(messages.en['comingSoon.badge']);
    en.unmount();
    const ur = await renderScreen(<ComingSoonBadge testID="badge" />, { locale: 'ur' });
    expect(ur.getByTestId('badge').textContent).toBe(messages.ur['comingSoon.badge']);
  });
});
