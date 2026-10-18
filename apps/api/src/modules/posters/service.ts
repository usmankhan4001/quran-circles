import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  POSTER_FORMATS,
  PosterAltText,
  PosterFields,
  PosterSourceSnapshot,
  posterLocaleOf,
  posterOutOfDate,
  posterSnapshotFromSession,
  type Poster,
  type PosterCreate,
  type PosterFormat,
  type PosterLanguage,
  type PosterTemplate,
  type ResourceScope,
  type ScopeAction,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import type { Logger } from '../../middleware/logger';
import { venueScope, writeAudit } from '../shared/audit';
import { fail } from '../shared/errors';
import { localized } from '../shared/mappers';
import { loadSessions } from '../sessions/views';
import type { PosterRuntime } from './runtime';

const { posters, posterTemplates, sessions, venues, areas } = schema;

type PosterRow = typeof posters.$inferSelect;
type TemplateRow = typeof posterTemplates.$inferSelect;

/** The decisions a poster handler needs from the request (`HandlerCtx`). */
export interface PosterGuard {
  authorize(action: ScopeAction, resource?: ResourceScope): void;
  missing(action: ScopeAction): never;
  unknownRef(action: ScopeAction): never;
}

export interface PosterDeps {
  db: Db;
  runtime: PosterRuntime;
  logger: Logger;
  now: Date;
  guard: PosterGuard;
}

/**
 * How long a queued poster blocks a new one for the same session and template (SEC-13). The worker
 * finishes or fails a job well within this (pg-boss expiry and dead letter); the bound only keeps a
 * row that was somehow left `queued` from blocking that template for the session for ever.
 */
export const POSTER_QUEUED_BLOCK_MS = 60 * 60 * 1000;

const FORMAT_ORDER = new Map<PosterFormat, number>(POSTER_FORMATS.map((f, i) => [f, i]));
const isFormat = (value: string): value is PosterFormat => FORMAT_ORDER.has(value as PosterFormat);

/** Story and link preview are images; the two print sizes are PDFs. */
export const posterContentType = (format: PosterFormat): 'image/png' | 'application/pdf' =>
  format === 'print_a4' || format === 'print_a3' ? 'application/pdf' : 'image/png';

/** The `adminPosters.file` path, relative to the API base. */
export const posterFilePath = (posterId: string): string => `/v1/admin/posters/${posterId}/file`;

// Templates --------------------------------------------------------------------------------------

const toTemplate = (row: TemplateRow): PosterTemplate => ({
  id: row.id,
  key: row.key,
  name: { en: row.nameEn, ur: row.nameUr },
  version: row.version,
  formats: row.formats.filter(isFormat),
  provisional: row.provisional,
});

/** The active templates, by key. */
export async function listTemplates(db: Db): Promise<{ items: PosterTemplate[] }> {
  const rows = await db
    .select()
    .from(posterTemplates)
    .where(eq(posterTemplates.isActive, true))
    .orderBy(asc(posterTemplates.key));
  return { items: rows.map(toTemplate) };
}

// The session as a poster sees it ----------------------------------------------------------------

interface SessionTarget {
  sessionId: string;
  venueId: string;
  cityId: string;
}

async function findSessionTarget(db: Db, sessionId: string): Promise<SessionTarget | null> {
  const [row] = await db
    .select({ sessionId: sessions.id, venueId: sessions.venueId, cityId: venues.cityId })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(eq(sessions.id, sessionId));
  return row ?? null;
}

const resourceOf = (t: { venueId: string; cityId: string }): ResourceScope => ({
  cityId: t.cityId,
  venueId: t.venueId,
});

/**
 * The snapshot of the session as it is now (`posterSnapshotFromSession`), with the venue's area
 * name and the session's `updatedAt` as its version. Runs its queries one after another, so it is
 * safe inside a transaction (F-02).
 */
