import { schema } from '@qc/db';
import type { AdminCircle, AdminSession, Registration } from '@qc/contracts';
import type { Actor, Harness } from './harness';

/**
 * Builders that go through the real endpoints, so every test also exercises the code that makes
 * its own data. Synthetic names and numbers only.
 */

export interface SessionOptions {
  venueId: string;
  as: Actor;
  title?: string;
  daysOfWeek?: number[];
  localStartTime?: string;
  capacity?: number | null;
  section?: 'women' | 'men' | 'family';
  language?: 'en' | 'ur';
  program?: 'dora' | 'circles';
  startsOn?: string;
  status?: 'draft' | 'published';
  registrationEnabled?: boolean;
  circleId?: string | null;
}

/** A recurring weekly session. The test clock starts on Friday 2026-10-16, 10:00 Pakistan time. */
export async function createSession(h: Harness, o: SessionOptions): Promise<AdminSession> {
  const res = await h.api('adminSessions.create', {
    as: o.as,
    body: {
      kind: 'recurring',
      venueId: o.venueId,
      program: o.program ?? 'circles',
      title: { en: o.title ?? 'Friday circle', ur: null },
      section: o.section ?? 'family',
      language: o.language ?? 'en',
      localStartTime: o.localStartTime ?? '18:00',
      durationMinutes: 60,
      daysOfWeek: o.daysOfWeek ?? [5],
      startsOn: o.startsOn ?? '2026-10-16',
      capacity: o.capacity ?? null,
      status: o.status ?? 'published',
      registrationEnabled: o.registrationEnabled ?? true,
      circleId: o.circleId ?? null,
    },
  });
  if (res.status !== 201) throw new Error(`session not created: ${res.status} ${res.text}`);
  return res.json<AdminSession>();
}

export async function createOneOff(
  h: Harness,
  o: { venueId: string; as: Actor; date: string; localStartTime?: string; title?: string },
): Promise<AdminSession> {
  const res = await h.api('adminSessions.create', {
    as: o.as,
    body: {
      kind: 'one_off',
      venueId: o.venueId,
      program: 'dora',
      title: { en: o.title ?? 'Special lecture', ur: null },
      section: 'family',
      language: 'ur',
      localStartTime: o.localStartTime ?? '20:00',
      durationMinutes: 90,
      date: o.date,
    },
  });
  if (res.status !== 201) throw new Error(`one-off not created: ${res.status} ${res.text}`);
  return res.json<AdminSession>();
}

export async function register(
  h: Harness,
  who: Actor,
  sessionId: string,
  o: {
    areaId: string;
    partySize?: number;
    name?: string;
    allowWhatsapp?: boolean;
    occurrenceId?: string;
  },
): Promise<{ status: number; body: Registration }> {
  const res = await h.api('registrations.create', {
    as: who,
    body: {
      sessionId,
      areaId: o.areaId,
      section: 'family',
      partySize: o.partySize ?? 1,
      allowWhatsapp: o.allowWhatsapp ?? true,
      ...(o.name ? { name: o.name } : {}),
      ...(o.occurrenceId ? { occurrenceId: o.occurrenceId } : {}),
    },
  });
  // Real registrations never share a millisecond; the waitlist order depends on it.
  h.clock.advanceMinutes(1 / 60);
  return { status: res.status, body: res.json<Registration>() };
}

export async function outboxRows(h: Harness) {
  return h.db.select().from(schema.messageOutbox);
}

export async function auditRows(h: Harness) {
  return h.db.select().from(schema.auditLog);
}

export async function createCircle(
  h: Harness,
  o: {
    venueId: string;
    as: Actor;
    name?: string;
    language?: 'en' | 'ur';
    section?: 'women' | 'men' | 'family';
  },
): Promise<AdminCircle> {
  const res = await h.api('adminCircles.create', {
    as: o.as,
    body: {
      venueId: o.venueId,
      name: { en: o.name ?? 'Tuesday circle' },
      language: o.language ?? 'en',
      section: o.section ?? 'family',
    },
  });
  if (res.status !== 201) throw new Error(`circle not created: ${res.status} ${res.text}`);
  return res.json<AdminCircle>();
}
