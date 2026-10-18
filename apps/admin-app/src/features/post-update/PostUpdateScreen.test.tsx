import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, ids, meFor } from '../../test/backend';
import { combos, renderScreen, settled, typeInto } from '../../test/render';
import { PostUpdateScreen } from './PostUpdateScreen';

const sentBody = (backend: ReturnType<typeof createBackend>) =>
  backend.callsTo('adminUpdates.post')[0]?.body as Record<string, unknown>;

/** A short debounce so the tests do not wait long for the recipient count. */
const FAST = 10;

/** Presses send on the review step, then confirms in the sheet. */
async function sendAndConfirm() {
  fireEvent.click(await screen.findByTestId('post-update-send'));
  fireEvent.click(await screen.findByTestId('post-update-confirm-confirm'));
}

describe.each(combos)('PostUpdateScreen in $name', (combo) => {
  it('shows the compose step with the audience, title, message and notify switch', async () => {
    const { container } = renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await settled('post-update-data');
    expect(await screen.findByTestId('post-update-compose')).toBeTruthy();
    expect(screen.getByTestId('post-update-title-en')).toBeTruthy();
    expect(screen.getByTestId('post-update-body-en')).toBeTruthy();
    expect(screen.getByTestId('post-update-notify')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('PostUpdateScreen flow', () => {
  it('writes, previews with the audience, sends and reads the recipient count back', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { nav } = renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-en', 'Parking changed');
    typeInto('post-update-body-en', 'Please use the side road from tonight.');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    expect(await screen.findByTestId('post-update-preview-step')).toBeTruthy();
    // Before anything is sent, the preview says who will see it and that they are notified.
    expect(screen.getByTestId('post-update-reach').textContent).toMatch(
      /follow Sample Masjid Al-Noor/,
    );
    expect(screen.getByText(/also get a notification/)).toBeTruthy();
    expect(backend.callsTo('adminUpdates.post')).toHaveLength(0);
    await sendAndConfirm();
    expect((await screen.findByTestId('post-update-recipients')).textContent).toBe(
      'Sent to 37 people',
    );
    expect(sentBody(backend)).toMatchObject({
      scope: { type: 'venue', venueId: ids.venueAlNoor },
      title: { en: 'Parking changed' },
      body: { en: 'Please use the side road from tonight.' },
      notify: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(nav.backs).toBe(1);
  });

  it('can turn the notification off so the update is feed-only', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-en', 'Reminder');
    typeInto('post-update-body-en', 'See you tomorrow.');
    fireEvent.click(screen.getByTestId('post-update-notify'));
    fireEvent.click(screen.getByTestId('post-update-preview'));
    expect(await screen.findByText(/feed only/i)).toBeTruthy();
    await sendAndConfirm();
    await screen.findByTestId('post-update-recipients');
    expect(sentBody(backend)).toMatchObject({ notify: false });
  });

  it('keeps Urdu-only text and sends it as the required English text too', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-ur', 'پارکنگ بدل گئی');
    typeInto('post-update-body-ur', 'آج رات سے ساتھ والی سڑک استعمال کریں۔');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    await screen.findByTestId('post-update-recipients');
    const body = sentBody(backend) as { title: { en: string; ur?: string } };
    expect(body.title.en).toBe('پارکنگ بدل گئی');
    expect(body.title.ur).toBe('پارکنگ بدل گئی');
  });

  it('asks for a title and a message before previewing', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    expect(await screen.findByText('Write a title.')).toBeTruthy();
    expect(screen.getByText('Write a message.')).toBeTruthy();
    expect(screen.queryByTestId('post-update-preview-step')).toBeNull();
  });

  it('starts from an approved template and asks for its blanks', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen sessionId={ids.sessionDora} previewDelayMs={FAST} />, {
      backend,
    });
    await screen.findByTestId('post-update-compose');
    fireEvent.click(await screen.findByTestId('post-update-template-time_change'));
    // Draft-only templates are never offered.
    expect(screen.queryByTestId('post-update-template-draft_only')).toBeNull();
    typeInto('post-update-var-time', '8 pm');
    expect((screen.getByTestId('post-update-body-en') as HTMLInputElement).value).toBe(
      'The session now starts at 8 pm.',
    );
    typeInto('post-update-title-en', 'Time change');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    await screen.findByTestId('post-update-recipients');
    expect(sentBody(backend)).toMatchObject({
      templateKey: 'time_change',
      sessionId: ids.sessionDora,
    });
  });

  it('refuses a template with an empty blank', async () => {
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await screen.findByTestId('post-update-compose');
    fireEvent.click(await screen.findByTestId('post-update-template-time_change'));
    typeInto('post-update-title-en', 'Time change');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    expect(await screen.findByText('Fill in all the blanks of the template.')).toBeTruthy();
  });

  it('shows the mapped error when sending fails, and keeps the text', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminUpdates.post', 'rate_limited');
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-en', 'Reminder');
    typeInto('post-update-body-en', 'See you tomorrow.');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    expect(await screen.findByText(/Too many tries/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('post-update-edit'));
    expect((screen.getByTestId('post-update-body-en') as HTMLInputElement).value).toBe(
      'See you tomorrow.',
    );
  });

  it('opens about the session when started from one', async () => {
    renderScreen(<PostUpdateScreen sessionId={ids.sessionDora} previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await screen.findByTestId('post-update-compose');
    expect(screen.getByText('About this session')).toBeTruthy();
    expect(screen.getByText(/Taraweeh with Dora/)).toBeTruthy();
  });
});

describe('PostUpdateScreen by role', () => {
  it('offers a venue coordinator only their venue', async () => {
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('venue') }),
    });
    await screen.findByTestId('post-update-compose');
    expect(screen.queryByRole('radio', { name: 'Everyone' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'A city' })).toBeNull();
    expect(screen.queryByTestId('post-update-city')).toBeNull();
  });

  it('offers a city coordinator their city and its venues, never everyone', async () => {
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await screen.findByTestId('post-update-compose');
    expect(screen.queryByRole('radio', { name: 'Everyone' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'A city' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A venue' })).toBeTruthy();
  });

  it('offers a national admin everyone, a city and a venue', async () => {
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('admin') }),
    });
    await screen.findByTestId('post-update-compose');
    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A city' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A venue' })).toBeTruthy();
  });

  it('lets a national admin post to everyone', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    fireEvent.click(screen.getByRole('radio', { name: 'Everyone' }));
    typeInto('post-update-title-en', 'Ramadan timings');
    typeInto('post-update-body-en', 'Timings are updated.');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    expect((await screen.findByTestId('post-update-recipients')).textContent).toBe(
      'Sent to 1200 people',
    );
    expect(sentBody(backend)).toMatchObject({ scope: { type: 'national' } });
  });

  it('shows the server refusal if a post is ever sent outside the role', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminUpdates.post', 'forbidden');
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-en', 'x');
    typeInto('post-update-body-en', 'y');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    await waitFor(() => expect(screen.getByText(/do not have permission/i)).toBeTruthy());
  });
});

