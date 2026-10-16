import type { Venue } from '@qc/contracts';

/** A link that opens the venue in the phone's maps app, or Google Maps on the web. */
export function venueMapUrl(venue: Pick<Venue, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
}

/** The venue's own public number as a dial link. Attendees see no other number. */
export function venuePhoneUrl(phone: string): string {
  return `tel:${phone}`;
}

/** Only web addresses are opened from server text; anything else is ignored. */
export function safeWebUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
