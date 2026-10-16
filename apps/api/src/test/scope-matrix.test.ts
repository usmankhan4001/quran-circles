import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ENDPOINT_IDS,
  SCOPE_ACTIONS,
  can,
  endpoints,
  type EndpointDef,
  type EndpointId,
  type Principal,
  type ResourceScope,
  type ScopeAction,
} from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type CallOptions, type Harness } from './harness';
import { createSession } from './fixtures';

/**
 * Every staff endpoint against every kind of caller, with the scope engine as the oracle: the
 * handler must say yes exactly when `can` says yes for the action and the target it acts on.
 * "Yes" means the request got past authorisation (not 401, not 403, not a crash); the request
 * itself may still fail for another reason, such as a conflict.
 */

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

interface Fixture {
  sessionId: string;
  occurrenceId: string;
  registrationId: string;
  circleId: string;
  inviteId: string;
  assignmentId: string;
  handoverTargetUserId: string;
  /** The venue every scenario acts on, and its city. */
  venueId: string;
  cityId: string;
}

interface Scenario {
  id: EndpointId;
  label: string;
  /** The scope action that guards this request, and the target it acts on. */
  action: ScopeAction;
  resource: ResourceScope | undefined;
  request: (fx: Fixture) => CallOptions;
}

const venueRes = (fx: Fixture): ResourceScope => ({ cityId: fx.cityId, venueId: fx.venueId });

/** Built lazily so ids exist: `resource` is filled in from the fixture when the scenario runs. */
type ScenarioSpec = Omit<Scenario, 'resource'> & { target: 'venue' | 'city' | 'national' | 'any' };

const sessionBody = (fx: Fixture) => ({
  kind: 'one_off' as const,
  venueId: fx.venueId,
  program: 'dora' as const,
  title: { en: 'Matrix lecture' },
  section: 'family' as const,
  language: 'en' as const,
  localStartTime: '20:00',
  durationMinutes: 60,
  date: '2026-11-01',
});

