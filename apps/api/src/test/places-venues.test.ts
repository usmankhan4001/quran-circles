import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Area, City, Province, Venue } from '@qc/contracts';
import { createHarness, type Harness } from './harness';
import { auditRows } from './fixtures';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

type Page<T> = { items: T[]; nextCursor: string | null };

describe('places', () => {
  it('lists provinces, cities and areas without signing in', async () => {
    const provinces = (await h.api('places.provinces')).json<{ items: Province[] }>();
    expect(provinces.items.map((p) => p.id)).toEqual([h.world.provinceId]);

    const cities = (
      await h.api('places.cities', { query: { provinceId: h.world.provinceId } })
    ).json<{ items: City[] }>();
    expect(cities.items.map((c) => c.name.en)).toEqual(['City A', 'City B']);
    expect(cities.items[0]?.timezone).toBe('Asia/Karachi');

    const areas = (await h.api('places.areas', { query: { cityId: h.world.cityA.id } })).json<{
      items: Area[];
    }>();
    expect(areas.items.map((a) => a.id).sort()).toEqual(
      [h.world.cityA.areaId, h.world.cityA.areaId2].sort(),
    );
  });

  it('filters cities by province and hides inactive cities', async () => {
    const none = await h.api('places.cities', {
      query: { provinceId: '00000000-0000-4000-8000-000000000000' },
    });
    expect(none.json<{ items: City[] }>().items).toEqual([]);
    await h.pg.query(`update cities set is_active = false where id = $1`, [h.world.cityB.id]);
    const cities = (await h.api('places.cities')).json<{ items: City[] }>();
    expect(cities.items.map((c) => c.name.en)).toEqual(['City A']);
  });

  it('requires a city to list areas', async () => {
    const res = await h.api('places.areas');
    expect(res.status).toBe(400);
  });
});

describe('public venues', () => {
  it('lists active venues with a position and facilities', async () => {
    const res = await h.api('venues.list');
    const page = res.json<Page<Venue>>();
    expect(page.items.map((v) => v.name.en)).toEqual(['Venue A1', 'Venue A2', 'Venue B1']);
    const first = page.items[0]!;
    expect(first.lat).toBeCloseTo(31.52);
    expect(first.facilities.parking).toBe(false);
    expect(first.contactPhone).toBeNull();
  });

  it('filters by city, area, search text and facilities', async () => {
    const admin = await h.nationalAdmin();
    await h.api('adminVenues.update', {
      as: admin,
      params: { venueId: h.world.venueA2 },
      body: {
        facilities: { womenSection: true, elderWheelchairAccess: true },
        areaId: h.world.cityA.areaId2,
      },
    });
    const byCity = (await h.api('venues.list', { query: { cityId: h.world.cityB.id } })).json<
      Page<Venue>
    >();
    expect(byCity.items.map((v) => v.id)).toEqual([h.world.venueB1]);
    const byArea = (await h.api('venues.list', { query: { areaId: h.world.cityA.areaId2 } })).json<
      Page<Venue>
    >();
    expect(byArea.items.map((v) => v.id)).toEqual([h.world.venueA2]);
    const women = (await h.api('venues.list', { query: { womenSection: true } })).json<
      Page<Venue>
    >();
    expect(women.items.map((v) => v.id)).toEqual([h.world.venueA2]);
    const wheelchair = (await h.api('venues.list', { query: { wheelchairAccess: true } })).json<
      Page<Venue>
    >();
    expect(wheelchair.items.map((v) => v.id)).toEqual([h.world.venueA2]);
    const text = (await h.api('venues.list', { query: { q: 'a1' } })).json<Page<Venue>>();
    expect(text.items.map((v) => v.id)).toEqual([h.world.venueA1]);
  });

  it('matches search text literally, not as a pattern', async () => {
    const res = await h.api('venues.list', { query: { q: '%' } });
    expect(res.json<Page<Venue>>().items).toEqual([]);
  });

  it('sorts by distance when a position is given', async () => {
    await h.pg.query(`update venues set lat = 30.0, lng = 70.0 where id = $1`, [h.world.venueA1]);
    await h.pg.query(`update venues set lat = 31.0, lng = 74.0 where id = $1`, [h.world.venueA2]);
    await h.pg.query(`update venues set lat = 33.0, lng = 73.0 where id = $1`, [h.world.venueB1]);
    const res = await h.api('venues.list', { query: { lat: 31.1, lng: 74.0 } });
    expect(res.json<Page<Venue>>().items.map((v) => v.id)).toEqual([
      h.world.venueA2,
      h.world.venueB1,
      h.world.venueA1,
    ]);
  });

  it('pages with an opaque cursor and rejects a forged one', async () => {
    const first = (await h.api('venues.list', { query: { limit: 2 } })).json<Page<Venue>>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await h.api('venues.list', { query: { limit: 2, cursor: first.nextCursor! } })
    ).json<Page<Venue>>();
    expect(second.items.map((v) => v.id)).toEqual([h.world.venueB1]);
    expect(second.nextCursor).toBeNull();
    const forged = await h.api('venues.list', { query: { cursor: 'AAAA' } });
    expect(forged.status).toBe(400);
  });

  it('shows one venue and hides archived or unknown ones', async () => {
    const found = await h.api('venues.get', { params: { venueId: h.world.venueA1 } });
    expect(found.json<Venue>().id).toBe(h.world.venueA1);
    await h.pg.query(`update venues set status = 'archived' where id = $1`, [h.world.venueA1]);
    expect((await h.api('venues.get', { params: { venueId: h.world.venueA1 } })).status).toBe(404);
    expect(
      (await h.api('venues.get', { params: { venueId: '00000000-0000-4000-8000-000000000000' } }))
        .status,
    ).toBe(404);
    const list = (await h.api('venues.list')).json<Page<Venue>>();
    expect(list.items.map((v) => v.id)).not.toContain(h.world.venueA1);
  });

  it('falls back to the area position for a venue without its own', async () => {
    await h.pg.query(`update venues set lat = null, lng = null where id = $1`, [h.world.venueA1]);
    const venue = (
      await h.api('venues.get', { params: { venueId: h.world.venueA1 } })
    ).json<Venue>();
    expect(venue.lat).toBeCloseTo(31.5);
    expect(venue.lng).toBeCloseTo(74.3);
  });
});

