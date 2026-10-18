import { and, asc, eq, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  buildDeepLink,
  renderTemplate,
  type Locale,
  type OutboxPayload,
  type UpdateKind,
} from '@qc/contracts';
import { messages } from '@qc/i18n';
import { schema, type Db } from '../../db';
import { enqueueOutbox, type OutboxEntry } from '../shared/outbox';
import { formatWhen } from '../shared/time';
import { reachUserIds, type UpdateScopeRef } from './reach';

const { updates, users, registrations, follows, circles, consents, sessions, venues, occurrences } =
  schema;

const clip = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, max);

export interface Text {
  en: string;
  ur: string | null;
}

export interface PublishInput {
  authorId: string;
  scope: UpdateScopeRef;
  kind: UpdateKind;
  title: Text;
  body: Text;
  sessionId: string | null;
  /** Also push to everyone in reach who has a device (written by the worker, see below). */
  notify: boolean;
}

export interface PublishDeps {
  now: Date;
  webBase?: string | undefined;
}

/**
 * Posts an update to the feed and asks for a push to everyone in reach who has a registered device.
 * Returns the number of people the update reaches. Run it in the same transaction as the write
 * that caused it.
 *
 * The push rows are not written here: with `notify` and someone in reach, the update is marked
 * `push_pending_since` in the same transaction, and the worker writes one outbox row per person
 * with a working device straight after (`fanOutPendingUpdatePushes` in `@qc/db`), with the same
 * people, wording and idempotency keys as before. A national post to 50,000 people answers in
 * milliseconds instead of seconds (load test finding). If the transaction rolls back, so does the
 * mark, so no push goes out for an update that was never posted.
 */
export async function publishUpdate(
  db: Db,
  deps: PublishDeps,
  input: PublishInput,
): Promise<{ updateId: string; recipients: number }> {
  const { scope } = input;
  const reach = await reachUserIds(db, scope);
  const [row] = await db
    .insert(updates)
    .values({
      scopeType: scope.type,
      cityId: scope.type === 'national' ? null : scope.cityId,
      venueId: scope.type === 'venue' ? scope.venueId : null,
      authorId: input.authorId,
      kind: input.kind,
      titleEn: input.title.en,
      titleUr: input.title.ur,
      bodyEn: input.body.en,
      bodyUr: input.body.ur,
      sessionId: input.sessionId,
      publishAt: deps.now,
      pushPendingSince: input.notify && reach.length > 0 ? deps.now : null,
    })
    .returning({ id: updates.id });
  if (!row) throw new Error('update insert returned no row');
  return { updateId: row.id, recipients: reach.length };
}

// ---------------------------------------------------------------------------------------------
// Session changes and cancellations
// ---------------------------------------------------------------------------------------------

export interface SessionFacts {
  id: string;
  titleEn: string;
  titleUr: string;
  venueId: string;
  cityId: string;
  venueNameEn: string;
  venueNameUr: string;
  timezone: string;
}

export async function sessionFacts(db: Db, sessionId: string): Promise<SessionFacts | null> {
  const [row] = await db
    .select({
      id: sessions.id,
      titleEn: sessions.titleEn,
      titleUr: sessions.titleUr,
      venueId: sessions.venueId,
      cityId: venues.cityId,
      venueNameEn: venues.nameEn,
      venueNameUr: venues.nameUr,
      timezone: sessions.timezone,
    })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(eq(sessions.id, sessionId));
  return row ?? null;
}

/** The next scheduled start of a session at or after `now`, for message wording. */
export async function nextStart(db: Db, sessionId: string, now: Date): Promise<Date | null> {
  const [row] = await db
    .select({ startsAt: occurrences.startsAt })
    .from(occurrences)
    .where(
      and(
        eq(occurrences.sessionId, sessionId),
        eq(occurrences.status, 'scheduled'),
        gte(occurrences.endsAt, now),
      ),
    )
    .orderBy(asc(occurrences.startsAt))
    .limit(1);
  return row?.startsAt ?? null;
}

interface Audience {
  id: string;
  locale: Locale;
  phone: string;
}

/**
 * People with a stake in a session: registered for it (confirmed or waitlisted), or following its
 * venue or circle with alerts on.
 */
export async function sessionAudience(db: Db, session: SessionFacts): Promise<Audience[]> {
  // One after another: `db` is often the schedule change's transaction (F-02).
  const registered = await db
    .selectDistinct({ id: users.id, locale: users.locale, phone: users.phoneE164 })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(
      and(
        eq(registrations.sessionId, session.id),
        ne(registrations.status, 'cancelled'),
        eq(users.status, 'active'),
      ),
    );
  const followers = await db
    .selectDistinct({ id: users.id, locale: users.locale, phone: users.phoneE164 })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.userId))
    .leftJoin(circles, eq(circles.id, follows.circleId))
    .where(
      and(
        eq(follows.alertsEnabled, true),
        eq(users.status, 'active'),
        or(eq(follows.venueId, session.venueId), eq(circles.venueId, session.venueId)),
      ),
    );
  const byId = new Map<string, Audience>();
  for (const r of [...registered, ...followers]) byId.set(r.id, r);
  return [...byId.values()];
}