const SPECS: ScenarioSpec[] = [
  {
    id: 'registrations.forSession',
    label: 'list',
    action: 'registration.list',
    target: 'venue',
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'registrations.export',
    label: 'export',
    action: 'registration.export',
    target: 'venue',
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminUpdates.post',
    label: 'national',
    action: 'update.post_national',
    target: 'national',
    request: () => ({
      body: {
        scope: { type: 'national' },
        title: { en: 'Hi' },
        body: { en: 'All' },
        notify: false,
      },
    }),
  },
  {
    id: 'adminUpdates.post',
    label: 'city',
    action: 'update.post_city',
    target: 'city',
    request: (fx) => ({
      body: {
        scope: { type: 'city', cityId: fx.cityId },
        title: { en: 'Hi' },
        body: { en: 'City' },
        notify: false,
      },
    }),
  },
  {
    id: 'adminUpdates.post',
    label: 'venue',
    action: 'update.post_venue',
    target: 'venue',
    request: (fx) => ({
      body: {
        scope: { type: 'venue', venueId: fx.venueId },
        title: { en: 'Hi' },
        body: { en: 'Venue' },
        notify: false,
      },
    }),
  },
  {
    id: 'adminUpdates.list',
    label: 'list',
    action: 'update.list_admin',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminTemplates.list',
    label: 'list',
    action: 'template.read',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminRoles.invite',
    label: 'national admin',
    action: 'role.assign_national_admin',
    target: 'national',
    request: () => ({ body: { role: 'national_admin', phone: '+923000009001' } }),
  },
  {
    id: 'adminRoles.invite',
    label: 'city coordinator',
    action: 'role.assign_city_coordinator',
    target: 'city',
    request: (fx) => ({
      body: { role: 'city_coordinator', cityId: fx.cityId, phone: '+923000009002' },
    }),
  },
  {
    id: 'adminRoles.invite',
    label: 'venue coordinator',
    action: 'role.assign_venue_coordinator',
    target: 'venue',
    request: (fx) => ({
      body: { role: 'venue_coordinator', venueId: fx.venueId, phone: '+923000009003' },
    }),
  },
  {
    id: 'adminRoles.invites',
    label: 'list',
    action: 'role.list',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminRoles.revokeInvite',
    label: 'revoke',
    action: 'role.assign_venue_coordinator',
    target: 'venue',
    request: (fx) => ({ params: { inviteId: fx.inviteId } }),
  },
  { id: 'adminRoles.list', label: 'list', action: 'role.list', target: 'any', request: () => ({}) },
  {
    id: 'adminRoles.assign',
    label: 'venue coordinator',
    action: 'role.assign_venue_coordinator',
    target: 'venue',
    request: (fx) => ({
      body: { role: 'venue_coordinator', venueId: fx.venueId, userId: fx.handoverTargetUserId },
    }),
  },
  {
    id: 'adminRoles.assign',
    label: 'city coordinator',
    action: 'role.assign_city_coordinator',
    target: 'city',
    request: (fx) => ({
      body: { role: 'city_coordinator', cityId: fx.cityId, userId: fx.handoverTargetUserId },
    }),
  },
  {
    id: 'adminRoles.assign',
    label: 'national admin',
    action: 'role.assign_national_admin',
    target: 'national',
    request: (fx) => ({ body: { role: 'national_admin', userId: fx.handoverTargetUserId } }),
  },
  {
    id: 'adminRoles.revoke',
    label: 'revoke',
    action: 'role.assign_venue_coordinator',
    target: 'venue',
    request: (fx) => ({ params: { assignmentId: fx.assignmentId } }),
  },
  {
    id: 'adminVenues.list',
    label: 'list',
    action: 'venue.list_admin',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminVenues.create',
    label: 'create',
    action: 'venue.create',
    target: 'city',
    request: (fx) => ({
      body: {
        cityId: fx.cityId,
        areaId: h.world.cityA.areaId,
        name: { en: 'New venue' },
        address: { en: '2 Road' },
        lat: 31.5,
        lng: 74.3,
      },
    }),
  },
  {
    id: 'adminVenues.update',
    label: 'update',
    action: 'venue.update',
    target: 'venue',
    request: (fx) => ({ params: { venueId: fx.venueId }, body: { contactPhone: null } }),
  },
  {
    id: 'adminVenues.archive',
    label: 'archive',
    action: 'venue.archive',
    target: 'city',
    request: (fx) => ({ params: { venueId: fx.venueId } }),
  },
  {
    id: 'adminCircles.list',
    label: 'list',
    action: 'circle.list_admin',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminCircles.create',
    label: 'create',
    action: 'circle.create',
    target: 'venue',
    request: (fx) => ({
      body: { venueId: fx.venueId, name: { en: 'New circle' }, language: 'en' },
    }),
  },
  {
    id: 'adminCircles.update',
    label: 'update',
    action: 'circle.update',
    target: 'venue',
    request: (fx) => ({ params: { circleId: fx.circleId }, body: { teacherName: 'Teacher Name' } }),
  },
  {
    id: 'adminCircles.decide',
    label: 'approve',
    action: 'circle.approve',
    target: 'city',
    request: (fx) => ({ params: { circleId: fx.circleId }, body: { decision: 'approve' } }),
  },
  {
    id: 'adminSessions.list',
    label: 'list',
    action: 'session.list_admin',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminSessions.create',
    label: 'create',
    action: 'session.create',
    target: 'venue',
    request: (fx) => ({ body: sessionBody(fx) }),
  },
  {
    id: 'adminSessions.update',
    label: 'update',
    action: 'session.update',
    target: 'venue',
    request: (fx) => ({ params: { sessionId: fx.sessionId }, body: { section: 'women' } }),
  },
  {
    id: 'adminSessions.changeSchedule',
    label: 'schedule',
    action: 'session.change_schedule',
    target: 'venue',
    request: (fx) => ({
      params: { sessionId: fx.sessionId },
      body: { localStartTime: '19:00', effectiveFrom: '2026-11-01', notify: false },
    }),
  },
  {
    id: 'adminSessions.occurrences',
    label: 'tick list',
    action: 'attendance.read',
    target: 'venue',
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminOccurrences.update',
    label: 'update',
    action: 'occurrence.update',
    target: 'venue',
    request: (fx) => ({
      params: { occurrenceId: fx.occurrenceId },
      body: { recapNote: 'Done', notify: false },
    }),
  },
  {
    id: 'adminAttendance.get',
    label: 'get',
    action: 'attendance.read',
    target: 'venue',
    request: (fx) => ({ params: { occurrenceId: fx.occurrenceId } }),
  },
  {
    id: 'adminAttendance.put',
    label: 'put',
    action: 'attendance.mark',
    target: 'venue',
    request: (fx) => ({
      params: { occurrenceId: fx.occurrenceId },
      body: { headcount: 3, entries: [] },
    }),
  },
  {
    id: 'adminAudit.list',
    label: 'list',
    action: 'audit.read',
    target: 'any',
    request: () => ({}),
  },
  {
    id: 'adminSettings.get',
    label: 'get',
    action: 'settings.read',
    target: 'national',
    request: () => ({}),
  },
  {
    id: 'adminSettings.update',
    label: 'update',
    action: 'settings.update',
    target: 'national',
    request: () => ({ body: { hijriOffsetDays: 1 } }),
  },
];

const staffIds = ENDPOINT_IDS.filter(
  (id) => (endpoints[id] as unknown as EndpointDef).auth === 'staff',
);

describe('the table covers the contract', () => {
  it('has a scenario for every staff endpoint and no other', () => {
    expect([...new Set(SPECS.map((s) => s.id))].sort()).toEqual([...staffIds].sort());
  });

  it('guards each scenario with an action the contract lists for that endpoint', () => {
    for (const spec of SPECS) {
      const def = endpoints[spec.id] as unknown as EndpointDef;
      if (spec.id === 'adminRoles.revokeInvite') continue; // also guarded by the national-admin rule
      expect(def.actions, `${spec.id} ${spec.label}`).toContain(spec.action);
    }
  });

  it('refers only to actions that exist in the scope matrix', () => {
    for (const spec of SPECS) expect(SCOPE_ACTIONS).toContain(spec.action);
  });
});

