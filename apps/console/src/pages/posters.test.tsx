import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, makeApiError, type ErrorCode, type Poster } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { POSTER_POLL_MS } from './PostersPage';
import {
  renderConsole,
  screen,
  shellReady,
  text,
  waitFor,
  writes,
  type Call,
  type HarnessOptions,
} from '../test/harness';

/**
 * The poster page of a session (contract 1.0.0-rc.5) against the contract mock. Session 1 (the
 * Taraweeh at Al-Noor, Rawalpindi) has four fixture posters: a queued A4 that regenerates the
 * out-of-date A4, a failed Urdu story whose title did not fit, a ready story, and the old A4.
 * Session 5 is in Lahore. The mock answers as a national admin; the page hides by the signed-in
 * person's own roles, which is what the role tests check.
 */
const SESSION = fx.sessions[0]!;
const OTHER_VENUE_SESSION = fx.sessions[1]!;
const LAHORE_SESSION = fx.sessions[4]!;
const PATH = `/sessions/${SESSION.id}/posters`;
const [storyReady, a4Old, failedStory, , queuedA4] = fx.posters;

afterEach(() => {
  vi.restoreAllMocks();
});

const listPath = (sessionId: string) => `/v1/admin/sessions/${sessionId}/posters`;
const isList = (c: Call, sessionId = SESSION.id) =>
  c.method === 'GET' && c.path === listPath(sessionId);
const isCreate = (c: Call) => c.method === 'POST' && c.path === listPath(SESSION.id);

const apiError = (code: ErrorCode, id: string, issues?: { path: string; code: string }[]) =>
  new Response(JSON.stringify(makeApiError(code, id, issues ? { issues } : {})), {
    status: ERROR_CODES[code],
    headers: { 'content-type': 'application/json' },
  });

/** The list with `outOfDate` worked out, as the mock answers it, but chosen by each test. */
const listed = (items: Poster[]): NonNullable<HarnessOptions['handlers']> => ({
  'adminPosters.list': () => ({ items }),
});
const view = (p: (typeof fx.posters)[number], outOfDate: Poster['outOfDate'] = null): Poster => ({
  ...p,
  outOfDate,
});

async function openPage(options: HarnessOptions = {}) {
  const rendered = renderConsole({ path: PATH, ...options });
  await shellReady(options.locale);
  await screen.findByRole('heading', {
    level: 2,
    name: text('console.posters.list.title', options.locale),
  });
  await waitFor(() => expect(document.querySelector('main .loading')).toBeNull());
  return rendered;
}

const cards = () => screen.getAllByRole('article');

describe.each<Locale>(['en', 'ur'])('poster page (%s)', (locale) => {
  it('lists the posters newest first with their status, and marks the out-of-date one', async () => {
    await openPage({ locale });
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    const all = cards();
    expect(all).toHaveLength(4);
    const status = (card: HTMLElement) => within(card).getAllByText(/./, { selector: '.badge' });
    expect(status(all[0]!)[0]!.textContent).toBe(text('console.posters.status.queued', locale));
    expect(status(all[1]!)[0]!.textContent).toBe(text('console.posters.status.failed', locale));
    expect(status(all[2]!)[0]!.textContent).toBe(text('console.posters.status.ready', locale));
    // The old A4 was made at 8:30 pm; the session now starts at 9:00 pm.
    const old = all[3]!;
    expect(within(old).getByText(text('console.posters.outOfDate.title', locale))).toBeTruthy();
    expect(within(old).getByText(text('console.posters.outOfDate.time', locale))).toBeTruthy();
    // Its regeneration is already queued, so it offers no second one.
    expect(within(old).getByText(text('console.posters.replacing', locale))).toBeTruthy();
    expect(
      within(old).queryByRole('button', { name: text('console.posters.regenerate', locale) }),
    ).toBeNull();
    // The failed one says what to do in plain words.
    expect(
      within(all[1]!).getByText(text('console.posters.failure.textTooLong', locale)),
    ).toBeTruthy();
  });

  it('shows what the poster prints from the session, and that it is not typed', async () => {
    await openPage({ locale });
    const source = screen.getByRole('region', {
      name: text('console.posters.source.title', locale),
    });
    expect(within(source).getByText(text('console.posters.source.note', locale))).toBeTruthy();
    expect(screen.getByText(text('console.posters.form.fromSession', locale))).toBeTruthy();
    // No field asks for a date, a time or a venue.
    const form = screen.getByRole('form', { name: text('console.posters.form.title', locale) });
    expect(within(form).queryByLabelText(/time|venue|date/i)).toBeNull();
  });

  it('marks the provisional templates as demo', async () => {
    await openPage({ locale });
    const demo = text('console.posters.demo', locale);
    for (const template of fx.posterTemplates) {
      const name = locale === 'ur' ? template.name.ur : template.name.en;
      const radio = screen.getByRole('radio', { name: new RegExp(name) });
      expect(radio.closest('.check')?.textContent).toContain(demo);
    }
    expect(screen.getByText(text('console.posters.demo.hint', locale))).toBeTruthy();
  });

  it('works at the largest text size in dark mode', async () => {
    await openPage({ locale, theme: 'dark', textStep: 3 });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(cards()).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: text('console.posters.form.submit', locale) }),
    ).toBeTruthy();
  });
});