describe('PostUpdateScreen recipient count', () => {
  const writeDraft = () => {
    typeInto('post-update-title-en', 'Parking changed');
    typeInto('post-update-body-en', 'Please use the side road from tonight.');
  };

  it('counts who it will reach before the confirm sheet, and never sends while counting', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    // No complete draft yet, so nothing is asked.
    expect(backend.callsTo('adminUpdates.preview')).toHaveLength(0);
    writeDraft();
    expect((await screen.findByTestId('post-update-count')).textContent).toBe(
      'This will reach 37 people',
    );
    const preview = backend.callsTo('adminUpdates.preview');
    expect(preview).toHaveLength(1);
    expect(preview[0]!.body).toMatchObject({
      scope: { type: 'venue', venueId: ids.venueAlNoor },
      title: { en: 'Parking changed' },
      body: { en: 'Please use the side road from tonight.' },
    });
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await screen.findByTestId('post-update-preview-step');
    expect(screen.getByTestId('post-update-count').textContent).toBe('This will reach 37 people');
    fireEvent.click(screen.getByTestId('post-update-send'));
    expect(await screen.findByText('Send to 37 people?')).toBeTruthy();
    expect(screen.getByText('You cannot take it back after it is sent.')).toBeTruthy();
    expect(backend.callsTo('adminUpdates.post')).toHaveLength(0);
  });

  it('asks only once the audience stops changing, and only for the last one', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<PostUpdateScreen previewDelayMs={300} />, { backend });
    await screen.findByTestId('post-update-compose');
    fireEvent.click(screen.getByRole('radio', { name: 'Everyone' }));
    writeDraft();
    typeInto('post-update-body-en', 'Please use the side road from tomorrow.');
    fireEvent.click(screen.getByRole('radio', { name: 'A city' }));
    expect(await screen.findByTestId('post-update-counting')).toBeTruthy();
    expect(
      (await screen.findByTestId('post-update-count', {}, { timeout: 2000 })).textContent,
    ).toBe('This will reach 140 people');
    const calls = backend.callsTo('adminUpdates.preview');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({
      scope: { type: 'city' },
      body: { en: 'Please use the side road from tomorrow.' },
    });
  });

  it('does not ask again while only the words change', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    await screen.findByTestId('post-update-count');
    typeInto('post-update-body-en', 'Another wording.');
    typeInto('post-update-title-en', 'Another title');
    await new Promise((r) => setTimeout(r, 50));
    expect(backend.callsTo('adminUpdates.preview')).toHaveLength(1);
  });

  it('shows the final count from the post, not the estimate', async () => {
    const backend = createBackend({
      me: meFor('venue'),
      handlers: { 'adminUpdates.preview': () => ({ recipients: 35 }) },
    });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    expect((await screen.findByTestId('post-update-count')).textContent).toBe(
      'This will reach 35 people',
    );
    fireEvent.click(screen.getByTestId('post-update-preview'));
    fireEvent.click(await screen.findByTestId('post-update-send'));
    expect(await screen.findByText('Send to 35 people?')).toBeTruthy();
    fireEvent.click(screen.getByTestId('post-update-confirm-confirm'));
    expect((await screen.findByTestId('post-update-recipients')).textContent).toBe(
      'Sent to 37 people',
    );
    expect(backend.callsTo('adminUpdates.post')).toHaveLength(1);
  });

  it('says one person in the singular', async () => {
    const backend = createBackend({
      me: meFor('venue'),
      handlers: { 'adminUpdates.preview': () => ({ recipients: 1 }) },
    });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    expect((await screen.findByTestId('post-update-count')).textContent).toBe(
      'This will reach 1 person',
    );
  });

  it('still lets the update go when the count cannot be read', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminUpdates.preview', 'service_unavailable', { times: 5 });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    await waitFor(() => expect(backend.callsTo('adminUpdates.preview')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('post-update-counting')).toBeNull());
    expect(screen.queryByTestId('post-update-count')).toBeNull();
    fireEvent.click(screen.getByTestId('post-update-preview'));
    fireEvent.click(await screen.findByTestId('post-update-send'));
    expect(await screen.findByText('Send this update?')).toBeTruthy();
    fireEvent.click(screen.getByTestId('post-update-confirm-confirm'));
    expect((await screen.findByTestId('post-update-recipients')).textContent).toBe(
      'Sent to 37 people',
    );
  });

  it('sends nothing when the confirm sheet is cancelled', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    fireEvent.click(screen.getByTestId('post-update-preview'));
    fireEvent.click(await screen.findByTestId('post-update-send'));
    fireEvent.click(await screen.findByTestId('post-update-confirm-cancel'));
    expect(backend.callsTo('adminUpdates.post')).toHaveLength(0);
    expect(screen.getByTestId('post-update-preview-step')).toBeTruthy();
  });

  it('marks the field the server rejected and goes back to the form', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminUpdates.post', 'validation_failed', {
      issues: [{ path: 'title.en', code: 'too_big' }],
    });
    renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, { backend });
    await screen.findByTestId('post-update-compose');
    writeDraft();
    fireEvent.click(screen.getByTestId('post-update-preview'));
    await sendAndConfirm();
    await screen.findByTestId('post-update-compose');
    expect(await screen.findByText('This was not accepted. Check it and try again.')).toBeTruthy();
    expect((screen.getByTestId('post-update-title-en') as HTMLInputElement).value).toBe(
      'Parking changed',
    );
  });
});

describe.each(combos)('PostUpdateScreen count and confirm in $name', (combo) => {
  it('shows the count and the confirm sheet in the right direction', async () => {
    const { container } = renderScreen(<PostUpdateScreen previewDelayMs={FAST} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await screen.findByTestId('post-update-compose');
    typeInto('post-update-title-en', 'Parking changed');
    typeInto('post-update-body-en', 'Please use the side road.');
    await screen.findByTestId('post-update-count');
    fireEvent.click(screen.getByTestId('post-update-preview'));
    fireEvent.click(await screen.findByTestId('post-update-send'));
    expect(await screen.findByTestId('post-update-confirm-confirm')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});
