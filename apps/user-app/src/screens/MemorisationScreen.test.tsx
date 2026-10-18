import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { ERROR_CODES, makeApiError } from '@qc/contracts';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { ALL_NEXT_FLAGS, configWith, meWith, mine, type Handlers } from '../test/nextFeatures';
import { JourneyScreen } from './JourneyScreen';
import { MemorisationScreen } from './MemorisationScreen';

const en = messages.en;
const ur = messages.ur;

function errorAnswer(code: keyof typeof ERROR_CODES) {
  return (_c: unknown, id: string) =>
    new Response(JSON.stringify(makeApiError(code, id)), {
      status: ERROR_CODES[code],
      headers: { 'content-type': 'application/json' },
    });
}

async function tracker(handlers: Handlers = {}, signedIn = true) {
  return renderScreen(<MemorisationScreen />, { signedIn, mock: { handlers } });
}

describe('MemorisationScreen', () => {
  it('lists the marked surahs and counts each mark in the header', async () => {
    const view = await tracker();
    await view.findByTestId('surah-1');
    for (const surah of [1, 36, 67, 112]) expect(view.getByTestId(`surah-${surah}`)).toBeTruthy();
    const memorised = within(view.getByTestId('memorisation-stat-memorised'));
    expect(memorised.getByText('2')).toBeTruthy();
    expect(memorised.getByText(en['memorisation.status.memorised'])).toBeTruthy();
    const learning = within(view.getByTestId('memorisation-stat-learning'));
    expect(learning.getByText('1')).toBeTruthy();
    expect(learning.getByText(en['memorisation.status.learning'])).toBeTruthy();
  });

  it('lets a screen reader read each count as text, with no name on a plain tile (A-02)', async () => {
    const view = await tracker();
    await view.findByTestId('surah-1');
    for (const status of ['learning', 'memorised', 'revising'] as const) {
      const tile = view.getByTestId(`memorisation-stat-${status}`);
      // A name on an element with no role is ignored on the web (axe aria-prohibited-attr).
      expect(tile.getAttribute('aria-label')).toBeNull();
      expect(tile.getAttribute('aria-hidden')).toBeNull();
      expect(tile.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(tile.textContent).toContain(en[`memorisation.status.${status}`]);
    }
  });

  it('lists in "revise this week" only memorised surahs past the setting (default 14 days)', async () => {
    const view = await tracker();
    const revise = await view.findByTestId('memorisation-revise');
    // 112 was last revised on 2 January; 1 only five days ago; 67 is revising, not memorised.
    expect(within(revise).getByTestId('due-112')).toBeTruthy();
    expect(within(revise).queryByTestId('due-1')).toBeNull();
    expect(within(revise).queryByTestId('due-67')).toBeNull();
    expect(
      within(revise).getByText(en['memorisation.revise.note.other'].replace('{count}', '14')),
    ).toBeTruthy();
  });

  it("follows the person's own revise-after setting", async () => {
    const view = await tracker(meWith({ memorisationReviseAfterDays: 3 }));
    const revise = await view.findByTestId('memorisation-revise');
    await waitFor(() => expect(within(revise).getByTestId('due-1')).toBeTruthy());
    expect(
      within(revise).getByText(en['memorisation.revise.note.other'].replace('{count}', '3')),
    ).toBeTruthy();
  });

  it('marks a surah revised and takes it off the list', async () => {
    const view = await tracker();
    fireEvent.click(await view.findByTestId('revise-112'));
    await waitFor(() => expect(view.queryByTestId('due-112')).toBeNull());
    const call = view.world.http.callsTo('PUT /v1/me/memorisation/112')[0]!;
    expect(call.body).toEqual({ status: 'memorised', markRevised: true });
    expect(view.getByTestId('memorisation-revise-empty')).toBeTruthy();
  });

  it('says so when marking revised fails, and keeps the surah on the list', async () => {
    const view = await tracker({ 'memorisation.put': errorAnswer('internal_error') });
    fireEvent.click(await view.findByTestId('revise-112'));
    expect(await view.findByText(en['memorisation.error'])).toBeTruthy();
    expect(view.getByTestId('due-112')).toBeTruthy();
  });

  it('marks a new surah from the list of all 114', async () => {
    const view = await tracker();
    fireEvent.click(await view.findByTestId('memorisation-add'));
    fireEvent.click(await view.findByTestId('memorisation-add-option-18'));
    const sheet = await view.findByTestId('memorisation-sheet');
    fireEvent.click(within(sheet).getByTestId('status-learning'));
    await waitFor(() => expect(view.getByTestId('surah-18')).toBeTruthy());
    expect(view.world.http.callsTo('PUT /v1/me/memorisation/18')[0]!.body).toEqual({
      status: 'learning',
    });
  });

  it('changes a mark and clears one', async () => {
    const view = await tracker();
    fireEvent.click(await view.findByTestId('surah-36'));
    let sheet = await view.findByTestId('memorisation-sheet');
    expect(within(sheet).getByTestId('status-learning').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(sheet).getByTestId('status-memorised'));
    await waitFor(() =>
      expect(view.world.http.callsTo('PUT /v1/me/memorisation/36')[0]?.body).toEqual({
        status: 'memorised',
      }),
    );

    fireEvent.click(view.getByTestId('surah-67'));
    sheet = await view.findByTestId('memorisation-sheet');
    fireEvent.click(within(sheet).getByTestId('sheet-clear'));
    await waitFor(() => expect(view.queryByTestId('surah-67')).toBeNull());
    expect(view.world.http.callsTo('DELETE /v1/me/memorisation/67')).toHaveLength(1);
  });

  it('shows the error in the sheet when a change fails', async () => {
    const view = await tracker();
    // The mock answers 204 endpoints itself, so the failure goes in as a forced error.
    view.world.http.failNext('DELETE /v1/me/memorisation/67', 'service_unavailable');
    fireEvent.click(await view.findByTestId('surah-67'));
    const sheet = await view.findByTestId('memorisation-sheet');
    fireEvent.click(within(sheet).getByTestId('sheet-clear'));
    expect((await view.findByTestId('memorisation-sheet-error')).textContent).toBe(
      en['errors.service_unavailable'],
    );
    expect(view.getByTestId('surah-67')).toBeTruthy();
  });

  it('offers Try again when the tracker cannot be loaded', async () => {
    const view = await tracker({ 'memorisation.list': errorAnswer('internal_error') });
    expect(await view.findByText(en['ui.retry'])).toBeTruthy();
  });

  it('asks a visitor to sign in, and loads nothing', async () => {
    const view = await tracker({}, false);
    expect(await view.findByTestId('memorisation-signed-out')).toBeTruthy();
    expect(view.world.http.callsTo('GET /v1/me/memorisation')).toHaveLength(0);
  });

  it('says it is not available with the memorisation flag off', async () => {
    const view = await tracker(configWith(ALL_NEXT_FLAGS.filter((f) => f !== 'memorisation')));
    expect(await view.findByTestId('memorisation-off')).toBeTruthy();
    expect(view.world.http.callsTo('GET /v1/me/memorisation')).toHaveLength(0);
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the tracker', async () => {
      const world = await createWorld({ signedIn: true, locale, color, textSize });
      const view = await renderScreen(<MemorisationScreen />, { world });
      await view.findByTestId('due-112');
      const words = locale === 'ur' ? ur : en;
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      expect(view.getAllByText(words['memorisation.title']).length).toBeGreaterThan(0);
      expect(view.getByText(words['memorisation.revise.title'])).toBeTruthy();
      expect(view.getAllByText(words['memorisation.markRevised']).length).toBeGreaterThan(0);
    });
  });
});

