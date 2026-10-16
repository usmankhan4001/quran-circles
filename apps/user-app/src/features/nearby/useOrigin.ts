import { useAreas } from '../places/usePlaces';
import { usePreferences } from '../../providers/hooks';

/**
 * Where "near me" is measured from: the centre of the person's chosen area. It comes from our
 * own place list, so no location permission is needed and nothing about the phone leaves it.
 */
export function useOrigin(): { lat: number; lng: number } | null {
  const { cityId, areaId } = usePreferences();
  const areas = useAreas(cityId);
  const area = areas.data?.find((a) => a.id === areaId);
  return area && area.lat !== null && area.lng !== null ? { lat: area.lat, lng: area.lng } : null;
}
