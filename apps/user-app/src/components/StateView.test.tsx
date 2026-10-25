import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { MATRIX, createWorld, directionOf, renderScreen } from '../test/harness';
import {
  EmptyJourneyState,
  LoadErrorState,
  NoCirclesState,
  OfflineState,
  StateView,
} from './StateView';

const en = messages.en;
const ur = messages.ur;

describe('StateView', () => {
  it('shows the title, the sentence and the two actions, the first as the main one', async () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    const view = await renderScreen(
      <StateView
        icon="pin"
        title="Nothing here"
        body="Try again later."
        primary={{ label: 'Do it', onPress: primary, testID: 'main' }}
        secondary={{ label: 'Or this', onPress: secondary, testID: 'other' }}
        testID="state"
      />,
    );
    expect(view.getByText('Nothing here')).toBeTruthy();
    expect(view.getByText('Try again later.')).toBeTruthy();
    fireEvent.click(view.getByTestId('main'));
    fireEvent.click(view.getByTestId('other'));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it('announces an error at once, and a calm state quietly', async () => {
    const loud = await renderScreen(<StateView icon="warning" title="Broken" alert testID="s" />);
    expect(loud.getByTestId('s').getAttribute('role')).toBe('alert');
    loud.unmount();
    const quiet = await renderScreen(<StateView icon="pin" title="Empty" testID="s" />);
    expect(quiet.getByTestId('s').getAttribute('role')).toBeNull();
  });
});

describe('the member states', () => {
  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws every state in the language and direction of the screen', async () => {
      const world = await createWorld({ locale, color, textSize });
      const words = locale === 'ur' ? ur : en;
      const noop = () => {};
      const cases = [
        {
          ui: <NoCirclesState onWiden={noop} onAsk={noop} />,
          texts: [
            'states.noCircles.title',
            'states.noCircles.body',
            'states.noCircles.widen',
            'states.noCircles.ask',
          ],
        },
        {
          ui: <LoadErrorState onRetry={noop} onSaved={noop} />,
          texts: [
            'states.loadError.title',
            'states.loadError.body',
            'ui.retry',
            'states.loadError.saved',
          ],
        },
        {
          ui: <OfflineState onRetry={noop} />,
          texts: ['ui.offlineTitle', 'ui.offlineBody', 'ui.retry'],
        },
        {
          ui: <EmptyJourneyState onQuran={noop} onFind={noop} />,
          texts: [
            'states.journey.title',
            'states.journey.body',
            'states.journey.quran',
            'states.journey.find',
          ],
        },
      ] as const;
      for (const c of cases) {
        const view = await renderScreen(c.ui, { world });
        expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
        for (const key of c.texts) expect(view.getByText(words[key])).toBeTruthy();
        view.unmount();
      }
    });
  });

  it('keeps the saved-circles action out when nothing is saved', async () => {
    const view = await renderScreen(<LoadErrorState onRetry={() => {}} />);
    expect(view.queryByText(en['states.loadError.saved'])).toBeNull();
    expect(view.getByTestId('state-load-error').getAttribute('role')).toBe('alert');
  });

  it('calls the right handler from each action', async () => {
    const widen = vi.fn();
    const ask = vi.fn();
    const near = await renderScreen(<NoCirclesState onWiden={widen} onAsk={ask} />);
    fireEvent.click(near.getByText(en['states.noCircles.widen']));
    fireEvent.click(near.getByText(en['states.noCircles.ask']));
    expect(widen).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledTimes(1);
    near.unmount();

    const retry = vi.fn();
    const saved = vi.fn();
    const failed = await renderScreen(<LoadErrorState onRetry={retry} onSaved={saved} />);
    fireEvent.click(failed.getByTestId('state-retry'));
    fireEvent.click(failed.getByText(en['states.loadError.saved']));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
