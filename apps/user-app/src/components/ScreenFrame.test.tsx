import { fireEvent } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { MATRIX, expectGreenHeader, renderScreen } from '../test/harness';
import { ScreenFrame } from './ScreenFrame';

describe('ScreenFrame', () => {
  it.each(MATRIX)(
    'tops the screen with the green header (hero and textOnHero) in $name',
    async ({ locale, color, textSize }) => {
      const view = await renderScreen(
        <ScreenFrame title="Nearby" subtitle="Rawalpindi" hero={<Text>Inside the green</Text>}>
          <Text>Body</Text>
        </ScreenFrame>,
        { locale, color, textSize },
      );
      expectGreenHeader(view.container, color);
      expect(view.getByText('Inside the green')).toBeTruthy();
      expect(view.getByText('Body')).toBeTruthy();
    },
  );

  it('marks the title as the page heading', async () => {
    const view = await renderScreen(
      <ScreenFrame title="My Journey">
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe('My Journey');
  });

  it('shows a back button that goes back', async () => {
    const onBack = vi.fn();
    const view = await renderScreen(
      <ScreenFrame title="Venue" onBack={onBack}>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    fireEvent.click(view.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('as a sheet shows a close button instead of a back arrow', async () => {
    const onBack = vi.fn();
    const view = await renderScreen(
      <ScreenFrame title="Register" onBack={onBack} sheet>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(view.queryByLabelText('Back')).toBeNull();
    fireEvent.click(view.getByTestId('sheet-close'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
