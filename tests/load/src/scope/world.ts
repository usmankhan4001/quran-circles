import type { Role } from '@qc/contracts';
import { expectOk } from '../http';
import { as, pakistanDate, principalOf, refreshMe, signIn, type Api, type Person } from '../people';
import { CALLER_KINDS, type Caller, type CallerKind, type Fixture, type World } from './types';

/**
 * Builds everything the matrix needs through the public API only, so the same code runs against
 * a local stack or staging: two cities (found), three venues and the coordinators (created and
 * invited by the national admin, then signed in), and the records the staff scenarios act on.
 * Names carry the run tag; all data is synthetic.
 */

interface Items<T> {
  items: T[];
}

export async function findCities(
  api: Api,
  admin: Person,
  prefer: readonly string[] = [],
): Promise<{ id: string; areaId: string; lat: number; lng: number }[]> {
  const cities = expectOk<Items<{ id: string; slug: string }>>(
    await as(api, admin, 'places.cities'),
    'list cities',
  ).items;
  const ordered = [
    ...prefer.flatMap((p) => cities.filter((c) => c.id === p || c.slug === p)),
    ...cities,
  ];
  const out: { id: string; areaId: string; lat: number; lng: number }[] = [];
  const seen = new Set<string>();
  for (const city of ordered) {
    if (seen.has(city.id)) continue;
    seen.add(city.id);
    const areas = expectOk<Items<{ id: string; lat: number | null; lng: number | null }>>(
      await as(api, admin, 'places.areas', { query: { cityId: city.id } }),
      'list areas',
    ).items;
    const area = areas[0];
    if (!area) continue;
    out.push({ id: city.id, areaId: area.id, lat: area.lat ?? 31.5, lng: area.lng ?? 74.3 });
  }
  return out;
}

async function createVenue(
  api: Api,
  admin: Person,
  city: { id: string; areaId: string; lat: number; lng: number },
  name: string,
): Promise<string> {
  return expectOk<{ id: string }>(
    await as(api, admin, 'adminVenues.create', {
      body: {
        cityId: city.id,
        areaId: city.areaId,
        name: { en: name },
        address: { en: '1 Synthetic Road' },
        lat: city.lat,
        lng: city.lng,
      },
    }),
    `create venue ${name}`,
  ).id;
}

type RoleTarget =
  | { role: 'national_admin' }
  | { role: 'city_coordinator'; cityId: string }
  | { role: 'venue_coordinator'; venueId: string };

/** Invites a fresh synthetic number to a role, signs it in, and checks the role arrived. */
export async function invitedPerson(
  api: Api,
  admin: Person,
  label: string,
  target: RoleTarget,
): Promise<Person> {
  const phone = api.synthetic.phone();
  expectOk(
    await as(api, admin, 'adminRoles.invite', {
      body: { ...target, phone, displayName: 'Synthetic Coordinator' },
    }),
    `invite ${label}`,
  );
  const person = await signIn(api, label, phone);
  const role: Role = target.role;
  if (!person.me.roles.some((r) => r.role === role)) {
    throw new Error(`${label}: the invite did not become a ${role} role at sign-in`);
  }
  return person;
}

export async function buildWorld(api: Api, admin: Person, runTag: string): Promise<World> {
  const cities = await findCities(api, admin);
  const [a, b] = cities;
  if (!a || !b) throw new Error('need two cities with areas (run the @qc/db seed first)');
  const venueA1 = await createVenue(api, admin, a, `Scope ${runTag} A1`);
  const venueA2 = await createVenue(api, admin, a, `Scope ${runTag} A2`);
  const venueB1 = await createVenue(api, admin, b, `Scope ${runTag} B1`);
  return {
    cityA: { id: a.id, areaId: a.areaId },
    cityB: { id: b.id, areaId: b.areaId },
    venueA1,
    venueA2,
    venueB1,
  };
}

