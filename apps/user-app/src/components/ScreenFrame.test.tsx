import { act, fireEvent, within } from '@testing-library/react';
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

  it('is the main landmark of the page, with the header and body inside it (A-08)', async () => {
    const view = await renderScreen(
      <ScreenFrame title="My Journey" footer={<Text>Main action</Text>}>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    const mains = view.getAllByRole('main');
    expect(mains).toHaveLength(1);
    const main = mains[0]!;
    expect(main.tagName).toBe('MAIN');
    expect(within(main).getByRole('heading', { level: 1 }).textContent).toBe('My Journey');
    expect(within(main).getByText('Body')).toBeTruthy();
    expect(within(main).getByText('Main action')).toBeTruthy();
    // A banner may not sit inside main; the in-screen header has no banner role.
    expect(view.queryByRole('banner')).toBeNull();
    expect(view.queryByRole('dialog')).toBeNull();
  });

  it('as a sheet is a named modal dialog, so it never adds a second main (A-08)', async () => {
    const view = await renderScreen(
      <ScreenFrame title="Register" onBack={() => undefined} sheet>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    const dialog = view.getByRole('dialog', { name: 'Register' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Body')).toBeTruthy();
    expect(view.queryByRole('main')).toBeNull();
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

  it('scrolls the header away with the page', async () => {
    const view = await renderScreen(
      <ScreenFrame title="Home">
        <Text>Body</Text>
      </ScreenFrame>,
    );
    const scroll = view.getByTestId('screen-scroll');
    expect(within(scroll).getByTestId('screen-header')).toBeTruthy();
  });

  function scrollTo(el: HTMLElement, y: number) {
    act(() => {
      el.scrollTop = y;
      fireEvent.scroll(el, { target: { scrollTop: y } });
    });
  }

  it('shows a compact green row with the title and back once the header has gone', async () => {
    const onBack = vi.fn();
    const view = await renderScreen(
      <ScreenFrame title="Venue" onBack={onBack}>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(view.queryByTestId('screen-compact-header')).toBeNull();
    const scroll = view.getByTestId('screen-scroll');
    scrollTo(scroll, 600);
    const compact = await view.findByTestId('screen-compact-header');
    expect(compact.textContent).toContain('Venue');
    // The compact title is not a second heading.
    expect(view.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    fireEvent.click(within(compact).getByTestId('screen-compact-back'));
    expect(onBack).toHaveBeenCalledOnce();
    scrollTo(scroll, 0);
    await vi.waitFor(() => expect(view.queryByTestId('screen-compact-header')).toBeNull());
  });

  it('keeps the header fixed on a sheet and on a page whose content scrolls itself', async () => {
    const sheet = await renderScreen(
      <ScreenFrame title="Register" onBack={vi.fn()} sheet>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(within(sheet.getByTestId('screen-scroll')).queryByTestId('screen-header')).toBeNull();
    sheet.unmount();
    const fixed = await renderScreen(
      <ScreenFrame title="Quran" scroll={false}>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(fixed.queryByTestId('screen-scroll')).toBeNull();
    expect(fixed.getByTestId('screen-header')).toBeTruthy();
  });

  it.each(MATRIX)(
    'draws the place picture with back and share on a session page in $name',
    async ({ locale, color, textSize }) => {
      const onBack = vi.fn();
      const onShare = vi.fn();
      const view = await renderScreen(
        <ScreenFrame
          title="Taraweeh"
          onBack={onBack}
          photo={{ seed: 'venue-1', onShare, testID: 'photo' }}
        >
          <Text>Body</Text>
        </ScreenFrame>,
        { locale, color, textSize },
      );
      expectGreenHeader(view.container, color);
      const header = view.getByTestId('screen-header');
      expect(within(header).getByTestId('photo').getAttribute('aria-hidden')).toBe('true');
      expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Taraweeh');
      fireEvent.click(within(header).getByTestId('screen-share'));
      expect(onShare).toHaveBeenCalledOnce();
      fireEvent.click(within(header).getAllByRole('button')[0]!);
      expect(onBack).toHaveBeenCalledOnce();
    },
  );

  it('leaves out the share button when there is nothing to share yet', async () => {
    const view = await renderScreen(
      <ScreenFrame title="Venue" onBack={vi.fn()} photo={{ seed: 'v' }}>
        <Text>Body</Text>
      </ScreenFrame>,
    );
    expect(view.queryByTestId('screen-share')).toBeNull();
    expect(view.getByTestId('screen-photo')).toBeTruthy();
  });
});
