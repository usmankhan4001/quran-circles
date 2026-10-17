import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Platform } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Poster } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { messages } from '@qc/i18n';
import { routes } from '../../navigation/routes';
import { createBackend, FIXTURE_NOW, ids, meFor, type RoleKind } from '../../test/backend';
import { combos, renderScreen, settled, typeInto } from '../../test/render';
import { SessionScreen } from '../home/SessionScreen';
import { POSTER_POLL_MS, PostersScreen } from './PostersScreen';
import { saveRouteFor } from './saveFile';

/**
 * The coordinator's poster screen (contract 1.0.0-rc.5) against the in-memory backend, which
 * checks every request with the scope matrix. The Taraweeh at Al-Noor (`sessionDora`) has four
 * fixture posters: a queued A4 that regenerates the out-of-date A4, a failed Urdu story whose
 * title did not fit, and a ready story.
 */
const [storyReady, a4Old, failedStory, lahoreLink, queuedA4] = fx.posters;
const en = messages.en as Record<string, string>;
const ur = messages.ur as Record<string, string>;
const say = (key: string, locale: 'en' | 'ur' = 'en') => (locale === 'ur' ? ur : en)[key]!;
const card = (p: { id: string }) => screen.getByTestId(`poster-${p.id}`);

afterEach(() => {
  vi.restoreAllMocks();
});

const view = (p: (typeof fx.posters)[number], outOfDate: Poster['outOfDate'] = null): Poster => ({
  ...p,
  outOfDate,
});
const listOnly = (items: Poster[]) => ({ 'adminPosters.list': () => ({ items }) });

async function open(
  backend = createBackend({ me: meFor('venue') }),
  sessionId: string = ids.sessionDora,
) {
  const rendered = renderScreen(<PostersScreen sessionId={sessionId} />, { backend });
  await waitFor(() =>
    expect(
      screen.queryByTestId('poster-form') ??
        screen.queryByTestId('posters-forbidden') ??
        screen.queryByTestId('posters-list-forbidden') ??
        screen.queryByTestId('posters-session-not-available'),
    ).toBeTruthy(),
  );
  return rendered;
}

describe.each(combos)('PostersScreen in $name', (combo) => {
  it('lists the posters with their status, the out-of-date band and the demo templates', async () => {
    const { container } = renderScreen(<PostersScreen sessionId={ids.sessionDora} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await settled('poster-form');
    await settled('posters-list');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
    for (const p of [storyReady!, a4Old!, failedStory!, queuedA4!]) expect(card(p)).toBeTruthy();
    expect(screen.getByTestId(`poster-${storyReady!.id}-status`).textContent).toBe(
      say('admin.posters.status.ready', combo.locale),
    );
    // The old A4 was made at 8:30 pm; the session now starts at 9:00 pm, and its regeneration
    // is already queued, so it offers no second one.
    const band = screen.getByTestId(`poster-${a4Old!.id}-out-of-date`);
    expect(band.textContent).toContain(say('admin.posters.outOfDate.time', combo.locale));
    expect(band.textContent).toContain(say('admin.posters.replacing', combo.locale));
    expect(screen.queryByTestId(`poster-${a4Old!.id}-regenerate`)).toBeNull();
    expect(screen.getByTestId(`poster-${failedStory!.id}-failure`).textContent).toBe(
      say('admin.posters.failure.textTooLong', combo.locale),
    );
    expect(screen.getByTestId('poster-template-cloud-demo').textContent).toBe(
      say('admin.posters.demo', combo.locale),
    );
    expect(screen.getByText(say('admin.posters.form.fromSession', combo.locale))).toBeTruthy();
  });
});

describe('from the session screen', () => {
  it.each<RoleKind>(['venue', 'city', 'admin'])(
    'offers posters to a %s holder of the session',
    async (kind) => {
      const { nav } = renderScreen(
        <SessionScreen sessionId={ids.sessionDora} now={FIXTURE_NOW} />,
        {
          backend: createBackend({ me: meFor(kind) }),
        },
      );
      fireEvent.click(await screen.findByTestId('session-posters'));
      expect(nav.pushed).toEqual([routes.posters(ids.sessionDora)]);
    },
  );
});

describe('who sees what', () => {
  it.each<RoleKind>(['venue', 'city', 'admin'])(
    'lets a %s holder see and make the posters',
    async (kind) => {
      await open(createBackend({ me: meFor(kind) }));
      await settled('posters-list');
      expect(card(storyReady!)).toBeTruthy();
      expect(screen.getByTestId('poster-submit')).toBeTruthy();
    },
  );

  it('keeps a city coordinator out of another city: the session is not available', async () => {
    const backend = createBackend({ me: meFor('city') });
    await open(backend, ids.sessionLahore);
    expect(screen.getByTestId('posters-session-not-available')).toBeTruthy();
    expect(backend.calls.some((c) => c.endpoint.startsWith('adminPosters.'))).toBe(false);
  });

  it('asks nothing about posters when the roles do not reach the venue', async () => {
    // Even if the session itself could be read, the screen checks `poster.read` first.
    const backend = createBackend({
      me: meFor('venue'),
      handlers: {
        'adminSessions.get': () => ({
          ...fx.sessions[1]!,
          circleStatus: null,
        }),
      },
    });
    await open(backend, ids.sessionWomen);
    expect(screen.getByTestId('posters-forbidden').textContent).toBe(
      say('admin.posters.forbidden'),
    );
    expect(backend.calls.some((c) => c.endpoint.startsWith('adminPosters.'))).toBe(false);
  });

  it('shows a refused list plainly', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.list', 'forbidden');
    await open(backend);
    expect(screen.getByTestId('posters-list-forbidden').textContent).toBe(
      say('admin.posters.forbidden'),
    );
  });

  it('refuses, on the server, a poster of another city', async () => {
    // A Lahore poster slipped into the list: the server's own check refuses to regenerate it.
    const backend = createBackend({
      me: meFor('venue'),
      handlers: listOnly([view(lahoreLink!, { reasons: ['venue'] })]),
    });
    await open(backend);
    fireEvent.click(await screen.findByTestId(`poster-${lahoreLink!.id}-regenerate`));
    expect((await screen.findByTestId(`poster-${lahoreLink!.id}-error`)).textContent).toBe(
      say('admin.posters.error.forbiddenAction'),
    );
  });
});

