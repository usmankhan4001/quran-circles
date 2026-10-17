import type { ComponentType } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** How many circles are at the place; drawn on the pin when more than one. */
  count?: number;
}

export interface MapViewProps {
  markers: readonly MapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Where the map opens. Defaults to fitting all the markers. */
  center?: { lat: number; lng: number };
  /** Names the map for a screen reader. */
  accessibilityLabel: string;
  /** Shown by the list-only map when there is no real map. */
  unavailableLabel: string;
  height?: number;
}

/**
 * The map behind Nearby. Google Maps is one implementation (`GoogleMapView`); the list-only
 * one is the fallback and what tests use. Swapping providers means writing one component with
 * these props and passing it to the app.
 */
export type MapViewComponent = ComponentType<MapViewProps>;

/** The middle of a set of markers, for a map that opens on all of them. */
export function centerOf(markers: readonly Pick<MapMarker, 'lat' | 'lng'>[]): {
  lat: number;
  lng: number;
} | null {
  if (markers.length === 0) return null;
  const lat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
  const lng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length;
  return { lat, lng };
}