describe('admin venues', () => {
  const body = (areaId: string, cityId: string) => ({
    cityId,
    areaId,
    name: { en: 'Masjid Noor', ur: 'مسجد نور' },
    address: { en: '5 Canal Road' },
    lat: 31.55,
    lng: 74.33,
    contactPhone: '+923000000777',
    facilities: { parking: true },
  });

  it('lets a city coordinator create a venue in their city, and audits it', async () => {
    const coordinator = await h.cityCoordinator(h.world.cityA.id);
    const res = await h.api('adminVenues.create', {
      as: coordinator,
      body: body(h.world.cityA.areaId, h.world.cityA.id),
    });
    expect(res.status).toBe(201);
    const venue = res.json<Venue>();
    expect(venue.name).toEqual({ en: 'Masjid Noor', ur: 'مسجد نور' });
    expect(venue.address.ur).toBe('5 Canal Road');
    expect(venue.facilities.parking).toBe(true);
    expect(venue.contactPhone).toBe('+923000000777');
    expect(venue.slug).toMatch(/^masjid-noor-[0-9a-f]{6}$/);

    const rows = await auditRows(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: coordinator.userId,
      action: 'venue.create',
      entityType: 'venue',
      entityId: venue.id,
      scopeType: 'venue',
      venueId: venue.id,
      cityId: h.world.cityA.id,
    });
    expect(JSON.stringify(rows[0]?.meta)).not.toContain('Noor');
    expect(JSON.stringify(rows[0]?.meta)).not.toContain('777');
  });

  it('refuses a city coordinator creating in another city, and an area from another city', async () => {
    const coordinator = await h.cityCoordinator(h.world.cityA.id);
    const other = await h.api('adminVenues.create', {
      as: coordinator,
      body: body(h.world.cityB.areaId, h.world.cityB.id),
    });
    expect(other.status).toBe(403);
    const wrongArea = await h.api('adminVenues.create', {
      as: coordinator,
      body: body(h.world.cityB.areaId, h.world.cityA.id),
    });
    expect(wrongArea.status).toBe(400);
    expect(wrongArea.json<{ error: { issues: { path: string }[] } }>().error.issues[0]?.path).toBe(
      'areaId',
    );
    expect(await auditRows(h)).toHaveLength(0);
  });

  it('edits only what is sent, keeps the rest, and audits the field names', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const res = await h.api('adminVenues.update', {
      as: coordinator,
      params: { venueId: h.world.venueA1 },
      body: {
        contactPhone: '+923000000888',
        facilities: { parking: true, entranceNotes: { en: 'Side door', ur: null } },
      },
    });
    expect(res.status).toBe(200);
    const venue = res.json<Venue>();
    expect(venue.contactPhone).toBe('+923000000888');
    expect(venue.facilities.parking).toBe(true);
    expect(venue.facilities.entranceNotes?.en).toBe('Side door');
    expect(venue.name.en).toBe('Venue A1');
    expect(venue.facilities.womenSection).toBe(false);

    const cleared = await h.api('adminVenues.update', {
      as: coordinator,
      params: { venueId: h.world.venueA1 },
      body: { contactPhone: null },
    });
    expect(cleared.json<Venue>().contactPhone).toBeNull();

    const rows = await auditRows(h);
    expect(rows.map((r) => r.action)).toEqual(['venue.update', 'venue.update']);
    expect(rows[0]?.meta).toEqual({ fields: ['contactPhone', 'facilities'] });
    expect(rows[0]?.cityId).toBe(h.world.cityA.id);
  });

  it('refuses a venue coordinator editing another venue, and reports unknown venues by role', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const other = await h.api('adminVenues.update', {
      as: coordinator,
      params: { venueId: h.world.venueA2 },
      body: { contactPhone: null },
    });
    expect(other.status).toBe(403);
    const unknown = '00000000-0000-4000-8000-000000000000';
    // With a role that covers the action the answer is not_found; without one it is forbidden.
    const missing = await h.api('adminVenues.update', {
      as: coordinator,
      params: { venueId: unknown },
      body: { contactPhone: null },
    });
    expect(missing.status).toBe(404);
    const attendee = await h.person();
    const outsider = await h.api('adminVenues.update', {
      as: attendee,
      params: { venueId: unknown },
      body: { contactPhone: null },
    });
    expect(outsider.status).toBe(403);
  });

  it('archives a venue, takes it off the public list, and can be repeated', async () => {
    const admin = await h.nationalAdmin();
    const first = await h.api('adminVenues.archive', {
      as: admin,
      params: { venueId: h.world.venueA1 },
    });
    expect(first.json<Venue>().status).toBe('archived');
    const again = await h.api('adminVenues.archive', {
      as: admin,
      params: { venueId: h.world.venueA1 },
    });
    expect(again.status).toBe(200);
    const publicList = (await h.api('venues.list')).json<Page<Venue>>();
    expect(publicList.items.map((v) => v.id)).not.toContain(h.world.venueA1);
    expect((await auditRows(h)).filter((r) => r.action === 'venue.archive')).toHaveLength(2);
  });

  it('lists only venues in scope, with archived ones on request', async () => {
    const admin = await h.nationalAdmin();
    await h.api('adminVenues.archive', { as: admin, params: { venueId: h.world.venueA2 } });

    const national = (await h.api('adminVenues.list', { as: admin })).json<Page<Venue>>();
    expect(national.items.map((v) => v.id).sort()).toEqual(
      [h.world.venueA1, h.world.venueB1].sort(),
    );
    const withArchived = (
      await h.api('adminVenues.list', { as: admin, query: { includeArchived: true } })
    ).json<Page<Venue>>();
    expect(withArchived.items).toHaveLength(3);

    const city = await h.cityCoordinator(h.world.cityA.id);
    const cityList = (
      await h.api('adminVenues.list', { as: city, query: { includeArchived: true } })
    ).json<Page<Venue>>();
    expect(cityList.items.map((v) => v.id).sort()).toEqual(
      [h.world.venueA1, h.world.venueA2].sort(),
    );
    const filtered = (
      await h.api('adminVenues.list', { as: admin, query: { cityId: h.world.cityB.id } })
    ).json<Page<Venue>>();
    expect(filtered.items.map((v) => v.id)).toEqual([h.world.venueB1]);

    const venueCoordinator = await h.venueCoordinator(h.world.venueB1);
    const own = (await h.api('adminVenues.list', { as: venueCoordinator })).json<Page<Venue>>();
    expect(own.items.map((v) => v.id)).toEqual([h.world.venueB1]);
  });
});
