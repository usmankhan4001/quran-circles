import type { Handlers } from '../shared/route';
import { filterCovers } from '../shared/scope';
import { findVenue } from '../venues/service';
import {
  circleResource,
  createCircle,
  decideCircle,
  findCircle,
  listAdminCircles,
  toAdminCircle,
  updateCircle,
} from './service';

export const circleHandlers = (): Handlers => ({
  'adminCircles.list': (ctx) => listAdminCircles(ctx.db, ctx.scope('circle.list_admin'), ctx.query),

  'adminCircles.create': async (ctx) => {
    const venue = await findVenue(ctx.db, ctx.body.venueId);
    if (!venue) return ctx.unknownRef('circle.create');
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
    return decideCircle(ctx.db, ctx.now, ctx.uid(), record.circle.id, ctx.body.decision);
  },

  'adminCircles.get': async (ctx) => {
    const filter = ctx.scope('circle.list_admin');
    const record = await findCircle(ctx.db, ctx.params.circleId);
    // Out of scope reads as unknown, so a circle's existence is not revealed.
    if (!record || !filterCovers(filter, circleResource(record))) {
      return ctx.missing('circle.list_admin');
    }
    return toAdminCircle(record);
  },
});