describe('making posters', () => {
  it('sends the template, language, formats and title, then shows the queued posters', async () => {
    const { backend } = await open();
    fireEvent.click(screen.getByTestId('poster-template-night'));
    fireEvent.click(screen.getByTestId('poster-language'));
    fireEvent.click(await screen.findByTestId('poster-language-option-en'));
    await waitFor(() => expect(screen.queryByTestId('poster-title-ur')).toBeNull());
    fireEvent.click(screen.getByTestId('poster-format-print_a4'));
    fireEvent.click(screen.getByTestId('poster-format-link_preview'));
    typeInto('poster-title-en', 'Dora at Al-Noor');
    typeInto('poster-details-en', 'Sisters upstairs');
    fireEvent.click(screen.getByTestId('poster-accent-deep'));
    fireEvent.click(screen.getByTestId('poster-qr-session'));
    fireEvent.click(screen.getByTestId('poster-submit'));

    expect((await screen.findByTestId('poster-form-made')).textContent).toBe(
      '2 posters are being made. They appear in the list when they are ready.',
    );
    expect(backend.callsTo('adminPosters.create')[0]?.body).toEqual({
      templateKey: 'night',
      language: 'en',
      formats: ['story', 'link_preview'],
      fields: {
        title: { en: 'Dora at Al-Noor' },
        details: { en: 'Sisters upstairs' },
        accent: 'deep',
        qrTarget: 'session',
      },
    });
    expect(await screen.findByTestId(`poster-${fx.fixtureId('poster', 900)}`)).toBeTruthy();
    expect(screen.getByTestId(`poster-${fx.fixtureId('poster', 901)}-queued`)).toBeTruthy();
  });

  it('asks for the Urdu title before sending a bilingual poster', async () => {
    const { backend } = await open();
    typeInto('poster-title-ur', '');
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect(await screen.findByText(say('admin.posters.form.error.required'))).toBeTruthy();
    expect(backend.callsTo('adminPosters.create')).toHaveLength(0);
  });

  it('asks for a shorter title', async () => {
    const { backend } = await open();
    typeInto('poster-title-en', 'x'.repeat(81));
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect(await screen.findByText('Keep it to 80 characters or fewer.')).toBeTruthy();
    expect(backend.callsTo('adminPosters.create')).toHaveLength(0);
  });

  it('asks for at least one format', async () => {
    const { backend } = await open();
    fireEvent.click(screen.getByTestId('poster-format-story'));
    fireEvent.click(screen.getByTestId('poster-format-print_a4'));
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect((await screen.findByTestId('poster-formats-error')).textContent).toBe(
      say('admin.posters.form.error.formats'),
    );
    expect(backend.callsTo('adminPosters.create')).toHaveLength(0);
  });

  it('puts a server rejection on the field it names', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.create', 'validation_failed', {
      issues: [{ path: 'formats', code: 'invalid_value' }],
    });
    await open(backend);
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect((await screen.findByTestId('poster-formats-error')).textContent).toBe(
      say('admin.posters.form.error.notOffered'),
    );
    expect(screen.getByTestId('poster-form-refused').textContent).toContain(
      say('admin.posters.form.rejected'),
    );
  });

  it('says plainly when the person may not make posters here', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.create', 'forbidden');
    await open(backend);
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect((await screen.findByTestId('poster-form-refused')).textContent).toBe(
      say('admin.posters.error.notMade') + say('admin.posters.error.forbiddenAction'),
    );
  });

  it('says when the template has gone, and loads the templates again', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.create', 'not_found');
    await open(backend);
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect((await screen.findByTestId('poster-form-refused')).textContent).toContain(
      say('admin.posters.error.templateGone'),
    );
    await waitFor(() => expect(backend.callsTo('adminPosters.templates')).toHaveLength(2));
  });

  it('shows a conflict answer plainly', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.create', 'conflict');
    await open(backend);
    fireEvent.click(screen.getByTestId('poster-submit'));
    expect((await screen.findByTestId('poster-form-refused')).textContent).toContain(
      say('admin.posters.error.createConflict'),
    );
  });

  it('puts a failed poster back in the form so the title can be shortened', async () => {
    await open();
    await settled('posters-list');
    fireEvent.click(screen.getByTestId(`poster-${failedStory!.id}-edit`));
    expect(await screen.findByTestId('poster-form-editing')).toBeTruthy();
    const urTitle = screen.getByTestId('poster-title-ur');
    const input = (urTitle.tagName === 'INPUT' ? urTitle : urTitle.querySelector('input'))!;
    expect((input as HTMLInputElement).value).toBe(failedStory!.fields.title.ur);
    expect(screen.queryByTestId('poster-title-en')).toBeNull();
  });
});

