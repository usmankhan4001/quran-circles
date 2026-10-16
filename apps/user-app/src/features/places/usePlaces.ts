import type { Area, City } from '@qc/contracts';
import { useServices } from '../../providers/services';
import { useQuery } from '../../data/useQuery';

const DAY = 24 * 60 * 60_000;

/** Cities of Pakistan, grouped under provinces on the server. Public, so cached offline. */
export function useCities() {
  const { api } = useServices();
  return useQuery('places:cities', async () => (await api.places.cities()).items, {
    persist: true,
    staleMs: DAY,
  });
}

/** Areas of one city, from our own place list. Nothing here comes from a map service. */
export function useAreas(cityId: string | null) {
  const { api } = useServices();
  return useQuery(
    cityId ? `places:areas:${cityId}` : null,
    async () => (await api.places.areas({ query: { cityId: cityId! } })).items,
    { persist: true, staleMs: DAY },
  );
}

/**
 * Area search: matches the English or Urdu name, ignoring case and extra spaces. An empty
 * search keeps every area. Results are in the list's own order.
 */
export function filterAreas(areas: readonly Area[], query: string): Area[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (needle === '') return [...areas];
  return areas.filter((area) => {
    const names = [area.name.en, area.name.ur ?? ''];
    return names.some((name) => name.toLowerCase().replace(/\s+/g, ' ').includes(needle));
  });
}

export function cityById(cities: readonly City[] | undefined, id: string | null): City | undefined {
  return cities?.find((c) => c.id === id);
}
