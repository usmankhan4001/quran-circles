import type { Handlers } from '../shared/route';
import { findOccurrence } from '../sessions/admin';
import { readAttendance, saveAttendance } from './service';

export const attendanceHandlers = (): Handlers => ({
  'adminAttendance.get': async (ctx) => {
    const found = await findOccurrence(ctx.db, ctx.params.occurrenceId);
    if (!found) return ctx.missing('attendance.read');
    ctx.authorize('attendance.read', { cityId: found.cityId, venueId: found.venueId });
    return readAttendance(ctx.db, found.occurrence.id);
  },

  'adminAttendance.put': async (ctx) => {
    const found = await findOccurrence(ctx.db, ctx.params.occurrenceId);
    if (!found) return ctx.missing('attendance.mark');
    ctx.authorize('attendance.mark', { cityId: found.cityId, venueId: found.venueId });
    return saveAttendance(
      ctx.db,
      ctx.now,
      ctx.uid(),
      {
        id: found.occurrence.id,
        sessionId: found.occurrence.sessionId,
        status: found.occurrence.status,
        startsAt: found.occurrence.startsAt,
        venueId: found.venueId,
        cityId: found.cityId,
      },
      ctx.body,
    );
  },
});