describe('making posters', () => {
  it('sends the template, language, formats and title, then shows the queued posters', async () => {
    const { user, calls } = await openPage();
    await user.click(screen.getByRole('radio', { name: /Night/ }));
    await user.click(screen.getByRole('radio', { name: text('console.posters.language.en') }));
    await user.click(
      screen.getByRole('checkbox', { name: text('console.posters.format.printA4') }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: text('console.posters.format.linkPreview') }),
    );
    const title = screen.getByLabelText(text('console.posters.form.titleEn'));
    await user.clear(title);
    await user.type(title, 'Dora at Al-Noor');
    // The Urdu fields go away for an English poster.
    expect(screen.queryByLabelText(text('console.posters.form.titleUr'))).toBeNull();
    await user.selectOptions(
      screen.getByLabelText(text('console.posters.form.accent')),
      text('console.posters.accent.night'),
    );
    await user.click(
      screen.getByRole('radio', { name: new RegExp(text('console.posters.qr.session')) }),
    );
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));

    expect(await screen.findByText(/2 posters are being made/)).toBeTruthy();
    const sent = calls.filter(isCreate);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({
      templateKey: 'night',
      language: 'en',
      formats: ['story', 'link_preview'],
      fields: { title: { en: 'Dora at Al-Noor' }, accent: 'night', qrTarget: 'session' },
    });
    // The two new posters show at the top, being made.
    await waitFor(() => expect(cards()).toHaveLength(6));
    expect(within(cards()[0]!).getByText(text('console.posters.status.queued'))).toBeTruthy();
  });

  it('asks for the Urdu title before sending a bilingual poster', async () => {
    const { user, calls } = await openPage();
    await user.clear(screen.getByLabelText(text('console.posters.form.titleUr')));
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(await screen.findByText(text('console.posters.form.error.required'))).toBeTruthy();
    expect(
      screen.getByLabelText(text('console.posters.form.titleUr')).getAttribute('aria-invalid'),
    ).toBe('true');
    expect(calls.filter(isCreate)).toHaveLength(0);
  });

  it('asks for at least one format', async () => {
    const { user, calls } = await openPage();
    await user.click(screen.getByRole('checkbox', { name: text('console.posters.format.story') }));
    await user.click(
      screen.getByRole('checkbox', { name: text('console.posters.format.printA4') }),
    );
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(await screen.findByText(text('console.posters.form.error.formats'))).toBeTruthy();
    expect(calls.filter(isCreate)).toHaveLength(0);
  });

  it('puts a server rejection on the field it names', async () => {
    const { user } = await openPage({
      handlers: {
        'adminPosters.create': (_c, id) =>
          apiError('validation_failed', id, [{ path: 'fields.title.en', code: 'too_big' }]),
      },
    });
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(await screen.findByText(text('console.posters.form.rejected'))).toBeTruthy();
    expect(
      screen.getByLabelText(text('console.posters.form.titleEn')).getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('says plainly when the person may not make posters here', async () => {
    const { user } = await openPage({
      forceError: (c) => (isCreate(c) ? 'forbidden' : undefined),
    });
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(await screen.findByText(text('console.posters.error.forbiddenAction'))).toBeTruthy();
    expect(screen.getByText(text('console.posters.error.notMade'))).toBeTruthy();
  });

  it('says when the template has gone, and loads the templates again', async () => {
    const { user, calls } = await openPage({
      forceError: (c) => (isCreate(c) ? 'not_found' : undefined),
    });
    const before = calls.filter((c) => c.path === '/v1/admin/poster-templates').length;
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(
      (await screen.findAllByText(text('console.posters.error.templateGone'))).length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/v1/admin/poster-templates').length).toBe(before + 1),
    );
  });

  it('shows a conflict answer plainly', async () => {
    const { user } = await openPage({
      forceError: (c) => (isCreate(c) ? 'conflict' : undefined),
    });
    await user.click(screen.getByRole('button', { name: text('console.posters.form.submit') }));
    expect(await screen.findByText(text('console.posters.error.createConflict'))).toBeTruthy();
  });

  it('puts a failed poster back in the form so the title can be shortened', async () => {
    const { user } = await openPage();
    const failed = cards()[1]!;
    await user.click(
      within(failed).getByRole('button', { name: text('console.posters.editAgain') }),
    );
    const urTitle = screen.getByLabelText(text('console.posters.form.titleUr'));
    await waitFor(() => expect(document.activeElement).toBe(urTitle));
    expect((urTitle as HTMLInputElement).value).toBe(failedStory!.fields.title.ur);
    expect(screen.queryByLabelText(text('console.posters.form.titleEn'))).toBeNull();
    expect((screen.getByRole('radio', { name: /Night/ }) as HTMLInputElement).checked).toBe(true);
    expect(
      (screen.getByRole('radio', { name: text('console.posters.language.ur') }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});

describe('regenerating', () => {
  const outOfDate = (reasons: ('time' | 'venue')[]) =>
    listed([view(storyReady!), view(a4Old!, { reasons })]);

  it('regenerates an out-of-date poster from its band', async () => {
    const { user, calls } = await openPage({ handlers: outOfDate(['time']) });
    const old = cards()[1]!;
    await user.click(within(old).getByRole('button', { name: text('console.posters.regenerate') }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === 'POST' && c.path === `/v1/admin/posters/${a4Old!.id}/regenerate`,
        ),
      ).toBe(true),
    );
    // The new one is queued at the top, and the old one now waits for it.
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(within(cards()[0]!).getByText(text('console.posters.queued.again'))).toBeTruthy();
    expect(within(cards()[2]!).getByText(text('console.posters.replacing'))).toBeTruthy();
  });

  it('names the venue, or the time and the venue, when they changed', async () => {
    await openPage({ handlers: outOfDate(['venue']) });
    expect(screen.getByText(text('console.posters.outOfDate.venue'))).toBeTruthy();
  });

  it('names both when both changed', async () => {
    await openPage({ handlers: outOfDate(['time', 'venue']) });
    expect(screen.getByText(text('console.posters.outOfDate.both'))).toBeTruthy();
  });

  it('says a poster is still being made when regenerating answers conflict', async () => {
    const { user } = await openPage({
      handlers: outOfDate(['time']),
      forceError: (c) => (c.path.endsWith('/regenerate') ? 'conflict' : undefined),
    });
    await user.click(
      within(cards()[1]!).getByRole('button', { name: text('console.posters.regenerate') }),
    );
    expect(await screen.findByText(text('console.posters.error.regenerateConflict'))).toBeTruthy();
  });

  it('says plainly when regenerating is refused', async () => {
    const { user } = await openPage({
      handlers: outOfDate(['time']),
      forceError: (c) => (c.path.endsWith('/regenerate') ? 'forbidden' : undefined),
    });
    await user.click(
      within(cards()[1]!).getByRole('button', { name: text('console.posters.regenerate') }),
    );
    expect(await screen.findByText(text('console.posters.error.forbiddenAction'))).toBeTruthy();
  });

  it('retries a poster that failed because the renderer was busy', async () => {
    const busy = view({ ...failedStory!, failureCode: 'busy' });
    const { user, calls } = await openPage({ handlers: listed([busy]) });
    expect(screen.getByText(text('console.posters.failure.busy'))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: text('console.posters.retry') }));
    await waitFor(() =>
      expect(calls.some((c) => c.path === `/v1/admin/posters/${busy.id}/regenerate`)).toBe(true),
    );
  });
});

describe('downloading', () => {
  it('downloads a ready poster as a file', async () => {
    const created = vi.spyOn(URL, 'createObjectURL');
    const { user, calls } = await openPage();
    const story = cards()[2]!;
    await user.click(
      within(story).getByRole('button', { name: text('console.posters.download.png') }),
    );
    expect(await screen.findByText(text('console.posters.downloaded'))).toBeTruthy();
    expect(calls.some((c) => c.path === `/v1/admin/posters/${storyReady!.id}/file`)).toBe(true);
    const blob = created.mock.calls.at(-1)?.[0] as Blob;
    expect(blob.type).toBe('image/png');
    // The print formats download as PDF.
    expect(
      within(cards()[3]!).getByRole('button', { name: text('console.posters.download.pdf') }),
    ).toBeTruthy();
  });

  it('says a poster is not ready when the download answers conflict', async () => {
    const { user } = await openPage({
      forceError: (c) => (c.path.endsWith('/file') ? 'conflict' : undefined),
    });
    await user.click(
      within(cards()[2]!).getByRole('button', { name: text('console.posters.download.png') }),
    );
    expect(await screen.findByText(text('console.posters.error.downloadConflict'))).toBeTruthy();
  });

  it('offers no download for a queued or failed poster', async () => {
    await openPage();
    for (const card of [cards()[0]!, cards()[1]!]) {
      expect(within(card).queryByRole('button', { name: /Download/ })).toBeNull();
    }
    expect(queuedA4!.status).toBe('queued');
  });
});

describe('the list', () => {
  it('asks again while a poster is being made', async () => {
    const intervals = vi.spyOn(window, 'setInterval');
    const { calls } = await openPage();
    const poll = intervals.mock.calls.find((c) => c[1] === POSTER_POLL_MS);
    expect(poll).toBeTruthy();
    const before = calls.filter((c) => isList(c)).length;
    (poll![0] as () => void)();
    await waitFor(() => expect(calls.filter((c) => isList(c)).length).toBe(before + 1));
  });

  it('does not ask again when nothing is being made', async () => {
    const intervals = vi.spyOn(window, 'setInterval');
    await openPage({ handlers: listed([view(storyReady!)]) });
    expect(intervals.mock.calls.some((c) => c[1] === POSTER_POLL_MS)).toBe(false);
  });

  it('says when there are no posters yet', async () => {
    await openPage({ handlers: listed([]) });
    expect(screen.getByText(text('console.posters.empty.title'))).toBeTruthy();
  });

  it('shows a refused list plainly', async () => {
    await openPage({ forceError: (c) => (isList(c) ? 'forbidden' : undefined) });
    expect(screen.getByText(text('console.posters.forbidden.body'))).toBeTruthy();
  });

  it('shows a failed list with a way to try again', async () => {
    const { user, calls } = await openPage({
      forceError: (c) =>
        isList(c) && calls.filter((x) => isList(x)).length < 2 ? 'internal_error' : undefined,
    });
    await user.click(screen.getByRole('button', { name: text('ui.retry') }));
    expect(await screen.findAllByRole('article')).toHaveLength(4);
  });

  it('says when the session is not there', async () => {
    renderConsole({ path: `/sessions/${fx.fixtureId('session', 999)}/posters` });
    await shellReady();
    expect(await screen.findByText(text('console.posters.notFound.title'))).toBeTruthy();
  });
});

describe('who sees what', () => {
  it.each(['national', 'city', 'venue'] as const)(
    'lets a %s holder of the session see and make its posters',
    async (role) => {
      await openPage({ role });
      expect(cards()).toHaveLength(4);
      expect(screen.getByRole('form', { name: text('console.posters.form.title') })).toBeTruthy();
    },
  );

  it('keeps a city coordinator out of another city: nothing is asked of the API', async () => {
    const { calls } = renderConsole({
      role: 'city',
      path: `/sessions/${LAHORE_SESSION.id}/posters`,
    });
    await shellReady();
    expect(await screen.findByText(text('console.posters.forbidden.title'))).toBeTruthy();
    expect(calls.some((c) => c.path.includes('poster'))).toBe(false);
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('keeps a venue coordinator out of another venue in the same city', async () => {
    const { calls } = renderConsole({
      role: 'venue',
      path: `/sessions/${OTHER_VENUE_SESSION.id}/posters`,
    });
    await shellReady();
    expect(await screen.findByText(text('console.posters.forbidden.title'))).toBeTruthy();
    expect(calls.some((c) => c.path.includes('poster'))).toBe(false);
    expect(writes(calls)).toHaveLength(0);
  });

  it('links to the posters from the sessions list only where the person may see them', async () => {
    const { user } = renderConsole({ role: 'venue', path: '/sessions' });
    await shellReady();
    const table = await screen.findByRole('table', { name: text('console.sessions.title') });
    const links = within(table).getAllByRole('link', {
      name: new RegExp(`^${text('console.posters.tabs.posters')} `),
    });
    // A venue coordinator sees the posters of their own venue's sessions only.
    const ownVenue = fx.sessions.filter((s) => s.venueId === SESSION.venueId);
    expect(links).toHaveLength(ownVenue.length);
    await user.click(links[0]!);
    expect(
      await screen.findByRole('heading', { level: 2, name: text('console.posters.list.title') }),
    ).toBeTruthy();
  });

  it('moves between the registrations and the posters of a session', async () => {
    const { user } = renderConsole({ path: `/sessions/${SESSION.id}/registrations` });
    await shellReady();
    const tabs = await screen.findByRole('navigation', {
      name: text('console.posters.tabs.label'),
    });
    expect(
      within(tabs)
        .getByRole('link', { name: text('console.posters.tabs.registrations') })
        .getAttribute('aria-current'),
    ).toBe('page');
    await user.click(
      within(tabs).getByRole('link', { name: text('console.posters.tabs.posters') }),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: text('console.posters.list.title') }),
    ).toBeTruthy();
  });
});
