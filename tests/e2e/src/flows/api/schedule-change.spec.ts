import { expect, test } from '@playwright/test';
import { outboxFor } from '../../support/db';
import {
  addWebPushDevice,
  bootstrapNationalAdmin,
  inviteVenueCoordinator,
  signIn,
} from '../../support/people';
import { SEED } from '../../support/seed';
import { pktDate } from '../../support/time';
import { eventually } from '../../support/wait';

/** Brief WP11: "a coordinator changes a session time and the right people are notified". */
test.describe('coordinator changes a session time', () => {
  test('registrants are notified; people at other sessions are not', async () => {
    const admin = await bootstrapNationalAdmin();
    const coordinator = await inviteVenueCoordinator(admin, SEED.venueNoor);

    // A session of the coordinator's own, so the change does not disturb other flows.
    const tomorrow = pktDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const session = await coordinator.api.adminSessions.create({
      body: {
        kind: 'recurring',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn: tomorrow,
        venueId: SEED.venueNoor,
        program: 'dora',
        title: { en: 'E2E schedule session' },
        section: 'family',
        language: 'en',
        localStartTime: '19:00',
        durationMinutes: 45,
      },
    });

    const registrant = await signIn();
    await addWebPushDevice(registrant);
    await registrant.api.registrations.create({
      body: {
        sessionId: session.id,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 1,
        name: 'E2E Registrant',
        allowWhatsapp: false,
      },
    });
    // Agreed to WhatsApp and has no app: a time change is critical, so WhatsApp carries it.
    const whatsappOnly = await signIn();
    await whatsappOnly.api.registrations.create({
      body: {
        sessionId: session.id,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 1,
        name: 'E2E WhatsApp Registrant',
        allowWhatsapp: true,
      },
    });
    // Registered at another venue's session: must hear nothing about this change.
    const elsewhere = await signIn();
    await addWebPushDevice(elsewhere);
    await elsewhere.api.registrations.create({
      body: {
        sessionId: SEED.sessionEnglishHira,
        areaId: SEED.areaF7,
        section: 'family',
        partySize: 1,
        name: 'E2E Elsewhere',
        allowWhatsapp: false,
      },
    });

    const change = await coordinator.api.adminSessions.changeSchedule({
      params: { sessionId: session.id },
      body: { localStartTime: '20:15', effectiveFrom: tomorrow, notify: true },
    });
    expect(change.session.localStartTime).toBe('20:15');
    expect(change.occurrencesChanged).toBeGreaterThan(0);
    expect(change.updatePostedId).not.toBeNull();

    const occurrences = await registrant.api.sessions.occurrences({
      params: { sessionId: session.id },
      query: { limit: 3 },
    });
    for (const o of occurrences.items) {
      // 20:15 in Pakistan is 15:15 UTC.
      expect(new Date(o.startsAt).toISOString().slice(11, 16)).toBe('15:15');
    }

    const feed = await registrant.api.updates.feed({ query: {} });
    const notice = feed.items.find((u) => u.id === change.updatePostedId);
    expect(notice?.kind).toBe('time_change');
    expect(notice?.sessionId).toBe(session.id);

    const push = await eventually('the time-change push to the registrant', async () => {
      const row = (await outboxFor(registrant.me.id)).find(
        (r) => r.update_id === change.updatePostedId && r.channel === 'push',
      );
      if (row && ['failed', 'dead'].includes(row.status)) {
        throw new Error(`time-change push ${row.status}: ${row.last_error_code ?? 'no code'}`);
      }
      return row && ['sent', 'delivered'].includes(row.status) ? row : null;
    });
    expect(push.provider_message_id).toMatch(/^fake-push-/);

    const whatsapp = await eventually(
      'the time-change WhatsApp to the registrant without the app',
      async () => {
        const row = (await outboxFor(whatsappOnly.me.id)).find((r) => r.channel === 'whatsapp');
        if (row && ['failed', 'dead'].includes(row.status)) {
          throw new Error(
            `time-change WhatsApp ${row.status}: ${row.last_error_code ?? 'no code'}`,
          );
        }
        return row && ['sent', 'delivered'].includes(row.status) ? row : null;
      },
    );
    expect(whatsapp.template_key).not.toBeNull();

    const elsewhereFeed = await elsewhere.api.updates.feed({ query: {} });
    expect(elsewhereFeed.items.map((u) => u.id)).not.toContain(change.updatePostedId);
    const elsewhereRows = await outboxFor(elsewhere.me.id);
    expect(elsewhereRows.filter((r) => r.update_id === change.updatePostedId)).toEqual([]);
  });

  test('a reminder already queued moves with the new time', async () => {
    const admin = await bootstrapNationalAdmin();
    const coordinator = await inviteVenueCoordinator(admin, SEED.venueNoor);
    const tomorrow = pktDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const session = await coordinator.api.adminSessions.create({
      body: {
        kind: 'recurring',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn: tomorrow,
        venueId: SEED.venueNoor,
        program: 'dora',
        title: { en: 'E2E reminder retime session' },
        section: 'family',
        language: 'en',
        localStartTime: '19:00',
        durationMinutes: 45,
      },
    });
    const occurrences = await coordinator.api.sessions.occurrences({
      params: { sessionId: session.id },
      query: { limit: 1 },
    });
    const first = occurrences.items[0];
    expect(first).toBeDefined();
    const person = await signIn();
    await addWebPushDevice(person);
    await person.api.registrations.create({
      body: {
        sessionId: session.id,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 1,
        name: 'E2E Retime Person',
        allowWhatsapp: false,
      },
    });
    const key = `reminder:${first?.id}:${person.me.id}:push`;
    const reminderAt = async (): Promise<string | null> => {
      const row = (await outboxFor(person.me.id)).find((r) => r.idempotency_key === key);
      return row?.status === 'queued' ? row.next_attempt_at.toISOString() : null;
    };
    // 19:00 in Pakistan is 14:00 UTC; the default lead is 60 minutes.
    const queued = await eventually('the reminder to be queued', reminderAt, 150_000, 1_000);
    expect(queued).toBe(`${tomorrow}T13:00:00.000Z`);

    await coordinator.api.adminSessions.changeSchedule({
      params: { sessionId: session.id },
      body: { localStartTime: '20:15', effectiveFrom: tomorrow, notify: false },
    });
    // 20:15 in Pakistan is 15:15 UTC, so the reminder goes at 14:15 UTC.
    const moved = await eventually(
      'the reminder to move to the new time',
      async () => {
        const at = await reminderAt();
        return at === `${tomorrow}T14:15:00.000Z` ? at : null;
      },
      150_000,
      1_000,
    );
    expect(moved).toBe(`${tomorrow}T14:15:00.000Z`);
  });
});
