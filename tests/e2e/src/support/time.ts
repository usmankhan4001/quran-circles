/** Pakistan time is UTC+5 all year (no daylight saving), the timezone every session uses. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const pkt = (instant: Date): string => new Date(instant.getTime() + PKT_OFFSET_MS).toISOString();

/** `YYYY-MM-DD` in Pakistan for an instant. */
export const pktDate = (instant: Date): string => pkt(instant).slice(0, 10);
/** `HH:MM` in Pakistan for an instant. */
export const pktTime = (instant: Date): string => pkt(instant).slice(11, 16);
/** Day of week (0 Sunday) in Pakistan for an instant. */
export const pktDay = (instant: Date): number =>
  new Date(instant.getTime() + PKT_OFFSET_MS).getUTCDay();

/** `now` plus `minutes`, rounded up to the next whole minute (session times have no seconds). */
export function minutesFromNow(minutes: number, now: Date = new Date()): Date {
  const t = now.getTime() + minutes * 60_000;
  return new Date(Math.ceil(t / 60_000) * 60_000);
}
