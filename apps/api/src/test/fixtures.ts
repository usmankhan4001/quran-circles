import { eq } from 'drizzle-orm';
import { schema } from '@qc/db';
import {
  DEMO_POSTER_TEMPLATES,
  posterStorageKey,
  type AdminCircle,
  type AdminSession,
  type PosterFailureCode,
  type Registration,
} from '@qc/contracts';
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

/** The demo poster templates (`cloud`, `night`), as the development seed inserts them. */
export async function seedPosterTemplates(
  h: Harness,
  extra: Partial<typeof schema.posterTemplates.$inferInsert>[] = [],
): Promise<Map<string, string>> {
  const rows = await h.db
    .insert(schema.posterTemplates)
    .values([
      ...DEMO_POSTER_TEMPLATES.map((t) => ({
        key: t.key,
        nameEn: t.name.en,
        nameUr: t.name.ur,
        version: t.version,
        formats: [...t.formats],
        provisional: t.provisional,
      })),
      ...extra.map((t, i) => ({
        key: `extra-${i}`,
        nameEn: 'Extra',
        nameUr: 'اضافی',
        formats: ['story'],
        ...t,
      })),
    ])
    .returning({ id: schema.posterTemplates.id, key: schema.posterTemplates.key });
  return new Map(rows.map((r) => [r.key, r.id]));
}

/** Bytes that start like a PNG or a PDF; enough to tell them apart. Not real images. */
export const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
export const FAKE_PDF = new TextEncoder().encode('%PDF-1.7\n% synthetic test file\n%%EOF\n');

/**
 * Does what the worker does when a render succeeds: stores the bytes under `posterStorageKey` and
 * marks the row ready with its key and alt text.
 */
export async function finishPoster(
  h: Harness,
  posterId: string,
  o: { bytes?: Uint8Array; store?: boolean } = {},
): Promise<string> {
  const [row] = await h.db.select().from(schema.posters).where(eq(schema.posters.id, posterId));
  if (!row) throw new Error('poster not found');
  const contentType =
    row.format === 'print_a4' || row.format === 'print_a3' ? 'application/pdf' : 'image/png';
  const key = posterStorageKey(
    row.sessionId,
    posterId.replace(/-/g, '').padEnd(64, '0'),
    contentType,
  );
  if (o.store !== false) {
    h.putPosterFile(key, o.bytes ?? (contentType === 'application/pdf' ? FAKE_PDF : FAKE_PNG));
  }
  await h.db
    .update(schema.posters)
    .set({ status: 'ready', storageKey: key, altText: { en: 'A poster for a circle.' } })
    .where(eq(schema.posters.id, posterId));
  return key;
}

/** Does what the worker does when a render fails for good. */
export async function failPoster(h: Harness, posterId: string, code: PosterFailureCode) {
  await h.db
    .update(schema.posters)
    .set({ status: 'failed', failureCode: code })
    .where(eq(schema.posters.id, posterId));
}
