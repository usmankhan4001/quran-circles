import type { Handlers } from '../shared/route';
import { findVenue } from '../venues/service';
import { createCircle, decideCircle, findCircle, listAdminCircles, updateCircle } from './service';

export const circleHandlers = (): Handlers => ({
  'adminCircles.list': (ctx) => listAdminCircles(ctx.db, ctx.scope('circle.list_admin'), ctx.query),

  'adminCircles.create': async (ctx) => {
    const venue = await findVenue(ctx.db, ctx.body.venueId);
    if (!venue) return ctx.unknownRef('circle.create', 'venueId');
    const resource = { cityId: venue.cityId, venueId: venue.id };
    ctx.authorize('circle.create', resource);
    return createCircle(
      ctx.db,
      ctx.now,
      ctx.uid(),
      { id: venue.id, cityId: venue.cityId, status: venue.status },
      ctx.allowed('circle.approve', { cityId: venue.cityId }),
      ctx.body,
    );
  },

  'adminCircles.update': async (ctx) => {
    const record = await findCircle(ctx.db, ctx.params.circleId);
    if (!record) return ctx.missing('circle.update');
    ctx.authorize('circle.update', { cityId: record.cityId, venueId: record.circle.venueId });
    return updateCircle(ctx.db, ctx.now, ctx.uid(), record, ctx.body);
  },

  'adminCircles.decide': async (ctx) => {
    const record = await findCircle(ctx.db, ctx.params.circleId);
    if (!record) return ctx.missing('circle.approve');
    ctx.authorize('circle.approve', { cityId: record.cityId });
    return decideCircle(
      ctx.db,
      ctx.now,
      ctx.uid(),
      record.circle.id,
      ctx.body.decision,
      ctx.body.note !== undefined && ctx.body.note !== '',
    );
  },
});
