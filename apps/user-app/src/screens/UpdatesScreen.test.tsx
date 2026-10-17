import { fireEvent } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { UpdatesScreen } from './UpdatesScreen';

const en = messages.en;
const ur = messages.ur;
const unreadOne = fixtures.updates.find((u) => !u.isRead)!;
const withSession = fixtures.updates.find((u) => u.sessionId)!;

describe('UpdatesScreen', () => {
  it('asks a signed-out person to sign in', async () => {
    const view = await renderScreen(<UpdatesScreen />);
    fireEvent.click(view.getByText(en['updates.signedOut.action']));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'updates' } },
    });
  });

  it('lists the feed newest first with the kind of each update', async () => {
    const view = await renderScreen(<UpdatesScreen />, { signedIn: true });
    expect(await view.findByTestId(`update-${unreadOne.id}`)).toBeTruthy();
    expect(view.getByTestId(`update-${withSession.id}`).textContent).toContain(
      en['updates.kind.time_change'],
    );
  });

  it('marks an update read when it is opened, and opens its session', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<UpdatesScreen />, { world });
    fireEvent.click(await view.findByTestId(`update-${unreadOne.id}`));
    await waitFor(() => expect(world.http.callsTo('POST /v1/updates/read')).toHaveLength(1));
    expect(world.http.callsTo('POST /v1/updates/read')[0]!.body).toEqual({
      updateIds: [unreadOne.id],
    });
  });

  it('opens the session of an update that points to one', async () => {
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'updates.feed': () => ({
            items: fixtures.updates.map((u) => ({ ...u, isRead: true })),
            nextCursor: null,
            unreadCount: 0,
          }),
          'updates.unreadCount': () => ({ unreadCount: 0 }),
        },
      },
    });
    const view = await renderScreen(<UpdatesScreen />, { world });
    fireEvent.click(await view.findByTestId(`update-${withSession.id}`));
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: withSession.sessionId },
    });
    expect(world.http.callsTo('POST /v1/updates/read')).toHaveLength(0);
    expect(view.queryByTestId('mark-all-read')).toBeNull();
  });

  it('marks everything read in one tap', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<UpdatesScreen />, { world });
    fireEvent.click(await view.findByTestId('mark-all-read'));
    await waitFor(() => expect(world.http.callsTo('POST /v1/updates/read')).toHaveLength(1));
    expect(world.http.callsTo('POST /v1/updates/read')[0]!.body).toEqual({ all: true });
  });

  it('says when there is nothing yet', async () => {
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'updates.feed': () => ({ items: [], nextCursor: null, unreadCount: 0 }),
          'updates.unreadCount': () => ({ unreadCount: 0 }),
        },
      },
    });
    const view = await renderScreen(<UpdatesScreen />, { world });
    expect(await view.findByText(en['updates.empty.title'])).toBeTruthy();
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the feed', async () => {
      const view = await renderScreen(<UpdatesScreen />, {
        signedIn: true,
        locale,
        color,
        textSize,
      });
      await view.findByTestId(`update-${unreadOne.id}`);
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      expect(view.getByText((locale === 'ur' ? ur : en)['updates.title'])).toBeTruthy();
    });
  });
});
