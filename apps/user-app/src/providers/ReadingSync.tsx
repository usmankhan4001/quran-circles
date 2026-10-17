import { useReadingDaySync } from '../features/reading/sync';

/** Renders nothing; counts reading in the reader as a day read (`reading_days` on, signed in). */
export function ReadingSync() {
  useReadingDaySync();
  return null;
}
