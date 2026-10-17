import type { Handlers } from '../shared/route';
import { ayahOfTheDay, deleteDailyAyah, listDailyAyahs, putDailyAyah } from './daily-ayahs';
import { communityToday, listReadingDays, recordReadingDay } from './days';
import { deleteMemorisation, listMemorisation, putMemorisation } from './memorisation';

/**
 * Days read, the community total, the ayah of the day and the memorisation tracker (contract
 * 1.0.0-rc.4). Reading days and memorisation are self actions, decided by the route binder on the
 * caller's own id; staff have no access to anyone else's.
 */
export const readingHandlers = (): Handlers => ({
  'readingDays.record': (ctx) => recordReadingDay(ctx.db, ctx.uid(), ctx.now, ctx.body),
  'readingDays.list': (ctx) => listReadingDays(ctx.db, ctx.uid(), ctx.query),

  'community.today': (ctx) => {
    ctx.header('cache-control', 'public, max-age=60');
    return communityToday(ctx.db, ctx.now);
  },
  'ayahOfTheDay.get': (ctx) => ayahOfTheDay(ctx.db, ctx.now, ctx.query),

  'adminDailyAyahs.list': (ctx) =>
    listDailyAyahs(ctx.db, ctx.scope('daily_ayah.manage'), ctx.query),
  'adminDailyAyahs.put': (ctx) => putDailyAyah(ctx.db, ctx, ctx.uid(), ctx.now, ctx.body),
  'adminDailyAyahs.delete': async (ctx) => {
    await deleteDailyAyah(ctx.db, ctx, ctx.uid(), ctx.params.dailyAyahId);
  },

  'memorisation.list': (ctx) => listMemorisation(ctx.db, ctx.uid()),
  'memorisation.put': (ctx) =>
    putMemorisation(ctx.db, ctx.uid(), ctx.now, ctx.params.surah, ctx.body),
  'memorisation.delete': async (ctx) => {
    await deleteMemorisation(ctx.db, ctx.uid(), ctx.params.surah);
  },
});
