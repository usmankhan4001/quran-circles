import type { Handlers } from '../shared/route';
import {
  archiveVenue,
  createVenue,
  findVenue,
  getPublicVenue,
  listAdminVenues,
  listPublicVenues,
  updateVenue,
} from './service';

export const venueHandlers = (): Handlers => ({
  'venues.list': (ctx) => listPublicVenues(ctx.db, ctx.query),
  'venues.get': (ctx) => getPublicVenue(ctx.db, ctx.params.venueId),

  'adminVenues.list': (ctx) => listAdminVenues(ctx.db, ctx.scope('venue.list_admin'), ctx.query),
  'adminVenues.create': async (ctx) => {
    ctx.authorize('venue.create', { cityId: ctx.body.cityId });
    return createVenue(ctx.db, ctx.uid(), ctx.body);
  },
  'adminVenues.update': async (ctx) => {
    const venue = await findVenue(ctx.db, ctx.params.venueId);
    if (!venue) return ctx.missing('venue.update');
    ctx.authorize('venue.update', { cityId: venue.cityId, venueId: venue.id });
    return updateVenue(ctx.db, ctx.uid(), venue.id, venue.cityId, ctx.body);
  },
  'adminVenues.archive': async (ctx) => {
    const venue = await findVenue(ctx.db, ctx.params.venueId);
    if (!venue) return ctx.missing('venue.archive');
    ctx.authorize('venue.archive', { cityId: venue.cityId, venueId: venue.id });
    return archiveVenue(ctx.db, ctx.uid(), venue.id, venue.cityId);
  },
});
