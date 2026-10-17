import { and, eq, inArray, notInArray } from 'drizzle-orm';
import {
  POSTER_FAILURE_RETRYABLE,
  PosterFields,
  RendererRenderRequest,
  posterSnapshotFromSession,
  posterStorageKey,
  type PosterFailureCode,
  type PosterFormat,
  type PosterLanguage,
  type PosterRenderJob,
  type PosterSourceSnapshot,
  type Session,
} from '@qc/contracts';
import type { Logger } from '@qc/messaging';
import { tables, type Db } from '../db';
import { callRenderer, type RendererClientConfig } from './renderer-client';
import type { PosterStorage } from './storage';

/**
 * The `poster-render` queue job (contract 1.0.0-rc.5, change request 2026-10-17-poster-renderer).
 *
 * The API inserts one queued `posters` row per format and puts one `PosterRenderJob { posterIds }`
 * on the queue. For those rows the job:
 *
 * 1. loads the rows still `queued` (anything else was finished by an earlier run, so a duplicate or
 *    a retry after success does nothing), with their template key and session;
 * 2. builds the snapshot from the session as it is now (`posterSnapshotFromSession`, version = the
 *    session's `updated_at`, area name included) and one `RendererRenderRequest` per group of rows
 *    that share session, template, language and fields (normally the whole job);
 * 3. calls the renderer (`callRenderer`), stores each file under `posterStorageKey` (content
 *    addressed, so a retry writes the same bytes to the same place);
 * 4. sets each row `ready` with `storage_key`, `alt_text` and the snapshot the renderer printed, in
 *    one transaction, compare-and-set on `status = 'queued'`;
 * 5. for a ready row with `replaces_poster_id`, deletes the old row and then its file, unless another
 *    row still points at the same file (an unchanged regeneration has the same key).
 *
 * On a renderer failure the rows get `status 'failed'` and `failure_code`, except when the code is
 * retryable (`POSTER_FAILURE_RETRYABLE`) and pg-boss has attempts left: then the rows stay `queued`
 * and the summary says `retry`, and the runtime throws so pg-boss tries again with its backoff. A
 * screen therefore never shows "failed" for a poster that is still being retried.
 *
 * Without renderer or storage configuration the queued rows fail with `render_failed` at once (a
 * person can regenerate once it is fixed) and every attempt reports `notConfigured`, which the
 * runtime turns into a failed job; the worker itself keeps running.
 *
 * One log line per job, `posters.render`, counts only (and the failure code, an enum). Never a
 * name, a number, poster text or the token.
 */

export interface PosterRenderDeps {
  db: Db;
  logger: Logger;
  /** Null when `RENDERER_URL` or `RENDERER_TOKEN` is unset. */
  renderer: RendererClientConfig | null;
  /** Null when `POSTER_STORAGE_DIR` is unset. */
  storage: PosterStorage | null;
  /** The variable names that are missing, for the log line. */
  missing?: readonly string[];
}

export interface PosterRenderAttempt {
  /** pg-boss has no retries left for this job. A retryable failure then fails the rows. */
  finalAttempt: boolean;
  /** pg-boss aborts it when the job expires. */
  signal?: AbortSignal;
  /** pg-boss `retryCount`, for the log line. */
  attempt?: number;
}

export interface PosterRenderSummary {
  /** Ids in the job. */
  posters: number;
  /** Ids whose row was not queued any more (finished earlier) or is gone. */
  skipped: number;
  /** Rows set `ready`. */
  ready: number;
  /** Rows set `failed`. */
  failed: number;
  /** Rows left `queued` for a pg-boss retry. */
  retrying: number;
  /** Old rows removed because their regeneration is ready. */
  replaced: number;
  /** Old files removed with them. */
  filesDeleted: number;
  /** Renderer calls made. */
  renderCalls: number;
  /** The last failure, when any. */
  failure: PosterFailureCode | null;
  /** The runtime should throw so pg-boss retries the job. */
  retry: boolean;
  /** Renderer or storage configuration is missing. */
  notConfigured: boolean;
}

export class PosterRenderRetryError extends Error {
  override name = 'PosterRenderRetryError';
}

export class PosterRenderNotConfiguredError extends Error {
  override name = 'PosterRenderNotConfiguredError';
}

interface PendingRow {
  id: string;
  sessionId: string;
  templateKey: string;
  format: PosterFormat;
  language: PosterLanguage;
  fields: unknown;
  replacesPosterId: string | null;
}

interface SessionSource {
  id: string;
  localStartTime: string;
  durationMinutes: number;
  daysOfWeek: number[];
  startsOn: string;
  endsOn: string | null;
  timezone: string;
  updatedAt: Date;
  venueId: string;
  venueNameEn: string;
  venueNameUr: string;
  areaNameEn: string;
  areaNameUr: string;
}

/** The fields of `Session` that `posterSnapshotFromSession` reads. */
type SnapshotSession = Pick<
  Session,
  'id' | 'localStartTime' | 'durationMinutes' | 'daysOfWeek' | 'startsOn' | 'endsOn' | 'timezone'