/** Of these people, who has an active WhatsApp consent that covers this venue. */
export async function whatsappConsented(
  db: Db,
  userIds: readonly string[],
  venueId: string,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < userIds.length; i += 1000) {
    const rows = await db
      .selectDistinct({ userId: consents.userId })
      .from(consents)
      .where(
        and(
          inArray(consents.userId, userIds.slice(i, i + 1000)),
          eq(consents.channel, 'whatsapp'),
          isNull(consents.revokedAt),
          inArray(consents.purpose, ['registration_updates', 'venue_alerts']),
          or(isNull(consents.venueId), eq(consents.venueId, venueId)),
        ),
      );
    for (const r of rows) out.add(r.userId);
  }
  return out;
}

export interface SessionEventInput {
  actorId: string;
  session: SessionFacts;
  kind: 'time_change' | 'cancellation';
  /** The start to show: the new time for a change, the cancelled time for a cancellation. */
  when: Date | null;
  notify: boolean;
  /** Replaces the generated wording (a coordinator's own text). */
  title?: Text;
  body?: Text;
}

/**
 * Posts the feed update for a time change or cancellation and queues the messages: a push to
 * everyone in reach with a device (via `publishUpdate`), and a WhatsApp template to the session's
 * registrants and followers who gave WhatsApp consent. The worker applies the daily cap.
 */
export async function publishSessionEvent(
  db: Db,
  deps: PublishDeps,
  input: SessionEventInput,
): Promise<{ updateId: string; recipients: number }> {
  const { session } = input;
  const link = buildDeepLink({ type: 'session', sessionId: session.id }, deps.webBase);
  const whenFor = (locale: Locale): string =>
    input.when ? formatWhen(input.when, session.timezone, locale) : '';
  const titleKey =
    input.kind === 'time_change'
      ? 'notifications.timeChange.title'
      : 'notifications.cancelled.title';
  const generatedTitle = (locale: Locale): string =>
    messages[locale][titleKey].replace(
      '{sessionTitle}',
      locale === 'ur' ? session.titleUr : session.titleEn,
    );
  const template = input.kind === 'time_change' ? 'session_changed' : 'session_cancelled';
  const generatedBody = (locale: Locale): string => {
    const sessionTitle = clip(locale === 'ur' ? session.titleUr : session.titleEn, 200);
    if (template === 'session_changed') {
      return renderTemplate('session_changed', locale, {
        sessionTitle,
        venueName: clip(locale === 'ur' ? session.venueNameUr : session.venueNameEn, 200),
        newWhen: clip(whenFor(locale) || '-', 200),
        link,
      });
    }
    return renderTemplate('session_cancelled', locale, {
      sessionTitle,
      when: clip(whenFor(locale) || '-', 200),
      link,
    });
  };

  const result = await publishUpdate(db, deps, {
    authorId: input.actorId,
    scope: { type: 'venue', venueId: session.venueId, cityId: session.cityId },
    kind: input.kind,
    title: input.title ?? { en: generatedTitle('en'), ur: generatedTitle('ur') },
    body: input.body ?? { en: generatedBody('en'), ur: generatedBody('ur') },
    sessionId: session.id,
    notify: input.notify,
  });

  if (input.notify) {
    const audience = await sessionAudience(db, session);
    const consented = await whatsappConsented(
      db,
      audience.map((a) => a.id),
      session.venueId,
    );
    const entries: OutboxEntry[] = audience
      .filter((a) => consented.has(a.id))
      .map((a) => {
        const sessionTitle = clip(a.locale === 'ur' ? session.titleUr : session.titleEn, 200);
        const payload: OutboxPayload =
          template === 'session_changed'
            ? {
                channel: 'whatsapp',
                template: 'session_changed',
                locale: a.locale,
                variables: {
                  sessionTitle,
                  venueName: clip(
                    a.locale === 'ur' ? session.venueNameUr : session.venueNameEn,
                    200,
                  ),
                  newWhen: clip(whenFor(a.locale) || '-', 200),
                  link,
                },
              }
            : {
                channel: 'whatsapp',
                template: 'session_cancelled',
                locale: a.locale,
                variables: { sessionTitle, when: clip(whenFor(a.locale) || '-', 200), link },
              };
        return {
          key: `${template}:${result.updateId}:${a.id}:whatsapp`,
          payload,
          recipientUserId: a.id,
          recipientPhone: a.phone,
          cityId: session.cityId,
          venueId: session.venueId,
          sentBy: input.actorId,
          updateId: result.updateId,
        };
      });
    await enqueueOutbox(db, entries);
  }
  return result;
}
