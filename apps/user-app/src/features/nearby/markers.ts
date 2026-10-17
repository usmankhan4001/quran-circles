import type { Session } from '@qc/contracts';
import type { Locale } from '@qc/contracts';
import { pickLocalized } from '../../i18n/localized';
import type { MapMarker } from '../maps/types';

/**
 * One pin per venue, titled with the venue, subtitled with how many sessions it has here, and
 * carrying that count for the pin.
 */
export function markersFromSessions(
  sessions: readonly Session[],
  locale: Locale,
  subtitle: (count: number, firstTitle: string) => string,
): MapMarker[] {
  const byVenue = new Map<string, { session: Session; count: number }>();
  for (const session of sessions) {
    const existing = byVenue.get(session.venueId);
    if (existing) existing.count += 1;
    else byVenue.set(session.venueId, { session, count: 1 });
  }
  return [...byVenue.values()].map(({ session, count }) => ({
    id: session.venueId,
    lat: session.venue.lat,
    lng: session.venue.lng,
    title: pickLocalized(session.venue.name, locale).text,
    subtitle: subtitle(count, pickLocalized(session.title, locale).text),
    count,
  }));
}