describe('regenerating', () => {
  const outOfDate = (reasons: ('time' | 'venue')[]) =>
    listOnly([view(storyReady!), view(a4Old!, { reasons })]);

  it('regenerates an out-of-date poster', async () => {
    const backend = createBackend({ me: meFor('city'), handlers: outOfDate(['time']) });
    await open(backend);
    fireEvent.click(await screen.findByTestId(`poster-${a4Old!.id}-regenerate`));
    await waitFor(() => expect(backend.callsTo('adminPosters.regenerate')).toHaveLength(1));
    expect(backend.callsTo('adminPosters.regenerate')[0]?.path).toBe(
      `/v1/admin/posters/${a4Old!.id}/regenerate`,
    );
    // The new one is queued, and the old one now waits for it.
    expect(
      (await screen.findByTestId(`poster-${fx.fixtureId('poster', 950)}-queued`)).textContent,
    ).toBe(say('admin.posters.queued.again'));
    expect(screen.getByTestId(`poster-${a4Old!.id}-out-of-date`).textContent).toContain(
      say('admin.posters.replacing'),
    );
    expect(screen.queryByTestId(`poster-${a4Old!.id}-regenerate`)).toBeNull();
  });

  it('names the venue, or both, when they changed', async () => {
    await open(createBackend({ me: meFor('venue'), handlers: outOfDate(['venue']) }));
    expect((await screen.findByTestId(`poster-${a4Old!.id}-out-of-date`)).textContent).toContain(
      say('admin.posters.outOfDate.venue'),
    );
  });

  it('names both when both changed', async () => {
    await open(createBackend({ me: meFor('venue'), handlers: outOfDate(['time', 'venue']) }));
    expect((await screen.findByTestId(`poster-${a4Old!.id}-out-of-date`)).textContent).toContain(
      say('admin.posters.outOfDate.both'),
    );
  });

  it('says a poster is still being made when regenerating answers conflict', async () => {
    const backend = createBackend({ me: meFor('venue'), handlers: outOfDate(['time']) });
    backend.failWith('adminPosters.regenerate', 'conflict');
    await open(backend);
    fireEvent.click(await screen.findByTestId(`poster-${a4Old!.id}-regenerate`));
    expect((await screen.findByTestId(`poster-${a4Old!.id}-error`)).textContent).toBe(
      say('admin.posters.error.regenerateConflict'),
    );
  });

  it('retries a poster that failed because the renderer was busy', async () => {
    const busy = view({ ...failedStory!, failureCode: 'busy' });
    const backend = createBackend({ me: meFor('venue'), handlers: listOnly([busy]) });
    await open(backend);
    expect((await screen.findByTestId(`poster-${busy.id}-failure`)).textContent).toBe(
      say('admin.posters.failure.busy'),
    );
    const retry = screen.getByTestId(`poster-${busy.id}-regenerate`);
    expect(retry.textContent).toContain(say('admin.posters.retry'));
    fireEvent.click(retry);
    await waitFor(() => expect(backend.callsTo('adminPosters.regenerate')).toHaveLength(1));
  });
});