> & { venue: Pick<Session['venue'], 'id' | 'name'> };

/**
 * The poster snapshot of a session row. `posterSnapshotFromSession` takes the API's whole `Session`
 * but reads only the fields in `SnapshotSession` (packages/contracts/src/posters.ts), and checks its
 * output with `PosterSourceSnapshot.parse`; the worker has the database row, not a `Session`.
 * Throws when the row does not make a valid snapshot.
 */
export function snapshotOfSessionRow(row: SessionSource): PosterSourceSnapshot {
  const session: SnapshotSession = {
    id: row.id,
    // Postgres `time` reads back as HH:MM:SS; the contract's LocalTime is HH:MM.
    localStartTime: row.localStartTime.slice(0, 5),
    durationMinutes: row.durationMinutes,
    daysOfWeek: row.daysOfWeek,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    timezone: row.timezone,
    venue: { id: row.venueId, name: { en: row.venueNameEn, ur: row.venueNameUr } },
  };
  return posterSnapshotFromSession(session as Session, row.updatedAt.toISOString(), {
    en: row.areaNameEn,
    ur: row.areaNameUr,
  });
}

async function loadSession(db: Db, sessionId: string): Promise<SessionSource | null> {
  const { sessions, venues, areas } = tables;
  const [row] = await db
    .select({
      id: sessions.id,
      localStartTime: sessions.localStartTime,
      durationMinutes: sessions.durationMinutes,
      daysOfWeek: sessions.daysOfWeek,
      startsOn: sessions.startsOn,
      endsOn: sessions.endsOn,
      timezone: sessions.timezone,
      updatedAt: sessions.updatedAt,
      venueId: venues.id,
      venueNameEn: venues.nameEn,
      venueNameUr: venues.nameUr,
      areaNameEn: areas.nameEn,
      areaNameUr: areas.nameUr,
    })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .where(eq(sessions.id, sessionId));
  return row ?? null;
}

async function loadPending(db: Db, ids: readonly string[]): Promise<PendingRow[]> {
  const { posters, posterTemplates } = tables;
  const rows = await db
    .select({
      id: posters.id,
      sessionId: posters.sessionId,
      templateKey: posterTemplates.key,
      format: posters.format,
      language: posters.language,
      locale: posters.locale,
      fields: posters.fields,
      replacesPosterId: posters.replacesPosterId,
    })
    .from(posters)
    .innerJoin(posterTemplates, eq(posterTemplates.id, posters.templateId))
    .where(and(inArray(posters.id, [...ids]), eq(posters.status, 'queued')));
  // Rows made before migration 0010 have no `language`; their single language is the locale.
  return rows.map(({ locale, language, ...row }) => ({ ...row, language: language ?? locale }));
}

async function markFailed(
  db: Db,
  ids: readonly string[],
  failure: PosterFailureCode,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { posters } = tables;
  const done = await db
    .update(posters)
    .set({ status: 'failed', failureCode: failure })
    .where(and(inArray(posters.id, [...ids]), eq(posters.status, 'queued')))
    .returning({ id: posters.id });
  return done.length;
}

/** Fails the job's rows that are still queued. For the dead-letter queue: a job pg-boss gave up on. */
export async function failQueuedPosters(
  db: Db,
  ids: readonly string[],
  failure: PosterFailureCode = 'render_failed',
): Promise<number> {
  return markFailed(db, ids, failure);
}

/** Rows that render together: the same session, template, language and fields. */
const groupKey = (row: PendingRow): string =>
  JSON.stringify([row.sessionId, row.templateKey, row.language, row.fields]);

interface GroupOutcome {
  ready: number;
  failed: number;
  retrying: number;
  replaced: number;
  filesDeleted: number;
  renderCalls: number;
  failure: PosterFailureCode | null;
}

