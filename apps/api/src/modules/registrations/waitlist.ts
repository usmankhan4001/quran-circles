import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { buildDeepLink, renderTemplate, type Locale, type OutboxPayload } from '@qc/contracts';
import { messages } from '@qc/i18n';
import { schema, type Db } from '../../db';
import { enqueueOutbox, type OutboxEntry } from '../shared/outbox';
import { formatWhen } from '../shared/time';
import { nextStart, sessionFacts, whatsappConsented, type PublishDeps } from '../updates/publish';

const { registrations, sessions, users, occurrences, devices } = schema;

const clip = (text: string, max: number): string => (text.length <= max ? text : text.slice(0, max));

/**
 * Moves waitlisted registrations to confirmed, in the order they joined, while seats are free. A
 * party that does not fit is skipped so smaller parties behind it can take the seats. Locks the
 * session row, so two cancellations at once cannot give the same seat twice. Returns the ids of
 * the registrations that were promoted and queues their messages.
 */
export async function promoteWaitlist(
  db: Db,
  deps: PublishDeps,
  sessionId: string,
): Promise<string[]> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).for('update');
  if (!session) return [];
  const waiting = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.sessionId, sessionId), eq(registrations.status, 'waitlisted')))
    .orderBy(asc(registrations.createdAt), asc(registrations.id));
  if (waiting.length === 0) return [];

  const capacity = session.capacityEnabled ? session.capacity : null;
  let seats = 0;
  if (capacity !== null) {
    const [row] = await db
      .select({ seats: sql<number>`coalesce(sum(${registrations.partySize}), 0)`.mapWith(Number) })
      .from(registrations)
      .where(and(eq(registrations.sessionId, sessionId), eq(registrations.status, 'confirmed')));
    seats = row?.seats ?? 0;
  }
  const promoted: typeof waiting = [];
  for (const reg of waiting) {
    if (capacity === null || seats + reg.partySize <= capacity) {
      promoted.push(reg);
      seats += reg.partySize;
    }
  }
  if (promoted.length === 0) return [];
  for (const reg of promoted) {
    await db.update(registrations).set({ status: 'confirmed' }).where(eq(registrations.id, reg.id));
  }
  await queuePromotionMessages(db, deps, sessionId, promoted);
  return promoted.map((r) => r.id);
}

async function queuePromotionMessages(
  db: Db,
  deps: PublishDeps,
  sessionId: string,
  promoted: { id: string; userId: string | null; occurrenceId: string | null }[],
): Promise<void> {
  const facts = await sessionFacts(db, sessionId);
  if (!facts) return;
  const withUser = promoted.filter((p): p is typeof p & { userId: string } => p.userId !== null);
  if (withUser.length === 0) return;
  const userIds = withUser.map((p) => p.userId);
  const userRows = await db
    .select({ id: users.id, locale: users.locale, phone: users.phoneE164 })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const deviceRows = await db
    .selectDistinct({ userId: devices.userId })
    .from(devices)
    .where(and(isNull(devices.revokedAt), inArray(devices.userId, userIds)));
  const hasDevice = new Set(deviceRows.map((d) => d.userId));
  const consented = await whatsappConsented(db, userIds, facts.venueId);
  const fallbackStart = await nextStart(db, sessionId, deps.now);
  const link = buildDeepLink({ type: 'session', sessionId }, deps.webBase);

  const entries: OutboxEntry[] = [];
  for (const reg of withUser) {
    const user = userById.get(reg.userId);
    if (!user) continue;
    let start = fallbackStart;
    if (reg.occurrenceId) {
      const [o] = await db
        .select({ startsAt: occurrences.startsAt })
        .from(occurrences)
        .where(eq(occurrences.id, reg.occurrenceId));
      start = o?.startsAt ?? start;
    }
    const locale: Locale = user.locale;
    const vars = {
      sessionTitle: clip(locale === 'ur' ? facts.titleUr : facts.titleEn, 200),
      when: clip(start ? formatWhen(start, facts.timezone, locale) : '-', 200),
      link,
    };
    if (consented.has(user.id)) {
      const payload: OutboxPayload = {
        channel: 'whatsapp',
        template: 'waitlist_promoted',
        locale,
        variables: vars,
      };
      entries.push({
        key: `waitlist_promoted:${reg.id}:whatsapp`,
        payload,
        recipientUserId: user.id,
        recipientPhone: user.phone,
        cityId: facts.cityId,
      });
    }
    if (hasDevice.has(user.id)) {
      entries.push({
        key: `waitlist_promoted:${reg.id}:push`,
        payload: {
          channel: 'push',
          push: {
            title: messages[locale]['notifications.waitlistPromoted.title'],
            body: clip(renderTemplate('waitlist_promoted', locale, vars), 500),
            data: {
              type: 'waitlist_promoted',
              deepLink: link,
              sessionId,
              ...(reg.occurrenceId ? { occurrenceId: reg.occurrenceId } : {}),
            },
            collapseKey: `waitlist:${sessionId}`,
            ttlSeconds: 6 * 3600,
          },
        },
        recipientUserId: user.id,
        cityId: facts.cityId,
      });
    }
  }
  await enqueueOutbox(db, entries);
}
