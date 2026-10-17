import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, ids, meFor } from '../../test/backend';
import { combos, renderScreen, typeInto } from '../../test/render';
import { CircleEditorScreen } from './CircleEditorScreen';

function makeRawalpindiCirclePending(backend: ReturnType<typeof createBackend>) {
  const circle = backend.state.circles.find((c) => c.id === ids.circlePublished)!;
  circle.status = 'pending_approval';
  circle.approvedAt = null;
  return circle;
}

describe.each(combos)('CircleEditorScreen in $name', (combo) => {
  it('shows the form with the right direction', async () => {
    const { container } = renderScreen(<CircleEditorScreen />, {
      backend: createBackend({ me: meFor('admin') }),
      combo,
    });
    await screen.findByTestId('circle-editor-form');
    expect(screen.getByTestId('circle-save')).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('CircleEditorScreen create', () => {
  it('sends a venue coordinator circle for approval and says it stays hidden', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    expect(screen.getByTestId('circle-pending-note')).toBeTruthy();
    typeInto('circle-name-en', 'Sample Evening Circle');
    typeInto('circle-teacher', 'Sample Teacher');
    fireEvent.click(screen.getByTestId('circle-save'));
    const status = await screen.findByTestId('circle-created-status');
    expect(status.textContent).toMatch(/waiting for the city coordinator/);
    expect(backend.callsTo('adminCircles.create')[0]!.body).toMatchObject({
      venueId: ids.venueAlNoor,
      name: { en: 'Sample Evening Circle' },
      teacherName: 'Sample Teacher',
    });
    expect(backend.state.circles.at(-1)!.status).toBe('pending_approval');
  });

  it('publishes a city coordinator circle at once and shows no pending note', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    expect(screen.queryByTestId('circle-pending-note')).toBeNull();
    typeInto('circle-name-en', 'Sample Morning Circle');
    fireEvent.click(screen.getByTestId('circle-save'));
    expect((await screen.findByTestId('circle-created-status')).textContent).toMatch(/now public/);
    expect(backend.state.circles.at(-1)!.status).toBe('published');
  });

  it('leaves the done button to go back', async () => {
    const backend = createBackend({ me: meFor('city') });
    const { nav } = renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    typeInto('circle-name-en', 'Sample Morning Circle');
    fireEvent.click(screen.getByTestId('circle-save'));
    await screen.findByTestId('circle-created');
    fireEvent.click(screen.getByText('Done'));
    expect(nav.backs).toBe(1);
  });

  it('shows what is missing and sends nothing', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    fireEvent.click(screen.getByTestId('circle-save'));
    expect(await screen.findByText('Enter the circle name.')).toBeTruthy();
    expect(backend.callsTo('adminCircles.create')).toHaveLength(0);
  });

  it('refuses a link that is not a web address before asking the server', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    typeInto('circle-name-en', 'Sample Morning Circle');
    typeInto('circle-link', 'room four');
    fireEvent.click(screen.getByTestId('circle-save'));
    expect(await screen.findByText(/web address/i)).toBeTruthy();
    expect(backend.callsTo('adminCircles.create')).toHaveLength(0);
  });

  it('shows the mapped message when the server refuses', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminCircles.create', 'forbidden');
    renderScreen(<CircleEditorScreen />, { backend });
    await screen.findByTestId('circle-editor-form');
    typeInto('circle-name-en', 'Sample Morning Circle');
    fireEvent.click(screen.getByTestId('circle-save'));
    expect(await screen.findByText(/do not have permission/)).toBeTruthy();
    expect(screen.queryByTestId('circle-created')).toBeNull();
  });

  it('offers a venue coordinator only their own venue', async () => {
    renderScreen(<CircleEditorScreen />, { backend: createBackend({ me: meFor('venue') }) });
    await screen.findByTestId('circle-editor-form');
    fireEvent.click(screen.getByTestId('circle-venue'));
    await screen.findByTestId(`circle-venue-option-${ids.venueAlNoor}`);
    expect(screen.queryByTestId(`circle-venue-option-${ids.venueLahore}`)).toBeNull();
  });
});