async function renderGroup(
  deps: PosterRenderDeps & { renderer: RendererClientConfig; storage: PosterStorage },
  rows: PendingRow[],
  attempt: PosterRenderAttempt,
): Promise<GroupOutcome> {
  const outcome: GroupOutcome = {
    ready: 0,
    failed: 0,
    retrying: 0,
    replaced: 0,
    filesDeleted: 0,
    renderCalls: 0,
    failure: null,
  };
  const ids = rows.map((r) => r.id);
  const fail = async (failure: PosterFailureCode, retryable: boolean): Promise<GroupOutcome> => {
    outcome.failure = failure;
    if (retryable && !attempt.finalAttempt) {
      outcome.retrying = rows.length;
    } else {
      outcome.failed = await markFailed(deps.db, ids, failure);
    }
    return outcome;
  };

  const first = rows[0]!;
  const session = await loadSession(deps.db, first.sessionId);
  if (!session) return fail('invalid_request', false);
  let snapshot: PosterSourceSnapshot;
  try {
    snapshot = snapshotOfSessionRow(session);
  } catch {
    return fail('invalid_request', false);
  }
  const fields = PosterFields.safeParse(first.fields);
  if (!fields.success) return fail('invalid_request', false);
  const formats = [...new Set(rows.map((r) => r.format))];
  const request = RendererRenderRequest.safeParse({
    templateId: first.templateKey,
    formats,
    language: first.language,
    fields: fields.data,
    session: snapshot,
  });
  if (!request.success) return fail('invalid_request', false);

  outcome.renderCalls = 1;
  const result = await callRenderer(deps.renderer, request.data, attempt.signal);
  if (!result.ok) return fail(result.failure, POSTER_FAILURE_RETRYABLE[result.failure]);

  const byFormat = new Map(result.files.map((f) => [f.format, f]));
  if (
    result.response.sourceSnapshot.sessionId !== first.sessionId ||
    formats.some((f) => !byFormat.has(f))
  ) {
    return fail('render_failed', POSTER_FAILURE_RETRYABLE.render_failed);
  }

  // Files first, rows after: a crash in between leaves a file nobody points at (harmless), never a
  // ready row without its file. A storage error throws, and pg-boss retries the job.
  const keys = new Map<PosterFormat, string>();
  for (const format of formats) {
    const file = byFormat.get(format)!;
    const key = posterStorageKey(first.sessionId, file.cacheKey, file.contentType);
    await deps.storage.put(key, file.bytes, file.contentType);
    keys.set(format, key);
  }

  const { posters } = tables;
  const removedKeys = await deps.db.transaction(async (tx) => {
    const replaced: string[] = [];
    for (const row of rows) {
      const done = await tx
        .update(posters)
        .set({
          status: 'ready',
          storageKey: keys.get(row.format)!,
          altText: result.response.altText,
          sourceSnapshot: result.response.sourceSnapshot,
          failureCode: null,
        })
        .where(and(eq(posters.id, row.id), eq(posters.status, 'queued')))
        .returning({ id: posters.id });
      if (done.length === 0) continue;
      outcome.ready += 1;
      if (row.replacesPosterId) replaced.push(row.replacesPosterId);
    }
    if (replaced.length === 0) return [];
    const removed = await tx
      .delete(posters)
      .where(
        and(
          inArray(posters.id, replaced),
          // Only an older poster of the same session, never one this job just finished.
          eq(posters.sessionId, first.sessionId),
          notInArray(posters.id, ids),
        ),
      )
      .returning({ storageKey: posters.storageKey });
    outcome.replaced = removed.length;
    return removed.map((r) => r.storageKey).filter((k): k is string => k !== null);
  });

  for (const key of new Set(removedKeys)) {
    // An unchanged regeneration renders to the same content-addressed key: keep that file.
    const still = await deps.db
      .select({ id: posters.id })
      .from(posters)
      .where(eq(posters.storageKey, key))
      .limit(1);
    if (still.length > 0) continue;
    try {
      await deps.storage.delete(key);
      outcome.filesDeleted += 1;
    } catch (error) {
      // The rows are right; a file left behind is only disk space.
      deps.logger.warn('posters.file_delete_failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return outcome;
}

/** One `poster-render` job. Throws only for database or storage errors (pg-boss retries those). */
export async function renderPosters(
  deps: PosterRenderDeps,
  job: PosterRenderJob,
  attempt: PosterRenderAttempt,
): Promise<PosterRenderSummary> {
  const ids = [...new Set(job.posterIds)];
  const summary: PosterRenderSummary = {
    posters: ids.length,
    skipped: 0,
    ready: 0,
    failed: 0,
    retrying: 0,
    replaced: 0,
    filesDeleted: 0,
    renderCalls: 0,
    failure: null,
    retry: false,
    notConfigured: false,
  };
  const log = (): PosterRenderSummary => {
    const { retry, notConfigured, failure, ...counts } = summary;
    const fields = { ...counts, failure, retry, attempt: attempt.attempt ?? 0 };
    if (notConfigured) {
      deps.logger.error('posters.render', {
        ...fields,
        notConfigured,
        missing: (deps.missing ?? []).join(','),
      });
    } else if (summary.failed > 0 || retry) {
      deps.logger.warn('posters.render', fields);
    } else {
      deps.logger.info('posters.render', fields);
    }
    return summary;
  };

  const pending = await loadPending(deps.db, ids);
  summary.skipped = ids.length - pending.length;

  if (!deps.renderer || !deps.storage) {
    // Checked before anything else so every attempt reports it, not only the first.
    summary.notConfigured = true;
    summary.failure = 'render_failed';
    summary.failed = await markFailed(
      deps.db,
      pending.map((r) => r.id),
      'render_failed',
    );
    return log();
  }
  if (pending.length === 0) return log();
  const configured = { ...deps, renderer: deps.renderer, storage: deps.storage };

  const groups = new Map<string, PendingRow[]>();
  for (const row of pending) {
    const key = groupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const rows of groups.values()) {
    const outcome = await renderGroup(configured, rows, attempt);
    summary.ready += outcome.ready;
    summary.failed += outcome.failed;
    summary.retrying += outcome.retrying;
    summary.replaced += outcome.replaced;
    summary.filesDeleted += outcome.filesDeleted;
    summary.renderCalls += outcome.renderCalls;
    summary.failure = outcome.failure ?? summary.failure;
  }
  summary.retry = summary.retrying > 0;
  return log();
}