/** A person of the given kind. Used for the main cast and for disposable callers. */
export async function personOfKind(
  api: Api,
  admin: Person,
  world: World,
  kind: Exclude<CallerKind, 'anonymous'>,
  label: string,
): Promise<{ person: Person; revokedFirst?: boolean }> {
  switch (kind) {
    case 'attendee':
      return { person: await signIn(api, label) };
    case 'vc_venue':
      return {
        person: await invitedPerson(api, admin, label, {
          role: 'venue_coordinator',
          venueId: world.venueA1,
        }),
      };
    case 'vc_same_city':
      return {
        person: await invitedPerson(api, admin, label, {
          role: 'venue_coordinator',
          venueId: world.venueA2,
        }),
      };
    case 'vc_other_city':
      return {
        person: await invitedPerson(api, admin, label, {
          role: 'venue_coordinator',
          venueId: world.venueB1,
        }),
      };
    case 'cc_city':
      return {
        person: await invitedPerson(api, admin, label, {
          role: 'city_coordinator',
          cityId: world.cityA.id,
        }),
      };
    case 'cc_other_city':
      return {
        person: await invitedPerson(api, admin, label, {
          role: 'city_coordinator',
          cityId: world.cityB.id,
        }),
      };
    case 'national_admin':
      return { person: await invitedPerson(api, admin, label, { role: 'national_admin' }) };
    case 'vc_revoked': {
      // Assigned, used once (proving the role worked), then revoked by the admin.
      const person = await signIn(api, label);
      const assignment = expectOk<{ id: string }>(
        await as(api, admin, 'adminRoles.assign', {
          body: { role: 'venue_coordinator', venueId: world.venueA1, userId: person.userId },
        }),
        `assign ${label}`,
      );
      const used = await as(api, person, 'adminVenues.list');
      if (used.status !== 200) {
        throw new Error(
          `${label}: the assigned role did not work before revocation (${used.status})`,
        );
      }
      expectOk(
        await as(api, admin, 'adminRoles.revoke', { params: { assignmentId: assignment.id } }),
        `revoke ${label}`,
      );
      const after = await refreshMe(api, person);
      if (after.me.roles.length > 0) throw new Error(`${label}: me still lists a revoked role`);
      return { person: after, revokedFirst: true };
    }
  }
}

export async function buildCallers(
  api: Api,
  admin: Person,
  world: World,
  tag: string,
): Promise<Caller[]> {
  const callers: Caller[] = [];
  for (const kind of CALLER_KINDS) {
    if (kind === 'anonymous') {
      callers.push({ kind, person: null, principal: null });
      continue;
    }
    // The bootstrap admin is the national admin caller of the main cast.
    const person =
      kind === 'national_admin' && tag === 'main'
        ? admin
        : (await personOfKind(api, admin, world, kind, `${kind} ${tag}`)).person;
    callers.push({ kind, person, principal: principalOf(person) });
  }
  return callers;
}