async function currentSnapshot(db: Db, sessionId: string, now: Date) {
  const [session] = await loadSessions(db, [sessionId], now);
  const [meta] = await db
    .select({
      updatedAt: sessions.updatedAt,
      areaEn: areas.nameEn,
      areaUr: areas.nameUr,
    })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .where(eq(sessions.id, sessionId));
  if (!session || !meta) return null;
  return posterSnapshotFromSession(
    session,
    meta.updatedAt.toISOString(),
    localized(meta.areaEn, meta.areaUr),
  );
}

// Mapping ----------------------------------------------------------------------------------------

/** Rows made before migration 0010 have no `language`: their locale is the only language. */
const languageOf = (row: PosterRow): PosterLanguage => row.language ?? row.locale;

/**
 * The contract's view of a row, or null for a row whose stored fields or snapshot no longer parse
 * (none are written that way; the list leaves such a row out rather than failing as a whole).
 */
function toPoster(
  row: PosterRow,
  templateKey: string,
  current: PosterSourceSnapshot | null,
): Poster | null {
  const fields = PosterFields.safeParse(row.fields);
  const snapshot = PosterSourceSnapshot.safeParse(row.sourceSnapshot);
  if (!fields.success || !snapshot.success) return null;
  const altText = row.altText ? PosterAltText.safeParse(row.altText) : null;
  const reasons =
    current && current.sessionId === snapshot.data.sessionId
      ? posterOutOfDate(snapshot.data, current)
      : [];
  return {
    id: row.id,
    sessionId: row.sessionId,
    templateKey,
    format: row.format,
    language: languageOf(row),
    locale: row.locale,
    fields: fields.data,
    status: row.status,
    failureCode: row.status === 'failed' ? row.failureCode : null,
    altText: row.status === 'ready' && altText?.success ? altText.data : null,
    fileUrl: row.status === 'ready' && row.storageKey ? posterFilePath(row.id) : null,
    sourceSnapshot: snapshot.data,
    outOfDate: reasons.length > 0 ? { reasons } : null,
    replacesPosterId: row.replacesPosterId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Newest first; one request's rows (same time) in the order of `POSTER_FORMATS`. */
const newestFirst = (a: PosterRow, b: PosterRow): number =>
  b.createdAt.getTime() - a.createdAt.getTime() ||
  (FORMAT_ORDER.get(a.format) ?? 0) - (FORMAT_ORDER.get(b.format) ?? 0) ||
  a.id.localeCompare(b.id);

async function templateKeys(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: posterTemplates.id, key: posterTemplates.key })
    .from(posterTemplates)
    .where(inArray(posterTemplates.id, unique));
  return new Map(rows.map((r) => [r.id, r.key]));
}

function mapRows(
  rows: readonly PosterRow[],
  keys: Map<string, string>,
  current: PosterSourceSnapshot | null,
  logger: Logger,
): Poster[] {
  const out: Poster[] = [];
  for (const row of [...rows].sort(newestFirst)) {
    const poster = toPoster(row, keys.get(row.templateId) ?? '', current);
    if (poster) out.push(poster);
    else logger.warn('poster row left out: stored fields or snapshot do not parse', { id: row.id });
  }
  return out;
}

// Queueing ---------------------------------------------------------------------------------------

/**
 * Hands the new rows to the worker, after the commit (so the worker always finds them). When the
 * queue refuses, the rows are marked `failed` with `render_failed` and returned that way: the
 * person sees a failed poster they can make again, never one that waits for a render nobody asked
 * for.
 */
