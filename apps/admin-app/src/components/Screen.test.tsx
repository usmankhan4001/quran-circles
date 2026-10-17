import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { Button } from '@qc/ui';
import { describe, expect, it } from 'vitest';
import { combos, renderScreen } from '../test/render';
import { Screen, ScreenFooter } from './Screen';

function Form() {
  const [count, setCount] = useState(0);
  return (
    <>
      <Button testID="body-button" label="Add one" onPress={() => setCount((c) => c + 1)} />
      <ScreenFooter>
        <Button testID="footer-button" label={`Save ${count}`} onPress={() => {}} />
      </ScreenFooter>
    </>
  );
}

describe.each(combos)('Screen in $name', (combo) => {
  it('has the kit green header with the title and a back button', async () => {
    const { nav, container } = renderScreen(
      <Screen title="Sample title" subtitle="Sample line" onBack={() => nav.back()} testID="frame">
        <Form />
      </Screen>,
      { combo },
    );
    const hero = await screen.findByTestId('frame-hero');
    expect(within(hero).getByText('Sample title')).toBeTruthy();
    expect(within(hero).getByText('Sample line')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });

  it('pins the form’s main action in the bar at the bottom', async () => {
    renderScreen(
      <Screen title="Sample title" testID="frame">
        <Form />
      </Screen>,
      { combo },
    );
    const bar = await screen.findByTestId('screen-footer');
    expect(within(bar).getByTestId('footer-button')).toBeTruthy();
  });
});

describe('ScreenFooter', () => {
  it('follows the form as it changes', async () => {
    renderScreen(
      <Screen title="Sample title">
        <Form />
      </Screen>,
    );
    expect((await screen.findByTestId('footer-button')).textContent).toBe('Save 0');
    fireEvent.click(screen.getByTestId('body-button'));
    expect(screen.getByTestId('footer-button').textContent).toBe('Save 1');
  });

  it('removes the bar when the form goes away', async () => {
    function Toggle() {
      const [on, setOn] = useState(true);
      return (
        <>
          <Button testID="toggle" label="Toggle" onPress={() => setOn((v) => !v)} />
          {on ? <Form /> : null}
        </>
      );
    }
    renderScreen(
      <Screen title="Sample title">
        <Toggle />
      </Screen>,
    );
    await screen.findByTestId('screen-footer');
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.queryByTestId('screen-footer')).toBeNull();
  });

  it('renders in place outside a screen', async () => {
    renderScreen(<Form />);
    expect(await screen.findByTestId('footer-button')).toBeTruthy();
    expect(screen.queryByTestId('screen-footer')).toBeNull();
  });
});