describe('downloading', () => {
  it('downloads a ready poster as a file', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
    const { backend } = await open();
    await settled('posters-list');
    const button = screen.getByTestId(`poster-${storyReady!.id}-download`);
    expect(button.textContent).toContain(say('admin.posters.download.png'));
    fireEvent.click(button);
    expect((await screen.findByTestId(`poster-${storyReady!.id}-notice`)).textContent).toBe(
      say('admin.posters.downloaded'),
    );
    expect(backend.callsTo('adminPosters.file')).toHaveLength(1);
    expect((created.mock.calls[0]?.[0] as Blob).type).toBe('image/png');
    expect(screen.getByTestId(`poster-${a4Old!.id}-download`).textContent).toContain(
      say('admin.posters.download.pdf'),
    );
  });

  it('says a poster is not ready when the download answers conflict', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.file', 'conflict');
    await open(backend);
    await settled('posters-list');
    fireEvent.click(screen.getByTestId(`poster-${storyReady!.id}-download`));
    expect((await screen.findByTestId(`poster-${storyReady!.id}-error`)).textContent).toBe(
      say('admin.posters.error.downloadConflict'),
    );
  });

  it('offers no download for a queued or failed poster', async () => {
    await open();
    await settled('posters-list');
    expect(screen.queryByTestId(`poster-${queuedA4!.id}-download`)).toBeNull();
    expect(screen.queryByTestId(`poster-${failedStory!.id}-download`)).toBeNull();
  });

  it('opens a signed link on a phone, or says to use the console', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    try {
      expect(saveRouteFor('https://files.example.test/poster.png?sig=abc')).toBe('link');
      expect(saveRouteFor('/v1/admin/posters/x/file')).toBe('none');
      expect(saveRouteFor(null)).toBe('none');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
    expect(saveRouteFor('/v1/admin/posters/x/file')).toBe('browser');
  });
});

describe('the list', () => {
  it('asks again while a poster is being made', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const { backend } = await open();
    await settled('posters-list');
    await waitFor(() =>
      expect(intervals.mock.calls.some((c) => c[1] === POSTER_POLL_MS)).toBe(true),
    );
    const poll = intervals.mock.calls.find((c) => c[1] === POSTER_POLL_MS)!;
    const before = backend.callsTo('adminPosters.list').length;
    (poll[0] as () => void)();
    await waitFor(() => expect(backend.callsTo('adminPosters.list').length).toBe(before + 1));
  });

  it('does not ask again when nothing is being made', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    await open(createBackend({ me: meFor('venue'), handlers: listOnly([view(storyReady!)]) }));
    await settled('posters-list');
    expect(intervals.mock.calls.some((c) => c[1] === POSTER_POLL_MS)).toBe(false);
  });

  it('says when there are no posters yet', async () => {
    await open(createBackend({ me: meFor('venue'), handlers: listOnly([]) }));
    expect(await screen.findByTestId('posters-empty')).toBeTruthy();
  });

  it('shows a failed list with a way to try again', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminPosters.list', 'internal_error');
    await open(backend);
    const error = await screen.findByTestId('posters-list-error');
    fireEvent.click(within(error).getByRole('button'));
    expect(await screen.findByTestId(`poster-${storyReady!.id}`)).toBeTruthy();
  });
});
