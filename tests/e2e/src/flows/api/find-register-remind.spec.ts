import { expect, test } from '@playwright/test';
import { client } from '../../support/client';
import { outboxFor } from '../../support/db';
import { addWebPushDevice, bootstrapNationalAdmin, signIn } from '../../support/people';
import { SEED } from '../../support/seed';
import { minutesFromNow, pktDate, pktTime } from '../../support/time';
import { eventually } from '../../support/wait';

/**
 * Gate 3: "find, register and remind". Discovery is anonymous, registration is signed in, and the
 * reminder is built by the real worker (its per-minute reconcile) and "sent" by the fake push
 * provider. Proof of sending is the outbox row reaching `sent` with a fake provider message id.
 */
test.describe('find a session, register, get a reminder', () => {
  test('anonymous discovery finds seeded sessions by city, area and text', async () => {
    const anon = client({ ip: '10.251.0.1' });
    const cities = await anon.places.cities();
    expect(cities.items.map((c) => c.id)).toContain(SEED.rawalpindi);

    const inCity = await anon.sessions.list({ query: { cityId: SEED.rawalpindi } });
    expect(inCity.items.length).toBeGreaterThan(0);
    expect(inCity.items.every((s) => s.cityId === SEED.rawalpindi)).toBe(true);

    const women = await anon.sessions.list({
      query: { cityId: SEED.rawalpindi, section: 'women' },
    });
    expect(women.items.map((s) => s.id)).toContain(SEED.sessionWomenIqra);

    const byText = await anon.sessions.list({ query: { q: 'Taraweeh' } });
    expect(byText.items.map((s) => s.id)).toContain(SEED.sessionTaraweehNoor);

    const venue = await anon.venues.get({ params: { venueId: SEED.venueNoor } });
    expect(venue.id).toBe(SEED.venueNoor);
    const session = await anon.sessions.get({ params: { sessionId: SEED.sessionTaraweehNoor } });
    expect(session.venueId).toBe(SEED.venueNoor);
  });

  test('register for a seeded session; it shows in my registrations', async () => {
    const person = await signIn();
    const occurrences = await person.api.sessions.occurrences({
      params: { sessionId: SEED.sessionTaraweehNoor },
      query: { limit: 5 },
    });
    const first = occurrences.items[0];
    expect(first, 'seeded session has occurrences').toBeDefined();
    const registration = await person.api.registrations.create({
      body: {
        sessionId: SEED.sessionTaraweehNoor,
        occurrenceId: first?.id,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 2,
        name: 'E2E Attendee',
        allowWhatsapp: false,
      },
    });
    expect(registration.status).toBe('confirmed');
    const mine = await person.api.registrations.listMine({ query: {} });
    expect(mine.items.map((r) => r.id)).toContain(registration.id);
  });

  test('a registration for a session starting soon gets a push reminder from the worker', async () => {
    const admin = await bootstrapNationalAdmin();
    // 40 minutes ahead: with the default 60-minute lead the reminder is already due, and within
    // the worker's 30-minute grace, so the next reconcile queues it and the dispatcher sends it.
    const startsAt = minutesFromNow(40);
    const created = await admin.api.adminSessions.create({
      body: {
        kind: 'one_off',
        date: pktDate(startsAt),
        venueId: SEED.venueIqra,
        program: 'dora',
        title: { en: 'E2E reminder session' },
        section: 'family',
        language: 'en',
        localStartTime: pktTime(startsAt),
        durationMinutes: 60,
      },
    });
    const occurrences = await admin.api.sessions.occurrences({
      params: { sessionId: created.id },
      query: {},
    });
    const occurrence = occurrences.items[0];
    expect(occurrence, 'one-off session has its occurrence').toBeDefined();
    expect(new Date(occurrence?.startsAt ?? 0).getTime()).toBe(startsAt.getTime());

    const person = await signIn();
    await addWebPushDevice(person);
    await person.api.registrations.create({
      body: {
        sessionId: created.id,
        occurrenceId: occurrence?.id,
        areaId: SEED.areaSatellite,
        section: 'family',
        partySize: 1,
        name: 'E2E Reminder Person',
        allowWhatsapp: false,
      },
    });

    const reminder = await eventually(
      'the reminder push to be sent',
      async () => {
        const rows = await outboxFor(person.me.id);
        const row = rows.find((r) => r.idempotency_key.startsWith(`reminder:${occurrence?.id}:`));
        if (row && ['failed', 'dead'].includes(row.status)) {
          throw new Error(`reminder ${row.status}: ${row.last_error_code ?? 'no code'}`);
        }
        return row && ['sent', 'delivered'].includes(row.status) ? row : null;
      },
      150_000,
      1_000,
    );
    expect(reminder.channel).toBe('push');
    expect(reminder.provider_message_id).toMatch(/^fake-push-/);
    expect(reminder.venue_id).toBe(SEED.venueIqra);
  });
});
