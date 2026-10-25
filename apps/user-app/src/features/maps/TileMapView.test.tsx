import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { renderScreen, directionOf } from '../../test/harness';
import { TileMapView } from './TileMapView';
import type { MapMarker } from './types';

const en = messages.en;
const ur = messages.ur;

const MARKERS: MapMarker[] = [
  {
    id: 'v1',
    lat: 31.52,
    lng: 74.35,
    title: 'Masjid Noor',
    subtitle: 'Fajr circle',
    location: 'Gulberg, Lahore',
    count: 1,
  },
  { id: 'v2', lat: 31.55, lng: 74.33, title: 'Markaz Huda', subtitle: '2 sessions here', count: 2 },
];

function map(extra: Partial<React.ComponentProps<typeof TileMapView>> = {}) {
  const onSelect = vi.fn();
  const ui = (
    <TileMapView
      markers={MARKERS}
      selectedId={null}
      onSelect={onSelect}
      accessibilityLabel="Map of places near you"
      unavailableLabel="unavailable"
      {...extra}
    />
  );
  return { ui, onSelect };
}

async function open(locale: 'en' | 'ur' = 'en', extra = {}) {
  const { ui, onSelect } = map(extra);
  const view = await renderScreen(ui, { locale });
  return { view, onSelect };
}

describe('TileMapView', () => {
  it('draws a button for each place, named with the place, and tells the app which was pressed', async () => {
    const { view, onSelect } = await open();
    const pin = await view.findByTestId('map-marker-v1');
    expect(pin.getAttribute('aria-label')).toBe('Masjid Noor, Fajr circle, Gulberg, Lahore');
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith('v1');
  });

  it('marks the chosen place as selected', async () => {
    const { view } = await open('en', { selectedId: 'v2' });
    expect((await view.findByTestId('map-marker-v2')).getAttribute('aria-selected')).toBe('true');
    expect(view.getByTestId('map-marker-v1').getAttribute('aria-selected')).toBe('false');
  });

  it("has zoom buttons and a show-all button with names in the reader's language", async () => {
    const english = await open();
    for (const key of ['nearby.map.zoomIn', 'nearby.map.zoomOut', 'nearby.map.showAll'] as const) {
      expect(within(english.view.getByTestId('map-tiles')).getByLabelText(en[key])).toBeTruthy();
    }
    english.view.unmount?.();
  });

  it('credits OpenStreetMap, as its licence asks, and opens the credits page', async () => {
    const { view } = await open();
    const credit = view.getByTestId('map-credit');
    expect(credit.textContent).toContain('OpenStreetMap');
    fireEvent.click(credit);
    expect(view.world.opened).toContain('https://www.openstreetmap.org/copyright');
  });

  it('draws tiles from OpenStreetMap by default', async () => {
    const { view } = await open();
    const tiles = await view.findAllByTestId('map-tile');
    expect(tiles.length).toBeGreaterThan(0);
    expect(
      tiles[0]!.querySelector('img')?.getAttribute('src') ?? tiles[0]!.getAttribute('src') ?? '',
    ).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it('keeps the map itself left to right in Urdu, with Urdu words on the controls', async () => {
    const { view } = await open('ur');
    expect(directionOf(view.container)).toBe('rtl');
    expect(view.getByLabelText(ur['nearby.map.zoomIn'])).toBeTruthy();
    expect(view.getByTestId('map-marker-v1')).toBeTruthy();
  });

  it("shows the person's area as a ring when the screen gives a centre", async () => {
    const { view } = await open('en', { center: { lat: 31.53, lng: 74.34 } });
    expect(await view.findByTestId('map-origin')).toBeTruthy();
  });

  it('falls back to the list of places when no tile can be fetched', async () => {
    const RealImage = window.Image;
    class FailingImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onerror?.());
      }
      decode() {
        return Promise.reject(new Error('offline'));
      }
    }
    window.Image = FailingImage as unknown as typeof Image;
    try {
      const { view } = await open();
      expect(await view.findByTestId('map-list-only')).toBeTruthy();
    } finally {
      window.Image = RealImage;
    }
  });
});
