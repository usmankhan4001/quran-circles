import { describe, expect, it } from 'vitest';
import type { Invite, StaffRoleAssignment } from '@qc/contracts';
import { cities, venues } from '@qc/contracts/fixtures';
import { parseCsv } from '../lib/csv';
import {
  areasByCity,
  cityCoordinator,
  nationalAdmin,
  rawalpindi,
  venueA,
  venueB,
  venueCoordinator,
} from '../test/people';
import { citiesMentioned, validateVenues } from './venues';
import { validateCoordinators } from './coordinators';
import { maskPhone } from '../lib/phone';
import { parseDays, validateSessions } from './sessions';
import { commitImport, mergeServerResult, rowsToSend, serverIssue } from './server';
import { templateCsv } from './templates';
import { IMPORT_KINDS } from './types';
import { reportToCsv } from './run';

const codes = (r: { rows: { issues: { code: string }[] }[] }, i = 0) =>
  r.rows[i]?.issues.map((x) => x.code) ?? [];

const VENUE_HEADER =
  'city,area,name_en,name_ur,address_en,address_ur,lat,lng,contact_phone,women_section';
const venueRow = (over: Partial<Record<string, string>> = {}) => {
  const v = {
    city: 'rawalpindi',
    area: 'saddar',
    name_en: 'Test Masjid One',
    name_ur: '',
    address_en: 'Road 1 (test)',
    address_ur: '',
    lat: '33.6',
    lng: '73.05',
    contact_phone: '0300 0000011',
    women_section: 'yes',
    ...over,
  };
  return Object.values(v)
    .map((c) => (c.includes(',') ? `"${c}"` : c))
    .join(',');
};
const venueCtx = (principal = nationalAdmin, existing = venues) => ({
  principal,
  cities,
  areasByCity,
  venues: existing,
});

