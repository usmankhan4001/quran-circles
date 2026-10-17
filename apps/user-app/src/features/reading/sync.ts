import { useEffect, useRef } from 'react';
import { addDays, pakistanDate, type ReadingDayClientSource } from '@qc/contracts';
import { useAuthState } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { placeInPortion } from '../readAlong/portion';
import { useTodayPortions } from '../readAlong/hooks';
import { useFeature, useRecordReadingDay } from './hooks';

/**
 * Counts reading in the reader as a day read, with nothing for the person to do: each time the
 * reader saves the place reached, today (or yesterday, for a save just before midnight that syncs
 * late) is recorded with the `reader` source, and with `portion` too when the ayah is part of one
 * of today's session portions (feature 4). Once per date and source while the app runs; the
 * server is idempotent anyway. A failed call is tried again on the next save. Nothing is logged.
 */
export function useReadingDaySync(): void {
  const { content, now } = useServices();
  const { status } = useAuthState();
  const feature = useFeature('reading_days');
  const { portions } = useTodayPortions();
  const record = useRecordReadingDay();
  const portionsRef = useRef(portions);
  portionsRef.current = portions;
  const nowRef = useRef(now);
  nowRef.current = now;
  const subscribe = content.subscribeReading;
  const run = record.run;

  useEffect(() => {
    if (!feature.on || status !== 'signedIn' || !subscribe) return;
    const sent = new Set<string>();
    const send = (date: string, today: string, source: ReadingDayClientSource) => {
      const key = `${date}:${source}`;
      if (sent.has(key)) return;
      sent.add(key);
      void run(date === today ? { source } : { source, date }).then((outcome) => {
        // Failed: try again on the next save. out_of_range: the clock is off; leave it.
        if (!outcome) sent.delete(key);
      });
    };
    return subscribe((mark) => {
      const today = pakistanDate(nowRef.current());
      const date = pakistanDate(mark.at);
      if (date !== today && date !== addDays(today, -1)) return;
      send(date, today, 'reader');
      if (
        date === today &&
        portionsRef.current.some((p) => placeInPortion(mark, p.occurrence.portion))
      ) {
        send(date, today, 'portion');
      }
    });
  }, [feature.on, status, subscribe, run]);
}
