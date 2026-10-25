import type { Session } from '@qc/contracts';
import type { Locale } from '@qc/contracts';
import { pickLocalized } from '../../i18n/localized';
import type { MapMarker } from '../maps/types';

/**
 * One pin per venue, titled with the venue, subtitled with how many sessions it has here, and
 * carrying that count for the pin. `locationOf` words where the venue is (area, city, distance);
 * a venue it has nothing for gets no location line.
 */
export function markersFromSessions(
  sessions: readonly Session[],
  locale: Locale,
  subtitle: (count: number, firstTitle: string) => string,
  locationOf?: (venue: Session['venue']) => string | undefined,
): MapMarker[] {
  const byVenue = new Map<string, { session: Session; count: number }>();
  for (const session of sessions) {
    const existing = byVenue.get(session.venueId);
    if (existing) existing.count += 1;
    else byVenue.set(session.venueId, { session, count: 1 });
  }
  return [...byVenue.values()].map(({ session, count }) => {
    const location = locationOf?.(session.venue);
    return {
      id: session.venueId,
      lat: session.venue.lat,
      lng: session.venue.lng,
      title: pickLocalized(session.venue.name, locale).text,
      subtitle: subtitle(count, pickLocalized(session.title, locale).text),
      ...(location ? { location } : {}),
      count,
    };
  });
}

/**
 * "Gulberg, Lahore · 1.2 km": the venue's area and city in the reader's language, then the
 * distance when there is one. Parts that are not known are left out; nothing known gives
 * undefined.
 */
export function describeLocation(parts: {
  area?: string | undefined;
  city?: string | undefined;
  distance?: string | undefined;
  /** Between area and city ("، " in Urdu). */
  comma: string;
  /** Before the distance (" · "). */
  separator: string;
}): string | undefined {
  const place = [parts.area, parts.city].filter((p): p is string => !!p?.trim()).join(parts.comma);
  const out = [place, parts.distance ?? ''].filter((p) => p.trim() !== '').join(parts.separator);
  return out || undefined;
}
