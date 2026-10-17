/** Every address in the app, in one place, so screens never build paths by hand. */
export const routes = {
  today: () => '/',
  updates: () => '/updates',
  places: () => '/places',
  account: () => '/account',
  session: (sessionId: string) => `/session/${sessionId}`,
  registrants: (sessionId: string, occurrenceId?: string) =>
    occurrenceId
      ? `/session/${sessionId}/registrants?occurrenceId=${occurrenceId}`
      : `/session/${sessionId}/registrants`,
  schedule: (sessionId: string) => `/session/${sessionId}/schedule`,
  /** Make, regenerate and download the session's posters. */
  posters: (sessionId: string) => `/session/${sessionId}/posters`,
  postUpdate: (sessionId?: string) =>
    sessionId ? `/post-update?sessionId=${sessionId}` : '/post-update',
  attendance: (sessionId: string, occurrenceId: string) =>
    `/session/${sessionId}/occurrence/${occurrenceId}/attendance`,
  occurrence: (sessionId: string, occurrenceId: string) =>
    `/session/${sessionId}/occurrence/${occurrenceId}`,
  newVenue: () => '/venue/new',
  venue: (venueId: string) => `/venue/${venueId}`,
  newCircle: (venueId?: string) => (venueId ? `/circle/new?venueId=${venueId}` : '/circle/new'),
  circle: (circleId: string) => `/circle/${circleId}`,
  /** The coordinator's ayah of the day pick for one venue or one circle. */
  dailyAyah: (target: { venueId: string } | { circleId: string }) =>
    'circleId' in target
      ? `/daily-ayah?circleId=${target.circleId}`
      : `/daily-ayah?venueId=${target.venueId}`,
} as const;