describe('My Journey: the way into the tracker', () => {
  it('says how many surahs to revise this week and opens the tracker', async () => {
    const view = await renderScreen(<JourneyScreen />, {
      signedIn: true,
      mock: { handlers: mine() },
    });
    const card = await view.findByTestId('journey-memorisation');
    expect((await within(card).findByTestId('journey-memorisation-summary')).textContent).toBe(
      en['memorisation.summary.due.one'],
    );
    fireEvent.click(card);
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'memorisation' } });
  });

  it('invites a start when nothing is marked', async () => {
    const view = await renderScreen(<JourneyScreen />, {
      signedIn: true,
      mock: {
        handlers: { ...mine(), 'memorisation.list': () => ({ items: [], reviseAfterDays: 14 }) },
      },
    });
    expect((await view.findByTestId('journey-memorisation-summary')).textContent).toBe(
      en['memorisation.summary.start'],
    );
  });

  it('is not shown with the memorisation flag off', async () => {
    const view = await renderScreen(<JourneyScreen />, {
      signedIn: true,
      mock: { handlers: { ...mine(), ...configWith([]) } },
    });
    await view.findByTestId('journey-follows');
    await waitFor(() =>
      expect(view.world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0),
    );
    expect(view.queryByTestId('journey-memorisation')).toBeNull();
  });
});
