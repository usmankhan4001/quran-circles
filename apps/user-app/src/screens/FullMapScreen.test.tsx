import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { CITY_RAWALPINDI, SESSIONS } from '../test/factories';
import { MATRIX, directionOf, renderScreen, waitFor } from '../test/harness';
import { FullMapScreen } from './FullMapScreen';

const en = messages.en;
const ur = messages.ur;

describe('FullMapScreen', () => {
  it('is the map with a close button, a search field, chips and a locate button', async () => {
    const view = await renderScreen(<FullMapScreen />, { cityId: CITY_RAWALPINDI.id });
    expect(view.getByTestId('full-map-screen')).toBeTruthy();
    for (const id of [
      'full-map-close',
      'full-map-search',
      'full-map-tonight',
      'full-map-section-women',
      'full-map-locate',
    ]) {
      expect(view.getByTestId(id)).toBeTruthy();
    }
    fireEvent.click(view.getByTestId('full-map-close'));
    expect(view.world.nav.last()).toEqual({ type: 'back' });
  });

  it('opens on the chosen venue with its card, Join and Details', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<FullMapScreen venueId={s.venueId} />, {
      cityId: CITY_RAWALPINDI.id,
    });
    expect(await view.findByTestId('map-selection')).toBeTruthy();
    fireEvent.click(view.getByTestId(`map-open-${s.id}`));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: s.id },
    });
  });

  it('selects a pin and filters by section', async () => {
    const view = await renderScreen(<FullMapScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(await view.findByTestId(`map-marker-${SESSIONS.taraweeh.venueId}`));
    expect(await view.findByTestId('map-selection')).toBeTruthy();
    fireEvent.click(view.getByTestId('full-map-section-women'));
    await waitFor(() => {
      const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
      expect(new URLSearchParams(last.search).get('section')).toBe('women');
    });
  });

  it('opens the area picker from the locate button, without asking for the phone location', async () => {
    const view = await renderScreen(<FullMapScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(view.getByTestId('full-map-locate'));
    expect(await view.findByTestId(`area-city-${CITY_RAWALPINDI.id}`)).toBeTruthy();
  });

  it.each(MATRIX)('draws in $name', async ({ locale, color, textSize }) => {
    const view = await renderScreen(<FullMapScreen />, {
      locale,
      color,
      textSize,
      cityId: CITY_RAWALPINDI.id,
    });
    expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    const words = locale === 'ur' ? ur : en;
    expect(view.getByLabelText(words['map.close'])).toBeTruthy();
    expect(view.getByLabelText(words['map.locate'])).toBeTruthy();
  });
});
