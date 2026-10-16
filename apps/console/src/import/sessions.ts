import {
  LOCALES,
  PROGRAMS,
  SECTIONS,
  SessionCreate,
  can,
  type AdminSession,
  type City,
  type Venue,
} from '@qc/contracts';
import type { CsvTable } from '../lib/csv';
import {
  columnForPath,
  normalizeName,
  parseBoolean,
  parseNumber,
  readTable,
  type ColumnSpec,
  type ReadRow,
} from './table';
import {
  buildReport,
  issue,
  type DryRunReport,
  type DryRunRow,
  type ImportActor,
  type ImportIssue,
} from './types';

export type SessionBody = SessionCreate;

export const SESSION_COLUMNS: readonly ColumnSpec[] = [
  { name: 'venue', aliases: ['venue_slug', 'venue_name', 'venue_id'], required: true },
  { name: 'city', aliases: ['city_slug', 'city_name'] },
  { name: 'title_en', aliases: ['title'], required: true },
  { name: 'title_ur' },
  { name: 'description_en', aliases: ['description'] },
  { name: 'description_ur' },
  { name: 'kind' },
  { name: 'program', required: true },
  { name: 'section', required: true },
  { name: 'language', required: true },
  { name: 'start_time', aliases: ['time', 'local_start_time'], required: true },
  { name: 'duration_minutes', aliases: ['duration'], required: true },
  { name: 'days', aliases: ['days_of_week'] },
  { name: 'starts_on', aliases: ['start_date'] },
  { name: 'ends_on', aliases: ['end_date'] },
  { name: 'date', aliases: ['on'] },
  { name: 'capacity' },
  { name: 'registration', aliases: ['registration_enabled'] },
  { name: 'status' },
];

const PATH_COLUMNS: Record<string, string> = {
  venueId: 'venue',
  'title.en': 'title_en',
  'title.ur': 'title_ur',
  'description.en': 'description_en',
  'description.ur': 'description_ur',
  kind: 'kind',
  program: 'program',
  section: 'section',
  language: 'language',
  localStartTime: 'start_time',
  durationMinutes: 'duration_minutes',
  daysOfWeek: 'days',
  startsOn: 'starts_on',
  endsOn: 'ends_on',
  date: 'date',
  capacity: 'capacity',
  registrationEnabled: 'registration',
  status: 'status',
};

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

