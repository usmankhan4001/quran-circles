import type { Handlers } from '../shared/route';
import { requireFeature } from '../system/service';
import { ayahOfTheDay, deleteDailyAyah, listDailyAyahs, putDailyAyah } from './daily-ayahs';
import { communityToday, listReadingDays, recordReadingDay } from './days';
import { deleteMemorisation, listMemorisation, putMemorisation } from './memorisation';

/**
 * Days read, the community total, the ayah of the day and the memorisation tracker (contract
 * 1.0.0-rc.4). Reading days and memorisation are self actions, decided by the route binder on the
 * caller's own id; staff have no access to anyone else's.
 *
 * Each feature ships behind its switch (`reading_days`, `community_today`, `ayah_of_the_day`,
 * `memorisation`). The apps hide a switched-off feature; the API refuses it too, with `forbidden`,
 * when the switch is off everywhere (`requireFeature`). Coordinator picks belong to the ayah of
 * the day.
 */
export const readingHandlers = (): Handlers => ({
  'readingDays.record': async (ctx) => {
    await requireFeature(ctx.db, 'reading_days');
    return recordReadingDay(ctx.db, ctx.uid(), ctx.now, ctx.body);
  },
  'readingDays.list': async (ctx) => {
    await requireFeature(ctx.db, 'reading_days');
    return listReadingDays(ctx.db, ctx.uid(), ctx.query);
  },

  'community.today': async (ctx) => {
    await requireFeature(ctx.db, 'community_today');
    ctx.header('cache-control', 'public, max-age=60');
    return communityToday(ctx.db, ctx.now);
  },
  'ayahOfTheDay.get': async (ctx) => {
    await requireFeature(ctx.db, 'ayah_of_the_day');
    return ayahOfTheDay(ctx.db, ctx.now, ctx.query);
  },

  'adminDailyAyahs.list': async (ctx) => {
    await requireFeature(ctx.db, 'ayah_of_the_day');
    return listDailyAyahs(ctx.db, ctx.scope('daily_ayah.manage'), ctx.query);
  },
  'adminDailyAyahs.put': async (ctx) => {
    await requireFeature(ctx.db, 'ayah_of_the_day');
    return putDailyAyah(ctx.db, ctx, ctx.uid(), ctx.now, ctx.body);
  },
  'adminDailyAyahs.delete': async (ctx) => {
    await requireFeature(ctx.db, 'ayah_of_the_day');
    await deleteDailyAyah(ctx.db, ctx, ctx.uid(), ctx.params.dailyAyahId);
  },

  'memorisation.list': async (ctx) => {
    await requireFeature(ctx.db, 'memorisation');
    return listMemorisation(ctx.db, ctx.uid());
  },
  'memorisation.put': async (ctx) => {
    await requireFeature(ctx.db, 'memorisation');
    return putMemorisation(ctx.db, ctx.uid(), ctx.now, ctx.params.surah, ctx.body);
  },
  'memorisation.delete': async (ctx) => {
    await requireFeature(ctx.db, 'memorisation');
    await deleteMemorisation(ctx.db, ctx.uid(), ctx.params.surah);
  },
});