async function enqueueOrFail(deps: PosterDeps, rows: PosterRow[]): Promise<PosterRow[]> {
  const posterIds = rows.map((r) => r.id);
  try {
    await deps.runtime.queue.enqueue({ posterIds });
    return rows;
  } catch (error) {
    deps.logger.error('poster render job could not be queued', {
      posterIds,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return deps.db
      .update(posters)
      .set({ status: 'failed', failureCode: 'render_failed' })
      .where(inArray(posters.id, posterIds))
      .returning();
  }
}

// Endpoints --------------------------------------------------------------------------------------

/**
 * `adminPosters.create`: one queued row per format, one job, one audit row. While a poster for the
 * same session and template is still queued (made within `POSTER_QUEUED_BLOCK_MS`), a new one is
 * `conflict` (SEC-13): the person waits for it, or regenerates it once it is done. The stored snapshot is
 * the session as it is now; the worker renders the session as it is when the job runs and replaces
 * `source_snapshot` with what it printed, so `outOfDate` always compares against the printed one.
 * The job is sent after the commit with no options: the worker's queue sets retry and expiry.
 */
export async function createPosters(
  deps: PosterDeps,
  actorUserId: string,
  sessionId: string,
  body: PosterCreate,
): Promise<{ items: Poster[] }> {
  const { db, guard, now } = deps;
  const target = await findSessionTarget(db, sessionId);
  if (!target) return guard.missing('poster.create');
  guard.authorize('poster.create', resourceOf(target));

  const [template] = await db
    .select()
    .from(posterTemplates)
    .where(eq(posterTemplates.key, body.templateKey));
  if (!template || !template.isActive) return guard.unknownRef('poster.create');
  if (body.formats.some((f) => !template.formats.includes(f))) {
    fail('validation_failed', { issues: [{ path: 'formats', code: 'invalid_value' }] });
  }

  const inserted = await db.transaction(async (tx) => {
    // One maker at a time per session and template, so two parallel requests cannot both pass the
    // check below (transaction-scoped lock, released at commit or rollback).
    const lockKey = `poster_create:${sessionId}:${template.id}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const [waiting] = await tx
      .select({ id: posters.id })
      .from(posters)
      .where(
        and(
          eq(posters.sessionId, sessionId),
          eq(posters.templateId, template.id),
          eq(posters.status, 'queued'),
          gt(posters.createdAt, new Date(now.getTime() - POSTER_QUEUED_BLOCK_MS)),
        ),
      )
      .limit(1);
    if (waiting) return fail('conflict');
    const snapshot = await currentSnapshot(tx, sessionId, now);
    if (!snapshot) return guard.missing('poster.create');
    const rows = await tx
      .insert(posters)
      .values(
        body.formats.map((format) => ({
          templateId: template.id,
          sessionId,
          createdBy: actorUserId,
          format,
          language: body.language,
          locale: posterLocaleOf(body.language),
          fields: body.fields,
          sourceSnapshot: snapshot,
          status: 'queued' as const,
          createdAt: now,
        })),
      )
      .returning();
    await writeAudit(tx, {
      actorUserId,
      action: 'poster.create',
      entityType: 'session',
      entityId: sessionId,
      scope: venueScope({ id: target.venueId, cityId: target.cityId }),
      meta: {
        posterIds: rows.map((r) => r.id),
        templateKey: template.key,
        language: body.language,
        formats: body.formats,
      },
    });
    return { rows, snapshot };
  });

  const rows = await enqueueOrFail(deps, inserted.rows);
  return {
    items: mapRows(rows, new Map([[template.id, template.key]]), inserted.snapshot, deps.logger),
  };
}

/** `adminPosters.list`: the session's posters, newest first, each compared with the session now. */
export async function listPosters(
  deps: Omit<PosterDeps, 'runtime'>,
  sessionId: string,
): Promise<{ items: Poster[] }> {
  const { db, guard, now } = deps;
  const target = await findSessionTarget(db, sessionId);
  if (!target) return guard.missing('poster.read');
  guard.authorize('poster.read', resourceOf(target));
  const rows = await db.select().from(posters).where(eq(posters.sessionId, sessionId));
  const current = await currentSnapshot(db, sessionId, now);
  const keys = await templateKeys(
    db,
    rows.map((r) => r.templateId),
  );
  return { items: mapRows(rows, keys, current, deps.logger) };
}

/** A poster with its session's venue, for the scope check. */
async function findPosterTarget(db: Db, posterId: string) {
  const [row] = await db
    .select({ poster: posters, venueId: sessions.venueId, cityId: venues.cityId })
    .from(posters)
    .innerJoin(sessions, eq(sessions.id, posters.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(eq(posters.id, posterId));
  return row ?? null;
}

/**
 * `adminPosters.regenerate`: the same template, language, format and fields with a fresh snapshot,
 * as a new queued row that names the one it replaces. A poster still queued is `conflict`. A
 * template retired since (inactive) is `not_found`, as for `adminPosters.create`.
 */
export async function regeneratePoster(
  deps: PosterDeps,
  actorUserId: string,
  posterId: string,
): Promise<Poster> {
  const { db, guard, now } = deps;
  const found = await findPosterTarget(db, posterId);
  if (!found) return guard.missing('poster.create');
  guard.authorize('poster.create', resourceOf(found));
  const old = found.poster;
  if (old.status === 'queued') fail('conflict');

  const [template] = await db
    .select()
    .from(posterTemplates)
    .where(eq(posterTemplates.id, old.templateId));
  if (!template || !template.isActive) return guard.unknownRef('poster.create');
  const fields = PosterFields.safeParse(old.fields);
  if (!fields.success) fail('conflict');

  const inserted = await db.transaction(async (tx) => {
    const snapshot = await currentSnapshot(tx, old.sessionId, now);
    if (!snapshot) return guard.missing('poster.create');
    const language = languageOf(old);
    const [row] = await tx
      .insert(posters)
      .values({
        templateId: old.templateId,
        sessionId: old.sessionId,
        createdBy: actorUserId,
        format: old.format,
        language,
        locale: posterLocaleOf(language),
        fields: fields.data,
        sourceSnapshot: snapshot,
        status: 'queued',
        replacesPosterId: old.id,
        createdAt: now,
      })
      .returning();
    if (!row) throw new Error('poster not inserted');
    await writeAudit(tx, {
      actorUserId,
      action: 'poster.regenerate',
      entityType: 'poster',
      entityId: row.id,
      scope: venueScope({ id: found.venueId, cityId: found.cityId }),
      meta: {
        sessionId: old.sessionId,
        replacesPosterId: old.id,
        templateKey: template.key,
        format: old.format,
      },
    });
    return { row, snapshot };
  });

  const [row] = await enqueueOrFail(deps, [inserted.row]);
  const poster = row ? toPoster(row, template.key, inserted.snapshot) : null;
  if (!poster) throw new Error('regenerated poster does not map');
  return poster;
}

export interface PosterFile {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: 'image/png' | 'application/pdf';
  filename: string;
}

/** `adminPosters.file`: the stored bytes of a ready poster. Not ready: `conflict`. */
export async function readPosterFile(deps: PosterDeps, posterId: string): Promise<PosterFile> {
  const { db, guard } = deps;
  const found = await findPosterTarget(db, posterId);
  if (!found) return guard.missing('poster.read');
  guard.authorize('poster.read', resourceOf(found));
  const row = found.poster;
  if (row.status !== 'ready' || !row.storageKey) fail('conflict');

  const bytes = await deps.runtime.storage.read(row.storageKey);
  if (!bytes) {
    // The row says ready but the file is gone (removed with a regeneration, or a storage fault).
    deps.logger.warn('poster file missing from storage', { id: row.id });
    fail('not_found');
  }
  const [template] = await db
    .select({ key: posterTemplates.key })
    .from(posterTemplates)
    .where(eq(posterTemplates.id, row.templateId));
  const contentType = posterContentType(row.format);
  const ext = contentType === 'application/pdf' ? 'pdf' : 'png';
  return {
    bytes,
    contentType,
    filename: `poster-${template?.key ?? 'poster'}-${row.format}.${ext}`,
  };
}
