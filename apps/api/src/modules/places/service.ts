import { asc, eq } from 'drizzle-orm';
import type { Area, City, Province } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { localized } from '../shared/mappers';

export async function listProvinces(db: Db): Promise<{ items: Province[] }> {
  const rows = await db.select().from(schema.provinces).orderBy(asc(schema.provinces.nameEn));
  return {
    items: rows.map((r) => ({ id: r.id, code: r.code, name: localized(r.nameEn, r.nameUr) })),
  };
}

export async function listCities(
  db: Db,
  query: { provinceId?: string | undefined },
): Promise<{ items: City[] }> {
  const rows = await db
    .select()
    .from(schema.cities)
    .where(query.provinceId ? eq(schema.cities.provinceId, query.provinceId) : undefined)
    .orderBy(asc(schema.cities.nameEn));
  return {
    items: rows
      .filter((r) => r.isActive)
      .map((r) => ({
        id: r.id,
        provinceId: r.provinceId,
        slug: r.slug,
        name: localized(r.nameEn, r.nameUr),
        timezone: r.timezone,
      })),
  };
}

export async function listAreas(db: Db, query: { cityId: string }): Promise<{ items: Area[] }> {
  const rows = await db
    .select()
    .from(schema.areas)
    .where(eq(schema.areas.cityId, query.cityId))
    .orderBy(asc(schema.areas.nameEn));
  return {
    items: rows.map((r) => ({
      id: r.id,
      cityId: r.cityId,
      slug: r.slug,
      name: localized(r.nameEn, r.nameUr),
      lat: r.lat,
      lng: r.lng,
    })),
  };
}