export async function buildFixture(
  api: Api,
  admin: Person,
  world: World,
  callers: readonly Caller[],
  runTag: string,
): Promise<{ fixture: Fixture; owner: Person }> {
  const today = pakistanDate();
  const pickDate = pakistanDate(40);
  const vcVenue = callers.find((c) => c.kind === 'vc_venue')?.person;
  if (!vcVenue) throw new Error('no venue coordinator in the cast');

  const recurring = (title: string) => ({
    kind: 'recurring',
    venueId: world.venueA1,
    program: 'dora',
    title: { en: title },
    section: 'family',
    language: 'en',
    localStartTime: '21:00',
    durationMinutes: 90,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startsOn: today,
    endsOn: pakistanDate(14),
  });
  const sessionId = expectOk<{ id: string }>(
    await as(api, admin, 'adminSessions.create', { body: recurring(`Scope ${runTag} main`) }),
    'create session',
  ).id;
  const session2Id = expectOk<{ id: string }>(
    await as(api, admin, 'adminSessions.create', { body: recurring(`Scope ${runTag} second`) }),
    'create second session',
  ).id;
  const occurrences = expectOk<Items<{ id: string }>>(
    await as(api, admin, 'adminSessions.occurrences', { params: { sessionId } }),
    'list occurrences',
  ).items;
  const occurrenceId = occurrences[0]?.id;
  if (!occurrenceId) throw new Error('the new session has no occurrences');

  const circleId = expectOk<{ id: string }>(
    await as(api, vcVenue, 'adminCircles.create', {
      body: {
        venueId: world.venueA1,
        name: { en: `Scope ${runTag} pending circle` },
        language: 'en',
      },
    }),
    'create circle',
  ).id;
  const inviteId = expectOk<{ id: string }>(
    await as(api, admin, 'adminRoles.invite', {
      body: { role: 'venue_coordinator', venueId: world.venueA1, phone: api.synthetic.phone() },
    }),
    'create invite',
  ).id;
  const held = await signIn(api, 'held assignment');
  const assignmentId = expectOk<{ id: string }>(
    await as(api, admin, 'adminRoles.assign', {
      body: { role: 'venue_coordinator', venueId: world.venueA1, userId: held.userId },
    }),
    'create assignment',
  ).id;
  const handoverTarget = await signIn(api, 'handover target');
  const fixtureDate = pakistanDate(41);
  const venueDailyAyahId = expectOk<{ id: string }>(
    await as(api, admin, 'adminDailyAyahs.put', {
      body: {
        date: fixtureDate,
        scope: { type: 'venue', venueId: world.venueA1 },
        surah: 94,
        ayah: 5,
      },
    }),
    'create venue pick',
  ).id;
  const nationalDailyAyahId = expectOk<{ id: string }>(
    await as(api, admin, 'adminDailyAyahs.put', {
      body: { date: fixtureDate, scope: { type: 'national' }, surah: 13, ayah: 28 },
    }),
    'create national pick',
  ).id;
  const posters = expectOk<Items<{ id: string }>>(
    await as(api, admin, 'adminPosters.create', {
      params: { sessionId },
      body: {
        templateKey: 'cloud',
        language: 'en',
        formats: ['story'],
        fields: { title: { en: 'Scope poster' } },
      },
    }),
    'create poster',
  ).items;
  const posterId = posters[0]?.id;
  if (!posterId) throw new Error('poster create returned no poster');
  const settings = expectOk<{ hijriOffsetDays?: number }>(
    await as(api, admin, 'adminSettings.get'),
    'read settings',
  );

  // The owner: an attendee whose own records every other caller must not reach.
  const owner = await signIn(api, 'record owner');
  const registrationId = expectOk<{ id: string }>(
    await as(api, owner, 'registrations.create', {
      body: {
        sessionId,
        areaId: world.cityA.areaId,
        section: 'family',
        partySize: 1,
        name: 'Owner Person',
        allowWhatsapp: false,
      },
    }),
    'owner registration',
  ).id;
  const followId = expectOk<{ id: string }>(
    await as(api, owner, 'follows.create', { body: { target: 'venue', venueId: world.venueA1 } }),
    'owner follow',
  ).id;
  const deviceId = expectOk<{ id: string }>(
    await as(api, owner, 'devices.register', {
      body: {
        platform: 'android',
        provider: 'fcm',
        token: `qc-scope-fake-owner-${runTag}`,
        locale: 'en',
      },
    }),
    'owner device',
  ).id;
  const bookmarkId = expectOk<{ id: string }>(
    await as(api, owner, 'bookmarks.create', { body: { kind: 'surah', surah: 36 } }),
    'owner bookmark',
  ).id;
  const circleRequestId = expectOk<{ id: string }>(
    await as(api, owner, 'circleRequests.create', {
      body: { areaId: world.cityA.areaId, days: [5] },
    }),
    'owner circle request',
  ).id;

  const fixture: Fixture = {
    world,
    runTag,
    fixedCode: api.fixedCode,
    today,
    pickDate,
    sessionId,
    session2Id,
    occurrenceId,
    circleId,
    inviteId,
    assignmentId,
    handoverTargetUserId: handoverTarget.userId,
    venueDailyAyahId,
    nationalDailyAyahId,
    posterId,
    hijriOffsetDays: settings.hijriOffsetDays ?? 0,
    owner: {
      userId: owner.userId,
      registrationId,
      followId,
      deviceId,
      bookmarkId,
      circleRequestId,
    },
  };
  return { fixture, owner };
}