async function build(): Promise<{
  fx: Fixture;
  callers: { name: string; actor: Actor | null }[];
}> {
  await h.reset();
  const { world } = h;
  const admin = await h.nationalAdmin();
  const session = await createSession(h, { venueId: world.venueA1, as: admin });
  const occurrenceId = (
    await h.api('adminSessions.occurrences', { as: admin, params: { sessionId: session.id } })
  ).json<{ items: { id: string }[] }>().items[0]!.id;
  const attendee = await h.person();
  const registered = await h.api('registrations.create', {
    as: attendee,
    body: {
      sessionId: session.id,
      areaId: world.cityA.areaId,
      section: 'family',
      partySize: 1,
      allowWhatsapp: true,
    },
  });
  const circle = await h.api('adminCircles.create', {
    as: await h.venueCoordinator(world.venueA1),
    body: { venueId: world.venueA1, name: { en: 'Pending circle' }, language: 'en' },
  });
  const held = await h.person();
  const [assignment] = await h.db
    .insert(schema.roleAssignments)
    .values({
      userId: held.userId,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venueA1,
      createdAt: h.clock.now(),
    })
    .returning();
  const [invite] = await h.db
    .insert(schema.coordinatorInvites)
    .values({
      phoneE164: '+923000009100',
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venueA1,
      status: 'pending',
      createdAt: h.clock.now(),
      expiresAt: new Date(h.clock.now().getTime() + 86_400_000),
    })
    .returning();
  const target = await h.person();
  const fx: Fixture = {
    sessionId: session.id,
    occurrenceId,
    registrationId: registered.json<{ id: string }>().id,
    circleId: circle.json<{ id: string }>().id,
    inviteId: invite!.id,
    assignmentId: assignment!.id,
    handoverTargetUserId: target.userId,
    venueId: world.venueA1,
    cityId: world.cityA.id,
  };
  const callers = [
    { name: 'anonymous', actor: null },
    { name: 'attendee', actor: await h.person() },
    { name: 'venue coordinator of the venue', actor: await h.venueCoordinator(world.venueA1) },
    {
      name: 'venue coordinator of another venue in the city',
      actor: await h.venueCoordinator(world.venueA2),
    },
    { name: 'venue coordinator in another city', actor: await h.venueCoordinator(world.venueB1) },
    { name: 'city coordinator of the city', actor: await h.cityCoordinator(world.cityA.id) },
    { name: 'city coordinator of another city', actor: await h.cityCoordinator(world.cityB.id) },
    { name: 'national admin', actor: admin },
  ];
  return { fx, callers };
}

const oracle = (principal: Principal | null, spec: ScenarioSpec, fx: Fixture): boolean => {
  const resource =
    spec.target === 'venue' ? venueRes(fx) : spec.target === 'city' ? { cityId: fx.cityId } : {};
  return can(principal, spec.action, resource);
};

describe('every staff endpoint agrees with the scope engine for every kind of caller', () => {
  for (const spec of SPECS) {
    it(`${spec.id} (${spec.label})`, async () => {
      const { fx, callers } = await build();
      const expectations = callers.map((c) => ({
        ...c,
        allowed: oracle(c.actor?.principal ?? null, spec, fx),
      }));
      // Denied callers first, so allowed callers' changes cannot affect what a denied one sees.
      const ordered = [
        ...expectations.filter((e) => !e.allowed),
        ...expectations.filter((e) => e.allowed),
      ];
      for (const caller of ordered) {
        const res = await h.api(spec.id, { ...spec.request(fx), as: caller.actor });
        const label = `${spec.id} (${spec.label}) as ${caller.name}`;
        if (caller.actor === null) {
          expect(res.status, label).toBe(401);
        } else if (caller.allowed) {
          expect(res.status, label).not.toBe(401);
          expect(res.status, label).not.toBe(403);
          expect(res.status, label).toBeLessThan(500);
        } else {
          expect(res.status, label).toBe(403);
        }
      }
    });
  }

  it('lets a national admin succeed on the happy path of every scenario', async () => {
    // A guard against a table that only ever tests refusals: the oracle's "yes" must be a real yes.
    const happy: Partial<Record<string, number>> = {};
    for (const spec of SPECS) {
      const { fx, callers } = await build();
      const admin = callers.find((c) => c.name === 'national admin')!;
      const res = await h.api(spec.id, { ...spec.request(fx), as: admin.actor });
      happy[`${spec.id} ${spec.label}`] = res.status;
    }
    for (const [name, status] of Object.entries(happy)) {
      expect(status, name).toBeLessThan(300);
    }
  });
});
