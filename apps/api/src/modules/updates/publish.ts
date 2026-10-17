import { and, asc, eq, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  buildDeepLink,
  renderTemplate,
  type DeepLink,
  type Locale,
  type OutboxPayload,
  type UpdateKind,
} from '@qc/contracts';
import { messages } from '@qc/i18n';
import { schema, type Db } from '../../db';
import { enqueueOutbox, type OutboxEntry } from '../shared/outbox';
import { formatWhen } from '../shared/time';
import { reachUserIds, type UpdateScopeRef } from './reach';

const {
  updates,
  users,
  devices,
  registrations,
  follows,
  circles,
  consents,
  sessions,
  venues,
  occurrences,
} = schema;

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
  /** Also queue a push to everyone in reach who has a device. */
  notify: boolean;
}

export interface PublishDeps {
  now: Date;
  webBase?: string | undefined;
}

const pick = (text: Text, locale: Locale): string =>
  locale === 'ur' && text.ur ? text.ur : text.en;

const PUSH_TYPE: Record<UpdateKind, 'update' | 'session_changed' | 'session_cancelled'> = {
  announcement: 'update',
  special_lecture: 'update',
  time_change: 'session_changed',
  cancellation: 'session_cancelled',
};

/**
 * Posts an update to the feed and queues a push for everyone in reach who has a registered device.
 * Returns the number of people the update reaches. Run it in the same transaction as the write
 * that caused it.
 */
export async function publishUpdate(
  db: Db,
  deps: PublishDeps,
  input: PublishInput,
): Promise<{ updateId: string; recipients: number }> {
  const { scope } = input;
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
    })
    .returning({ id: updates.id });
  if (!row) throw new Error('update insert returned no row');

  const reach = await reachUserIds(db, scope);
  if (input.notify && reach.length > 0) {
    const entries = await pushEntries(db, deps, input, row.id, reach);
    await enqueueOutbox(db, entries);
  }
  return { updateId: row.id, recipients: reach.length };
}

async function pushEntries(
  db: Db,
  deps: PublishDeps,
  input: PublishInput,
  updateId: string,
  reach: readonly string[],
): Promise<OutboxEntry[]> {
  const link: DeepLink = { type: 'update', updateId };
  const deepLink = buildDeepLink(link, deps.webBase);
  const out: OutboxEntry[] = [];
  const cityId = input.scope.type === 'national' ? null : input.scope.cityId;
  const venueId = input.scope.type === 'venue' ? input.scope.venueId : null;
  for (let i = 0; i < reach.length; i += 1000) {
    const rows = await db
      .selectDistinct({ id: users.id, locale: users.locale })
      .from(users)
      .innerJoin(devices, eq(devices.userId, users.id))
      .where(and(inArray(users.id, reach.slice(i, i + 1000)), isNull(devices.revokedAt)));
    for (const user of rows) {
      const payload: OutboxPayload = {
        channel: 'push',
        push: {
          title: clip(pick(input.title, user.locale), 120),
          body: clip(pick(input.body, user.locale), 500),
          data: {
            type: PUSH_TYPE[input.kind],
            deepLink,
            updateId,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          },
          collapseKey: `update:${updateId}`,
          ttlSeconds: 6 * 3600,
        },
      };
      out.push({
        key: `update:${updateId}:${user.id}:push`,
        payload,
        recipientUserId: user.id,
        cityId,
        venueId,
        sentBy: input.authorId,
        updateId,
      });
    }
  }
  return out;
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
  const [registered, followers] = await Promise.all([
    db
      .selectDistinct({ id: users.id, locale: users.locale, phone: users.phoneE164 })
      .from(registrations)
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(
        and(
          eq(registrations.sessionId, session.id),
          ne(registrations.status, 'cancelled'),
          eq(users.status, 'active'),
        ),
      ),
    db
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
      ),
  ]);
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