describe('venue import dry run', () => {
  it('accepts a valid file and builds contract bodies', () => {
    const r = validateVenues(parseCsv(`${VENUE_HEADER}\n${venueRow()}\n`), venueCtx());
    expect(r.counts).toEqual({ total: 1, valid: 1, duplicate: 0, invalid: 0 });
    expect(r.canApply).toBe(true);
    expect(r.rows[0]?.body).toMatchObject({
      cityId: rawalpindi!.id,
      name: { en: 'Test Masjid One', ur: null },
      contactPhone: '+923000000011',
      facilities: { womenSection: true },
    });
  });

  it('reports every bad row with its line and column, and blocks the apply', () => {
    const text = [
      VENUE_HEADER,
      venueRow(),
      venueRow({ name_en: 'Two', city: 'atlantis' }),
      venueRow({ name_en: 'Three', area: 'nowhere' }),
      venueRow({ name_en: 'Four', lat: 'north' }),
      venueRow({ name_en: 'Five', contact_phone: '12345' }),
      venueRow({ name_en: '' }),
      venueRow({ name_en: 'Seven', women_section: 'maybe' }),
    ].join('\n');
    const r = validateVenues(parseCsv(text), venueCtx());
    expect(r.counts).toMatchObject({ total: 7, valid: 1, invalid: 6 });
    expect(r.canApply).toBe(false);
    expect(codes(r, 1)).toContain('unknown_city');
    expect(codes(r, 2)).toContain('unknown_area');
    expect(codes(r, 3)).toContain('invalid_number');
    expect(codes(r, 4)).toContain('invalid_phone');
    expect(codes(r, 5)).toContain('required');
    expect(codes(r, 6)).toContain('invalid_boolean');
    expect(r.rows.map((x) => x.line)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(r.rows[1]?.issues[0]).toMatchObject({ line: 3, column: 'city', severity: 'error' });
  });

  it('rejects a bad E.164 contact number but allows an international one', () => {
    const bad = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ contact_phone: '+9230012' })}\n`),
      venueCtx(),
    );
    expect(codes(bad)).toContain('invalid_phone');
    const ok = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ contact_phone: '+44 20 7946 0958' })}\n`),
      venueCtx(),
    );
    expect(ok.rows[0]?.body?.contactPhone).toBe('+442079460958');
  });

  it('treats the same venue twice in a file as an error', () => {
    const r = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow()}\n${venueRow({ name_en: 'test masjid one' })}\n`),
      venueCtx(),
    );
    expect(r.rows.map((x) => x.status)).toEqual(['valid', 'invalid']);
    expect(r.rows[1]?.issues[0]).toMatchObject({
      code: 'duplicate_in_file',
      params: { firstLine: 2 },
    });
  });

  it('skips a venue that already exists instead of failing the file', () => {
    const r = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ name_en: venueA!.name.en })}\n${venueRow()}\n`),
      venueCtx(),
    );
    expect(r.rows.map((x) => x.status)).toEqual(['duplicate', 'valid']);
    expect(r.canApply).toBe(true);
    expect(r.counts.duplicate).toBe(1);
  });

  it('refuses a city outside the person scope', () => {
    const r = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ city: 'islamabad', area: 'f-7' })}\n`),
      venueCtx(cityCoordinator),
    );
    expect(codes(r)).toContain('out_of_scope');
    expect(r.canApply).toBe(false);
  });

  it('reports malformed files as file problems', () => {
    expect(validateVenues(parseCsv(''), venueCtx()).fileIssues[0]?.code).toBe('csv_empty_file');
    const missing = validateVenues(parseCsv('city,area\nrawalpindi,saddar\n'), venueCtx());
    expect(missing.fileIssues.map((i) => i.code)).toContain('missing_column');
    expect(missing.canApply).toBe(false);
    const quote = validateVenues(parseCsv(`${VENUE_HEADER}\n"open,quote\n`), venueCtx());
    expect(quote.fileIssues.map((i) => i.code)).toContain('csv_unterminated_quote');
    expect(quote.canApply).toBe(false);
  });

  it('flags rows with the wrong number of cells', () => {
    const r = validateVenues(parseCsv(`${VENUE_HEADER}\nrawalpindi,saddar,Short\n`), venueCtx());
    expect(codes(r)).toContain('column_count');
    expect(r.canApply).toBe(false);
  });

  it('does not echo cell contents into messages', () => {
    const r = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ contact_phone: '0300SECRET99' })}\n`),
      venueCtx(),
    );
    expect(JSON.stringify(r.rows[0]?.issues)).not.toContain('SECRET');
  });

  it('finds which cities a file mentions', () => {
    const t = parseCsv(
      `${VENUE_HEADER}\n${venueRow()}\n${venueRow({ city: 'Islamabad', name_en: 'B', area: 'f-7' })}\n`,
    );
    expect(citiesMentioned(t, cities).map((c) => c.slug)).toEqual(['rawalpindi', 'islamabad']);
  });
});

const COORD_HEADER = 'phone,name,role,city,venue';
const uuid = (n: number) => `00000000-0000-4000-8000-0c00000000${String(n).padStart(2, '0')}`;
const coordCtx = (over: Partial<Parameters<typeof validateCoordinators>[1]> = {}) => ({
  principal: nationalAdmin,
  cities,
  venues,
  invites: [] as Invite[],
  assignments: [] as StaffRoleAssignment[],
  ...over,
});
const assignment = (over: Partial<StaffRoleAssignment>): StaffRoleAssignment => ({
  id: uuid(1),
  userId: uuid(2),
  userName: 'Existing Person',
  phone: '+923000000021',
  role: 'venue_coordinator',
  scopeType: 'venue',
  cityId: venueA!.cityId,
  venueId: venueA!.id,
  scopeName: null,
  createdAt: '2027-02-01T00:00:00Z',
  revokedAt: null,
  ...over,
});

describe('coordinator import dry run', () => {
  it('accepts valid rows for each role', () => {
    const text = [
      COORD_HEADER,
      `0300 0000021,Test One,venue_coordinator,,${venueA!.name.en}`,
      '0300 0000022,Test Two,city,rawalpindi,',
      '0300 0000023,Test Three,national_admin,,',
    ].join('\n');
    const r = validateCoordinators(parseCsv(text), coordCtx());
    expect(r.counts).toEqual({ total: 3, valid: 3, duplicate: 0, invalid: 0 });
    expect(r.rows.map((x) => x.body?.role)).toEqual([
      'venue_coordinator',
      'city_coordinator',
      'national_admin',
    ]);
    expect(r.rows[0]?.body).toMatchObject({ phone: '+923000000021', venueId: venueA!.id });
    expect(r.canApply).toBe(true);
  });

  it('rejects bad phone numbers and unknown roles', () => {
    const text = [
      COORD_HEADER,
      `12345,A,venue_coordinator,,${venueA!.name.en}`,
      `+9230000000,B,venue_coordinator,,${venueA!.name.en}`,
      `0300 0000024,C,wizard,,${venueA!.name.en}`,
      `051 2345678,D,venue_coordinator,,${venueA!.name.en}`,
      `,E,venue_coordinator,,${venueA!.name.en}`,
    ].join('\n');
    const r = validateCoordinators(parseCsv(text), coordCtx());
    expect(codes(r, 0)).toEqual(['invalid_phone']);
    expect(codes(r, 1)).toEqual(['invalid_phone']);
    expect(codes(r, 2)).toEqual(['unknown_role']);
    expect(codes(r, 3)).toEqual(['phone_not_mobile']);
    expect(codes(r, 4)).toEqual(['required']);
    expect(r.counts.invalid).toBe(5);
    expect(r.canApply).toBe(false);
  });

  it('makes a repeated phone, role and place an error, but the same phone elsewhere a warning', () => {
    const text = [
      COORD_HEADER,
      `0300 0000025,Aa,venue_coordinator,,${venueA!.name.en}`,
      `+92 300 0000025,Aa again,venue_coordinator,,${venueA!.name.en}`,
      `0300 0000025,Aa elsewhere,venue_coordinator,,${venueB!.name.en}`,
    ].join('\n');
    const r = validateCoordinators(parseCsv(text), coordCtx());
    expect(r.rows.map((x) => x.status)).toEqual(['valid', 'invalid', 'valid']);
    expect(codes(r, 1)).toEqual(['duplicate_in_file']);
    expect(r.rows[2]?.issues).toEqual([
      expect.objectContaining({ code: 'phone_repeated', severity: 'warning' }),
    ]);
    expect(r.canApply).toBe(false);
  });

  it('skips people who already hold the role or already have an invite', () => {
    const invite: Invite = {
      id: uuid(3),
      phone: '+923000000027',
      displayName: null,
      role: 'venue_coordinator',
      scopeType: 'venue',
      cityId: venueA!.cityId,
      venueId: venueA!.id,
      status: 'pending',
      createdAt: '2027-02-01T00:00:00Z',
      expiresAt: '2027-02-08T00:00:00Z',
    };
    const text = [
      COORD_HEADER,
      `0300 0000021,Has role,venue_coordinator,,${venueA!.name.en}`,
      `0300 0000027,Has invite,venue_coordinator,,${venueA!.name.en}`,
      `0300 0000028,New,venue_coordinator,,${venueA!.name.en}`,
    ].join('\n');
    const r = validateCoordinators(
      parseCsv(text),
      coordCtx({ assignments: [assignment({})], invites: [invite] }),
    );
    expect(r.rows.map((x) => x.status)).toEqual(['duplicate', 'duplicate', 'valid']);
    expect(r.canApply).toBe(true);
  });

  it('ignores revoked assignments and expired invites', () => {
    const text = `${COORD_HEADER}\n0300 0000021,Back again,venue_coordinator,,${venueA!.name.en}\n`;
    const r = validateCoordinators(
      parseCsv(text),
      coordCtx({ assignments: [assignment({ revokedAt: '2027-01-01T00:00:00Z' })] }),
    );
    expect(r.rows[0]?.status).toBe('valid');
  });

  it('refuses roles the person may not hand out', () => {
    const text = [
      COORD_HEADER,
      '0300 0000031,A,national_admin,,',
      '0300 0000032,B,city_coordinator,islamabad,',
      `0300 0000033,C,venue_coordinator,,${venueA!.name.en}`,
    ].join('\n');
    const r = validateCoordinators(parseCsv(text), coordCtx({ principal: cityCoordinator }));
    expect(codes(r, 0)).toEqual(['out_of_scope']);
    expect(codes(r, 1)).toEqual(['out_of_scope']);
    expect(r.rows[2]?.status).toBe('invalid');
    const v = validateCoordinators(parseCsv(text), coordCtx({ principal: venueCoordinator }));
    expect(v.counts.valid).toBe(0);
  });

  it('needs a place for city and venue roles, and finds the venue by name', () => {
    const text = [
      COORD_HEADER,
      '0300 0000041,A,city_coordinator,,',
      '0300 0000042,B,venue_coordinator,,',
      '0300 0000043,C,venue_coordinator,,No Such Venue',
    ].join('\n');
    const r = validateCoordinators(parseCsv(text), coordCtx());
    expect(codes(r, 0)).toEqual(['required']);
    expect(codes(r, 1)).toEqual(['required']);
    expect(codes(r, 2)).toEqual(['unknown_venue']);
  });

  it('shows a masked number in the report label, never the full one', () => {
    const r = validateCoordinators(
      parseCsv(`${COORD_HEADER}\n0300 0000021,,venue_coordinator,,${venueA!.name.en}\n`),
      coordCtx(),
    );
    expect(r.rows[0]?.label).not.toContain('0000021');
    expect(maskPhone('+923000000021')).toBe('+92••••021');
  });
});

const SESSION_HEADER =
  'venue,title_en,program,section,language,start_time,duration_minutes,days,starts_on,capacity';
const sessionRow = (over: Partial<Record<string, string>> = {}) =>
  Object.values({
    venue: venueA!.name.en,
    title_en: 'Test Circle',
    program: 'circles',
    section: 'women',
    language: 'ur',
    start_time: '20:00',
    duration_minutes: '60',
    days: 'Mon|Wed',
    starts_on: '2027-03-01',
    capacity: '30',
    ...over,
  }).join(',');
const sessCtx = (over: Partial<Parameters<typeof validateSessions>[1]> = {}) => ({
  principal: nationalAdmin,
  cities,
  venues,
  sessions: [],
  ...over,
});

describe('session import dry run', () => {
  it('accepts a valid recurring session', () => {
    const r = validateSessions(parseCsv(`${SESSION_HEADER}\n${sessionRow()}\n`), sessCtx());
    expect(r.canApply).toBe(true);
    expect(r.rows[0]?.body).toMatchObject({
      kind: 'recurring',
      venueId: venueA!.id,
      daysOfWeek: [1, 3],
      localStartTime: '20:00',
      capacity: 30,
    });
  });

  it('reports bad times, days, dates and enum values', () => {
    const text = [
      SESSION_HEADER,
      sessionRow({ start_time: '25:00' }),
      sessionRow({ days: 'Funday' }),
      sessionRow({ starts_on: '2027-02-30' }),
      sessionRow({ section: 'robots' }),
      sessionRow({ venue: 'Nowhere' }),
      sessionRow({ duration_minutes: 'long' }),
    ].join('\n');
    const r = validateSessions(parseCsv(text), sessCtx());
    expect(codes(r, 0)).toContain('invalid_time');
    expect(codes(r, 1)).toContain('invalid_days');
    expect(codes(r, 2)).toContain('invalid_date');
    expect(codes(r, 3)).toContain('invalid_value');
    expect(codes(r, 4)).toContain('unknown_venue');
    expect(codes(r, 5)).toContain('invalid_number');
    expect(r.counts.invalid).toBe(6);
  });

  it('refuses a venue the person does not look after', () => {
    const r = validateSessions(
      parseCsv(`${SESSION_HEADER}\n${sessionRow({ venue: venueB!.name.en })}\n`),
      sessCtx({ principal: venueCoordinator }),
    );
    expect(codes(r)).toContain('out_of_scope');
  });

  it('parses day lists', () => {
    expect(parseDays('Mon|Wed')).toEqual([1, 3]);
    expect(parseDays('1;3')).toEqual([1, 3]);
    expect(parseDays('sat sun')).toEqual([0, 6]);
    expect(parseDays('')).toBe('invalid');
    expect(parseDays('Mon|Blursday')).toBe('invalid');
  });
});

describe('templates, report and apply', () => {
  it('every template parses without file errors and has the required columns', () => {
    for (const kind of IMPORT_KINDS) {
      const t = parseCsv(templateCsv(kind));
      expect(t.errors).toEqual([]);
      expect(t.records.length).toBeGreaterThan(0);
    }
  });

  it('exports a report with line numbers and no cell contents', () => {
    const r = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ city: 'atlantis' })}\n`),
      venueCtx(),
    );
    const csv = reportToCsv(r, (key) => key, {
      line: 'line',
      status: 'status',
      severity: 'severity',
      column: 'column',
      message: 'message',
    });
    expect(csv.split('\r\n')[1]).toMatch(/^2,invalid,error,city,/);
    expect(csv).not.toContain('atlantis');
  });

  it('refuses to apply a report that still has errors, or that the server has not checked', async () => {
    const bad = validateVenues(
      parseCsv(`${VENUE_HEADER}\n${venueRow({ city: 'atlantis' })}\n`),
      venueCtx(),
    );
    await expect(commitImport(bad, {} as never)).rejects.toThrow();
    const unchecked = validateVenues(parseCsv(`${VENUE_HEADER}\n${venueRow()}\n`), venueCtx());
    expect(unchecked.canApply).toBe(true);
    expect(unchecked.serverChecked).toBe(false);
    await expect(commitImport(unchecked, {} as never)).rejects.toThrow();
  });
});

