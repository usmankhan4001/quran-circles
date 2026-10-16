import { z } from 'zod';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';

export type Section = 'quran' | 'prayer';
export type CalendarView = 'week' | 'month';

export interface ViewState {
  /** Which half of the Quran and Prayer tab was open last. */
  section: Section;
  /** The id of the city the person chose (see PAKISTAN_CITIES), or null before they choose. */
  placeId: string | null;
  calendarView: CalendarView;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  section: 'quran',
  placeId: null,
  calendarView: 'week',
};

const Schema = z.object({
  section: z.enum(['quran', 'prayer']).catch('quran'),
  placeId: z.string().nullable().catch(null),
  calendarView: z.enum(['week', 'month']).catch('week'),
});

const KEY = 'qc.content.view.v1';

export interface ViewStateStore {
  load(): Promise<ViewState>;
  /** Merges the change into what is saved and returns the result. */
  update(change: Partial<ViewState>): Promise<ViewState>;
}

/** Remembers small choices on this device: the open section, the city, the calendar view. */
export function createViewStateStore(storage: KeyValueStorage): ViewStateStore {
  const load = async (): Promise<ViewState> =>
    (await readJson(storage, KEY, Schema)) ?? DEFAULT_VIEW_STATE;
  return {
    load,
    async update(change) {
      const next = { ...(await load()), ...change };
      await writeJson(storage, KEY, next);
      return next;
    },
  };
}