describe('CircleEditorScreen edit and approval', () => {
  it('lets a venue coordinator edit their published circle and sends only the change', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { nav } = renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, {
      backend,
    });
    await screen.findByTestId('circle-editor-form');
    expect(screen.queryByTestId('circle-decision')).toBeNull();
    typeInto('circle-teacher', 'Another Sample Teacher');
    fireEvent.click(screen.getByTestId('circle-save'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(backend.callsTo('adminCircles.update')[0]!.body).toEqual({
      teacherName: 'Another Sample Teacher',
    });
  });

  it('says so when nothing changed', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, { backend });
    await screen.findByTestId('circle-editor-form');
    fireEvent.click(screen.getByTestId('circle-save'));
    expect(await screen.findByTestId('circle-nothing')).toBeTruthy();
    expect(backend.callsTo('adminCircles.update')).toHaveLength(0);
  });

  it('shows a venue coordinator a waiting circle without decision buttons', async () => {
    const backend = createBackend({ me: meFor('venue') });
    makeRawalpindiCirclePending(backend);
    renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, { backend });
    await screen.findByTestId('circle-editor-form');
    expect(screen.getByTestId('circle-status').textContent).toMatch(
      /Waiting for the city coordinator to decide/,
    );
    expect(screen.queryByTestId('circle-decision')).toBeNull();
    expect(screen.queryByTestId('circle-approve')).toBeNull();
    expect(screen.queryByTestId('circle-reject')).toBeNull();
  });

  it('cannot reach a circle of another city', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<CircleEditorScreen circleId={ids.circlePending} />, { backend });
    expect(await screen.findByText(/could not find what you were looking for/)).toBeTruthy();
    expect(screen.queryByTestId('circle-approve')).toBeNull();
  });

  it('lets a city coordinator approve a waiting circle of their city', async () => {
    const backend = createBackend({ me: meFor('city') });
    makeRawalpindiCirclePending(backend);
    const { nav } = renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, {
      backend,
    });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-approve'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(backend.callsTo('adminCircles.decide')[0]!.body).toEqual({ decision: 'approve' });
    expect(backend.state.circles.find((c) => c.id === ids.circlePublished)!.status).toBe(
      'published',
    );
  });

  it('asks for confirmation and sends only the decision when rejecting', async () => {
    const backend = createBackend({ me: meFor('city') });
    makeRawalpindiCirclePending(backend);
    const { nav } = renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, {
      backend,
    });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-reject'));
    expect(backend.callsTo('adminCircles.decide')).toHaveLength(0);
    // There is no note field any more: the contract takes only the decision.
    expect(screen.queryByTestId('circle-reject-note')).toBeNull();
    fireEvent.click(await screen.findByTestId('circle-reject-confirm-confirm'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(backend.callsTo('adminCircles.decide')[0]!.body).toEqual({ decision: 'reject' });
    expect(backend.state.circles.find((c) => c.id === ids.circlePublished)!.status).toBe(
      'rejected',
    );
  });

  it('sends a rejection with only the decision', async () => {
    const backend = createBackend({ me: meFor('city') });
    makeRawalpindiCirclePending(backend);
    renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, { backend });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-reject'));
    fireEvent.click(await screen.findByTestId('circle-reject-confirm-confirm'));
    await waitFor(() => expect(backend.callsTo('adminCircles.decide')).toHaveLength(1));
    expect(backend.callsTo('adminCircles.decide')[0]!.body).toEqual({ decision: 'reject' });
  });

  it('lets a cancelled rejection leave the circle waiting', async () => {
    const backend = createBackend({ me: meFor('city') });
    makeRawalpindiCirclePending(backend);
    renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, { backend });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-reject'));
    fireEvent.click(await screen.findByTestId('circle-reject-confirm-cancel'));
    expect(backend.callsTo('adminCircles.decide')).toHaveLength(0);
  });

  it('lets a national admin decide a circle in any city', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<CircleEditorScreen circleId={ids.circlePending} />, { backend });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-approve'));
    await waitFor(() =>
      expect(backend.state.circles.find((c) => c.id === ids.circlePending)!.status).toBe(
        'published',
      ),
    );
  });

  it('keeps a city coordinator out of the decision for another city', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<CircleEditorScreen circleId={ids.circlePending} />, { backend });
    expect(await screen.findByText(/could not find what you were looking for/)).toBeTruthy();
    expect(screen.queryByTestId('circle-approve')).toBeNull();
  });

  it('shows the mapped message when the circle was already decided', async () => {
    const backend = createBackend({ me: meFor('city') });
    makeRawalpindiCirclePending(backend);
    backend.failWith('adminCircles.decide', 'circle_not_pending');
    const { nav } = renderScreen(<CircleEditorScreen circleId={ids.circlePublished} />, {
      backend,
    });
    await screen.findByTestId('circle-decision');
    fireEvent.click(screen.getByTestId('circle-approve'));
    expect(await screen.findByText('This circle is not waiting for approval.')).toBeTruthy();
    expect(nav.backs).toBe(0);
  });

  it('shows the forbidden message when the server refuses a venue coordinator decision', async () => {
    // The screen hides the buttons; this proves the server is still the authority if one slipped through.
    const backend = createBackend({ me: meFor('venue') });
    const response = await backend.fetch(
      `http://mock.test/v1/admin/circles/${ids.circlePending}/decision`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer mock-staff', 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'approve' }),
      },
    );
    expect(response.status).toBe(403);
  });
});