describe('the server dry run and the import', () => {
  const file = () =>
    validateVenues(
      parseCsv(
        `${VENUE_HEADER}\n${venueRow({ name_en: venueA!.name.en })}\n${venueRow({ name_en: 'N1' })}\n${venueRow({ name_en: 'N2', city: 'atlantis' })}\n${venueRow({ name_en: 'N3' })}\n`,
      ),
      venueCtx(),
    );

  it('sends every row the console could build, including the ones it thinks are already there', () => {
    expect(rowsToSend(file()).map((r) => r.line)).toEqual([2, 3, 5]);
  });

  it("takes the server's status for each row it was asked about", () => {
    const report = file();
    const sent = rowsToSend(report);
    const merged = mergeServerResult(report, sent, {
      dryRun: true,
      applied: false,
      counts: { created: 1, duplicate: 0, invalid: 2 },
      rows: [
        { index: 0, status: 'created', issues: [] },
        { index: 1, status: 'invalid', issues: [{ path: 'cityId', code: 'forbidden' }] },
        { index: 2, status: 'invalid', issues: [{ path: 'name.en', code: 'too_small' }] },
      ],
    });
    expect(merged.serverChecked).toBe(true);
    expect(merged.rows.map((r) => r.status)).toEqual(['valid', 'invalid', 'invalid', 'invalid']);
    // The console's "already there" note gives way to the server's answer.
    expect(codes(merged, 0)).toEqual([]);
    expect(merged.rows[1]?.issues[0]).toMatchObject({
      line: 3,
      column: 'city',
      code: 'out_of_scope',
    });
    expect(merged.rows[1]?.body).toBeUndefined();
    // A row the console refused keeps its own problem.
    expect(codes(merged, 2)).toEqual(['unknown_city']);
    expect(merged.rows[3]?.issues[0]).toMatchObject({ column: 'name_en', code: 'invalid_value' });
    expect(merged.counts).toEqual({ total: 4, valid: 1, duplicate: 0, invalid: 3 });
    expect(merged.canApply).toBe(false);
  });

  it('turns server issue codes into report messages for the right column', () => {
    expect(serverIssue('venues', 4, { path: 'areaId', code: 'area_not_in_city' })).toMatchObject({
      line: 4,
      column: 'area',
      code: 'area_not_in_city',
    });
    expect(serverIssue('venues', 4, { path: 'areaId', code: 'invalid_reference' }).code).toBe(
      'unknown_area',
    );
    expect(
      serverIssue('coordinators', 2, { path: 'venueId', code: 'invalid_reference' }),
    ).toMatchObject({
      column: 'venue',
      code: 'unknown_venue',
    });
    expect(
      serverIssue('sessions', 2, { path: 'circleId', code: 'invalid_reference' }),
    ).toMatchObject({
      column: null,
      code: 'invalid_reference',
      params: { column: 'row' },
    });
  });

  it('imports with one call and reports created and skipped rows', async () => {
    const report = file();
    const clean = validateVenues(
      parseCsv(
        `${VENUE_HEADER}\n${venueRow({ name_en: venueA!.name.en })}\n${venueRow({ name_en: 'N1' })}\n`,
      ),
      venueCtx(),
    );
    const checked = mergeServerResult(clean, rowsToSend(clean), {
      dryRun: true,
      applied: false,
      counts: { created: 1, duplicate: 1, invalid: 0 },
      rows: [
        { index: 0, status: 'duplicate', issues: [] },
        { index: 1, status: 'created', issues: [] },
      ],
    });
    const bodies: unknown[] = [];
    const api = {
      adminImport: {
        venues: async ({ body }: { body: { dryRun: boolean; rows: unknown[] } }) => {
          bodies.push(body);
          return {
            dryRun: false,
            applied: true,
            counts: { created: 1, duplicate: 1, invalid: 0 },
            rows: [],
          };
        },
      },
    };
    expect(await commitImport(checked, api as never)).toEqual({
      applied: true,
      created: 1,
      skipped: 1,
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ dryRun: false });
    expect((bodies[0] as { rows: unknown[] }).rows).toHaveLength(2);
    expect(report.counts.total).toBe(4);
  });
});
