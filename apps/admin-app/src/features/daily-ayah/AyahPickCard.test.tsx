import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { routes } from '../../navigation/routes';
import { createBackend, ids, meFor, type RoleKind } from '../../test/backend';
import { combos, renderScreen } from '../../test/render';
import { CircleEditorScreen } from '../circles/CircleEditorScreen';
import { VenueEditorScreen } from '../venues/VenueEditorScreen';
import { AyahPickCard } from './AyahPickCard';
import type { AyahPlace } from './pick';

const iqra = fx.venues[1]!;
const circleAlNoor = fx.circles[0]!;
const lahorePlace: AyahPlace = {
  type: 'venue',
  venueId: ids.venueLahore,
  cityId: ids.cityLahore,
  name: { en: 'Sample Masjid Bilal', ur: null },
};

describe('the way in from a venue page', () => {
  it.each<[RoleKind, string]>([
    ['venue', ids.venueAlNoor],
    ['city', ids.venueAlNoor],
    ['city', iqra.id],
    ['admin', ids.venueLahore],
    ['multi', ids.venueLahore],
  ])('%s sees it on venue %s and it opens the pick', async (kind, venueId) => {
    const { nav } = renderScreen(<VenueEditorScreen venueId={venueId} />, {
      backend: createBackend({ me: meFor(kind) }),
    });
    fireEvent.click(await screen.findByTestId('ayah-pick-open'));
    expect(nav.pushed).toEqual([routes.dailyAyah({ venueId })]);
    expect(nav.pushed[0]).toBe(`/daily-ayah?venueId=${venueId}`);
  });

  it('is hidden when the flag is off', async () => {
    const backend = createBackend({ me: meFor('venue'), flags: { ayah_of_the_day: false } });
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId('venue-editor-form');
    await waitFor(() => expect(backend.callsTo('config.get')).toHaveLength(1));
    expect(screen.queryByTestId('ayah-pick-card')).toBeNull();
  });

  it('is hidden when the flag cannot be read', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('config.get', 'internal_error');
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId('venue-editor-form');
    await waitFor(() => expect(backend.callsTo('config.get')).toHaveLength(1));
    expect(screen.queryByTestId('ayah-pick-card')).toBeNull();
  });

  it('is not offered while creating a venue', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<VenueEditorScreen />, { backend });
    await screen.findByTestId('venue-editor-form');
    expect(screen.queryByTestId('ayah-pick-card')).toBeNull();
    expect(backend.callsTo('config.get')).toHaveLength(0);
  });
});

describe('the way in from a circle page', () => {
  it.each<RoleKind>(['venue', 'city', 'admin'])(
    '%s sees it and it opens the pick',
    async (kind) => {
      const { nav } = renderScreen(<CircleEditorScreen circleId={circleAlNoor.id} />, {
        backend: createBackend({ me: meFor(kind) }),
      });
      fireEvent.click(await screen.findByTestId('ayah-pick-open'));
      expect(nav.pushed).toEqual([`/daily-ayah?circleId=${circleAlNoor.id}`]);
      expect(
        screen.getByText('Choose the ayah that people who follow this circle see each day.'),
      ).toBeTruthy();
    },
  );

  it('is not offered on an archived circle', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.state.circles[0]!.status = 'archived';
    renderScreen(<CircleEditorScreen circleId={circleAlNoor.id} />, { backend });
    await screen.findByTestId('circle-editor-form');
    expect(screen.queryByTestId('ayah-pick-card')).toBeNull();
  });
});

describe.each(combos)('AyahPickCard in $name', (combo) => {
  it('shows the title and the action', async () => {
    const { container } = renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    const card = await screen.findByTestId('ayah-pick-card');
    expect(card.textContent).toContain(combo.locale === 'en' ? 'Ayah of the day' : 'آج کی آیت');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('AyahPickCard on its own', () => {
  it.each<RoleKind>(['venue', 'city'])(
    'shows nothing to a %s outside the place and never asks for the flag',
    async (kind) => {
      const backend = createBackend({ me: meFor(kind) });
      renderScreen(<AyahPickCard place={lahorePlace} />, { backend });
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByTestId('ayah-pick-card')).toBeNull();
      expect(backend.callsTo('config.get')).toHaveLength(0);
    },
  );

  it('asks for the flag of the place’s city', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<AyahPickCard place={lahorePlace} />, { backend });
    await screen.findByTestId('ayah-pick-card');
    expect(backend.callsTo('config.get')[0]!.query).toEqual({ cityId: ids.cityLahore });
  });
});
