import type { Handlers } from '../shared/route';
import { listAreas, listCities, listProvinces } from './service';

export const placesHandlers = (): Handlers => ({
  'places.provinces': (ctx) => listProvinces(ctx.db),
  'places.cities': (ctx) => listCities(ctx.db, ctx.query),
  'places.areas': (ctx) => listAreas(ctx.db, ctx.query),
});