/** `Mon|Wed`, `1;3` and `mon wed` all mean Monday and Wednesday. Sunday is 0. */
export function parseDays(text: string): number[] | 'invalid' {
  const tokens = text
    .toLowerCase()
    .split(/[|;,/\s]+/)
    .filter(Boolean);
  if (tokens.length === 0) return 'invalid';
  const days = new Set<number>();
  for (const token of tokens) {
    const n = /^[0-6]$/.test(token) ? Number(token) : DAY_NAMES[token];
    if (n === undefined) return 'invalid';
    days.add(n);
  }
  return [...days].sort((a, b) => a - b);
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (text: string): boolean => {
  if (!DATE.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(text);
};

export interface SessionContext extends ImportActor {
  cities: readonly City[];
  /** Venues in the person's scope. */
  venues: readonly Venue[];
  /** Sessions already at those venues. */
  sessions: readonly AdminSession[];
}

const sameText = (a: string, b: string): boolean => normalizeName(a) === normalizeName(b);

export function validateSessions(table: CsvTable, ctx: SessionContext): DryRunReport<SessionBody> {
  const read = readTable(table, SESSION_COLUMNS);
  const rows: DryRunRow<SessionBody>[] = [];
  const firstSeen = new Map<string, number>();

  for (const row of read.rows) {
    const issues: ImportIssue[] = [];
    const bad = read.malformed.get(row.line);
    if (bad) issues.push(bad);
    const body = bad ? null : buildSession(row, ctx, issues);
    const label = row.get('title_en') || `#${row.line}`;

    let status: DryRunRow<SessionBody>['status'] = issues.some((i) => i.severity === 'error')
      ? 'invalid'
      : 'valid';
    if (status === 'valid' && body) {
      const when = body.kind === 'one_off' ? body.date : body.daysOfWeek.join(',');
      const key = `${body.venueId}|${normalizeName(body.title.en)}|${body.kind}|${when}|${body.localStartTime}`;
      const earlier = firstSeen.get(key);
      if (earlier !== undefined) {
        issues.push(issue(row.line, 'title_en', 'duplicate_in_file', { firstLine: earlier }));
        status = 'invalid';
      } else {
        firstSeen.set(key, row.line);
        const exists = ctx.sessions.some(
          (s) =>
            s.venueId === body.venueId &&
            s.status !== 'archived' &&
            s.kind === body.kind &&
            normalizeName(s.title.en) === normalizeName(body.title.en) &&
            s.localStartTime === body.localStartTime &&
            (body.kind === 'one_off'
              ? s.startsOn === body.date
              : s.daysOfWeek.join(',') === body.daysOfWeek.join(',')),
        );
        if (exists) {
          issues.push(issue(row.line, 'title_en', 'already_exists', undefined, 'warning'));
          status = 'duplicate';
        }
      }
    }
    rows.push({
      line: row.line,
      status,
      issues,
      label,
      ...(status === 'valid' && body ? { body } : {}),
    });
  }
  return buildReport('sessions', read.fileIssues, rows);
}

function buildSession(
  row: ReadRow,
  ctx: SessionContext,
  issues: ImportIssue[],
): SessionBody | null {
  const line = row.line;
  const need = (column: string): string => {
    const v = row.get(column);
    if (!v) issues.push(issue(line, column, 'required', { column }));
    return v;
  };
  const oneOf = <T extends string>(
    column: string,
    allowed: readonly T[],
    fallback?: T,
  ): T | null => {
    const v = row.get(column).toLowerCase();
    if (!v) {
      if (fallback) return fallback;
      issues.push(issue(line, column, 'required', { column }));
      return null;
    }
    const hit = allowed.find((a) => a === v);
    if (!hit) issues.push(issue(line, column, 'invalid_value', { column }));
    return hit ?? null;
  };

  const venueText = need('venue');
  need('title_en');

  let venue: Venue | undefined;
  if (venueText) {
    const cityText = row.get('city');
    const city = cityText
      ? ctx.cities.find(
          (c) =>
            sameText(c.slug, cityText) ||
            sameText(c.name.en, cityText) ||
            (c.name.ur !== null && sameText(c.name.ur, cityText)),
        )
      : undefined;
    if (cityText && !city) issues.push(issue(line, 'city', 'unknown_city', { column: 'city' }));
    const found = ctx.venues.filter(
      (v) =>
        (!city || v.cityId === city.id) &&
        (v.id === venueText ||
          sameText(v.slug, venueText) ||
          sameText(v.name.en, venueText) ||
          (v.name.ur !== null && sameText(v.name.ur, venueText))),
    );
    if (found.length === 0) issues.push(issue(line, 'venue', 'unknown_venue', { column: 'venue' }));
    else if (found.length > 1)
      issues.push(issue(line, 'venue', 'ambiguous_venue', { column: 'venue' }));
    else venue = found[0];
  }
  if (venue && !can(ctx.principal, 'session.create', { cityId: venue.cityId, venueId: venue.id }))
    issues.push(issue(line, 'venue', 'out_of_scope', { column: 'venue' }));

  const kind = oneOf('kind', ['recurring', 'one_off'] as const, 'recurring');
  const program = oneOf('program', PROGRAMS);
  const section = oneOf('section', SECTIONS);
  const language = oneOf('language', LOCALES);
  const status = oneOf('status', ['draft', 'published'] as const, 'published');

  const time = row.get('start_time');
  if (!time) issues.push(issue(line, 'start_time', 'required', { column: 'start_time' }));
  else if (!TIME.test(time))
    issues.push(issue(line, 'start_time', 'invalid_time', { column: 'start_time' }));
  const localStartTime = TIME.test(time) ? time.padStart(5, '0') : '';

  const duration = parseNumber(row.get('duration_minutes'));
  if (duration === null)
    issues.push(issue(line, 'duration_minutes', 'required', { column: 'duration_minutes' }));
  else if (duration === 'invalid' || !Number.isInteger(duration))
    issues.push(issue(line, 'duration_minutes', 'invalid_number', { column: 'duration_minutes' }));

  const capacityValue = parseNumber(row.get('capacity'));
  if (
    capacityValue === 'invalid' ||
    (typeof capacityValue === 'number' && !Number.isInteger(capacityValue))
  )
    issues.push(issue(line, 'capacity', 'invalid_number', { column: 'capacity' }));

  const registration = parseBoolean(row.get('registration'));
  if (registration === 'invalid')
    issues.push(issue(line, 'registration', 'invalid_boolean', { column: 'registration' }));

  const dateField = (column: string, required: boolean): string | null => {
    const v = row.get(column);
    if (!v) {
      if (required) issues.push(issue(line, column, 'required', { column }));
      return null;
    }
    if (!isRealDate(v)) {
      issues.push(issue(line, column, 'invalid_date', { column }));
      return null;
    }
    return v;
  };

  let days: number[] = [];
  let startsOn: string | null = null;
  let endsOn: string | null = null;
  let date: string | null = null;
  if (kind === 'one_off') {
    date = dateField('date', true);
  } else if (kind === 'recurring') {
    const parsedDays = parseDays(row.get('days'));
    if (!row.get('days')) issues.push(issue(line, 'days', 'required', { column: 'days' }));
    else if (parsedDays === 'invalid')
      issues.push(issue(line, 'days', 'invalid_days', { column: 'days' }));
    else days = parsedDays;
    startsOn = dateField('starts_on', true);
    endsOn = dateField('ends_on', false);
  }

  if (
    issues.some((i) => i.severity === 'error') ||
    !venue ||
    !kind ||
    !program ||
    !section ||
    !language ||
    !status ||
    typeof duration !== 'number'
  )
    return null;

  const common = {
    venueId: venue.id,
    program,
    title: { en: row.get('title_en'), ur: row.get('title_ur') || null },
    description: row.get('description_en')
      ? { en: row.get('description_en'), ur: row.get('description_ur') || null }
      : null,
    section,
    language,
    localStartTime,
    durationMinutes: duration,
    registrationEnabled: registration ?? true,
    capacity: typeof capacityValue === 'number' ? capacityValue : null,
    status,
  };
  const parsed = SessionCreate.safeParse(
    kind === 'one_off'
      ? { ...common, kind, date }
      : { ...common, kind, daysOfWeek: days, startsOn, endsOn },
  );
  if (!parsed.success) {
    for (const zodIssue of parsed.error.issues) {
      const column = columnForPath(PATH_COLUMNS, zodIssue.path);
      issues.push(issue(line, column, 'invalid_value', { column: column ?? 'row' }));
    }
    return null;
  }
  return parsed.data;
}
