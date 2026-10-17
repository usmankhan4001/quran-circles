import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { CONTRACT_VERSION } from './openapi';
import {
  AdminRegistrationsExportQuery,
  CircleDecisionBody,
  CircleUpdate,
  CoordinatorImportBody,
  IMPORT_MAX_ROWS,
  IMPORT_SERVER_ISSUE_CODES,
  IMPORT_ROW_SCHEMAS,
  ImportResult,
  Invite,
  InviteBody,
  REGISTRATION_EXPORT_COLUMNS,
  ReminderLeadMinutes,
  SessionImportBody,
  Settings,
  SettingsUpdate,
  VenueImportBody,
  checkImportRows,
  type Attendance,
  type AuditEntry,
  type StaffRoleAssignment,
} from './schemas/admin';
import { UpdatePreview } from './schemas/updates';
import { importExamples } from './fixtures';
import { ERROR_CODES } from './errors';

const UUID = '00000000-0000-4000-8000-000000000001';
const UUID_2 = '00000000-0000-4000-8000-000000000002';

describe('contract version', () => {
  it('is the third release candidate', () => {
    expect(CONTRACT_VERSION).toBe('1.0.0-rc.3');
  });
});

describe('invite with a handover', () => {
  const base = { phone: '+923000000099' };

  it('takes an optional replacesAssignmentId for city and venue coordinators', () => {
    const venue = InviteBody.parse({
      ...base,
      role: 'venue_coordinator',
      venueId: UUID,
      replacesAssignmentId: UUID_2,
    });
    expect(venue).toMatchObject({ replacesAssignmentId: UUID_2 });
    const city = InviteBody.parse({
      ...base,
      role: 'city_coordinator',
      cityId: UUID,
      replacesAssignmentId: UUID_2,
    });
    expect(city).toMatchObject({ replacesAssignmentId: UUID_2 });
  });

  it('still accepts the old shape without it', () => {
    expect(
      InviteBody.safeParse({ ...base, role: 'venue_coordinator', venueId: UUID }).success,
    ).toBe(true);
    expect(InviteBody.safeParse({ ...base, role: 'national_admin' }).success).toBe(true);
  });

  it('rejects a replacesAssignmentId that is not an id', () => {
    expect(
      InviteBody.safeParse({
        ...base,
        role: 'venue_coordinator',
        venueId: UUID,
        replacesAssignmentId: 'abc',
      }).success,
    ).toBe(false);
  });

  it('drops it for a national admin, who cannot be handed over', () => {
    const parsed = InviteBody.parse({
      ...base,
      role: 'national_admin',
      replacesAssignmentId: UUID,
    });
    expect(parsed).not.toHaveProperty('replacesAssignmentId');
  });
});

describe('invite response with the handover (rc.3)', () => {
  const invite = {
    id: UUID,
    phone: '+923000000099',
    displayName: null,
    role: 'venue_coordinator',
    scopeType: 'venue',
    cityId: null,
    venueId: UUID,
    status: 'pending',
    createdAt: '2026-10-17T05:00:00Z',
    expiresAt: '2026-10-24T05:00:00Z',
  };

  it('carries the replaced assignment, or null for a plain invite', () => {
    expect(Invite.parse({ ...invite, replacesAssignmentId: UUID_2 })).toMatchObject({
      replacesAssignmentId: UUID_2,
    });
    expect(Invite.parse({ ...invite, replacesAssignmentId: null }).replacesAssignmentId).toBeNull();
  });

  it('still reads an rc.2 invite without the field', () => {
    const parsed = Invite.parse(invite);
    expect(parsed.replacesAssignmentId).toBeUndefined();
  });

  it('rejects a replaced assignment that is not an id', () => {
    expect(Invite.safeParse({ ...invite, replacesAssignmentId: 'abc' }).success).toBe(false);
  });

  it('lets a resend copy it straight into a new invite body', () => {
    const sent = Invite.parse({ ...invite, replacesAssignmentId: UUID_2 });
    const body = InviteBody.parse({
      role: sent.role,
      phone: sent.phone,
      venueId: sent.venueId,
      replacesAssignmentId: sent.replacesAssignmentId,
    });
    expect(body).toMatchObject({ replacesAssignmentId: UUID_2 });
  });
});

describe('circles: archive, and no decision note', () => {
  it('lets an update publish or archive, and nothing else', () => {
    expect(CircleUpdate.parse({ status: 'archived' })).toEqual({ status: 'archived' });
    expect(CircleUpdate.parse({ status: 'published' })).toEqual({ status: 'published' });
    for (const status of ['draft', 'pending_approval', 'rejected', 'gone']) {
      expect(CircleUpdate.safeParse({ status }).success, status).toBe(false);
    }
    expect(CircleUpdate.safeParse({}).success).toBe(true);
  });

  it('has no note on the decision, and an old client that sends one is not refused', () => {
    expect(Object.keys(CircleDecisionBody.shape)).toEqual(['decision']);
    expect(CircleDecisionBody.parse({ decision: 'reject', note: 'too personal to keep' })).toEqual({
      decision: 'reject',
    });
    expect(CircleDecisionBody.safeParse({ decision: 'maybe' }).success).toBe(false);
  });
});

describe('settings: reminder lead time and the WhatsApp cap', () => {
  const base = {
    hijriOffsetDays: 0,
    seasonMode: 'circles',
    whatsappDailyCapPerPerson: 1,
    circleRequestAlertThreshold: 10,
  } as const;

  it('carries a lead time for each program, 5 to 1440 whole minutes', () => {
    const ok = (dora: number, circles: number) =>
      ReminderLeadMinutes.safeParse({ dora, circles }).success;
    expect(ok(60, 60)).toBe(true);
    expect(ok(5, 1440)).toBe(true);
    expect(ok(4, 60)).toBe(false);
    expect(ok(60, 1441)).toBe(false);
    expect(ok(60.5, 60)).toBe(false);
    expect(ReminderLeadMinutes.safeParse({ dora: 60 }).success).toBe(false);
  });

  it('reads a response without the field as 60 for each program', () => {
    expect(Settings.parse(base).reminderLeadMinutes).toEqual({ dora: 60, circles: 60 });
    expect(
      Settings.parse({ ...base, reminderLeadMinutes: { dora: 30, circles: 90 } })
        .reminderLeadMinutes,
    ).toEqual({ dora: 30, circles: 90 });
    expect(
      Settings.safeParse({ ...base, reminderLeadMinutes: { dora: 1, circles: 90 } }).success,
    ).toBe(false);
  });

  it('keeps the WhatsApp cap between 0 and 5', () => {
    for (const cap of [0, 5]) {
      expect(Settings.safeParse({ ...base, whatsappDailyCapPerPerson: cap }).success).toBe(true);
    }
    for (const cap of [-1, 6, 1.5]) {
      expect(Settings.safeParse({ ...base, whatsappDailyCapPerPerson: cap }).success).toBe(false);
    }
  });

  it('updates one program on its own, and never resets what it was not sent', () => {
    expect(SettingsUpdate.parse({})).toEqual({});
    expect(SettingsUpdate.parse({ reminderLeadMinutes: { dora: 45 } })).toEqual({
      reminderLeadMinutes: { dora: 45 },
    });
    expect(SettingsUpdate.parse({ whatsappDailyCapPerPerson: 2 })).toEqual({
      whatsappDailyCapPerPerson: 2,
    });
    expect(SettingsUpdate.safeParse({ reminderLeadMinutes: { circles: 2000 } }).success).toBe(
      false,
    );
  });
});

describe('bulk import', () => {
  it('allows 1 to 2000 rows and needs dryRun', () => {
    const row = importExamples.venues[0]!;
    expect(IMPORT_MAX_ROWS).toBe(2000);
    expect(VenueImportBody.safeParse({ dryRun: true, rows: [row] }).success).toBe(true);
    expect(VenueImportBody.safeParse({ rows: [row] }).success).toBe(false);
    expect(VenueImportBody.safeParse({ dryRun: true, rows: [] }).success).toBe(false);
    const many = (n: number) => Array.from({ length: n }, () => row);
    expect(VenueImportBody.safeParse({ dryRun: false, rows: many(2000) }).success).toBe(true);
    expect(VenueImportBody.safeParse({ dryRun: false, rows: many(2001) }).success).toBe(false);
  });

  it('lets a malformed row through the envelope, to be reported per row', () => {
    for (const body of [VenueImportBody, CoordinatorImportBody, SessionImportBody]) {
      expect(body.safeParse({ dryRun: true, rows: [{ nonsense: true }] }).success).toBe(true);
      expect(body.safeParse({ dryRun: true, rows: ['text'] }).success).toBe(false);
      expect(body.safeParse({ dryRun: true, rows: [null] }).success).toBe(false);
      expect(body.safeParse({ dryRun: true, rows: [[]] }).success).toBe(false);
    }
  });

  it('checks each row against the schema of the single create call', () => {
    expect(IMPORT_ROW_SCHEMAS.coordinators).toBe(InviteBody);
    const rows = [
      importExamples.venues[0],
      { ...importExamples.venues[0]!, lat: 200 },
      { cityId: 'x' },
    ];
    const checks = checkImportRows('venues', rows);
    expect(checks.map((c) => c.ok)).toEqual([true, false, false]);
    expect(checks.map((c) => c.index)).toEqual([0, 1, 2]);
    const bad = checks[1]!;
    expect(bad.ok ? [] : bad.issues.map((i) => i.path)).toEqual(['lat']);
    const worse = checks[2]!;
    expect(worse.ok ? [] : worse.issues.map((i) => i.path)).toContain('cityId');
  });

  it('puts defaults in the parsed value and never echoes cell values in issues', () => {
    const [ok] = checkImportRows('venues', [importExamples.venues[0]]);
    expect(ok).toMatchObject({ ok: true, value: { contactPhone: null } });
    const [bad] = checkImportRows('coordinators', [{ role: 'venue_coordinator', phone: 'SECRET' }]);
    expect(JSON.stringify(bad)).not.toContain('SECRET');
  });

  it('checks coordinators and sessions by kind', () => {
    expect(checkImportRows('coordinators', importExamples.coordinators).every((c) => c.ok)).toBe(
      true,
    );
    expect(checkImportRows('sessions', importExamples.sessions).every((c) => c.ok)).toBe(true);
    const [wrong] = checkImportRows('sessions', [importExamples.venues[0]]);
    expect(wrong!.ok).toBe(false);
  });

  it('lists every server-only row issue code, including invalid_range (rc.3)', () => {
    expect([...IMPORT_SERVER_ISSUE_CODES]).toEqual([
      'invalid_reference',
      'area_not_in_city',
      'forbidden',
      'invalid_range',
    ]);
    // A race between the check and the write is a whole-request conflict, not a row code.
    expect(IMPORT_SERVER_ISSUE_CODES).not.toContain('changed_during_import');
    // Server codes never clash with an error code's meaning by accident: only forbidden is shared.
    expect(IMPORT_SERVER_ISSUE_CODES.filter((c) => c in ERROR_CODES)).toEqual(['forbidden']);
  });

  it('describes the result per row index with counts', () => {
    const result = {
      dryRun: true,
      applied: false,
      counts: { created: 1, duplicate: 1, invalid: 1 },
      rows: [
        { index: 0, status: 'created', issues: [] },
        { index: 1, status: 'duplicate', issues: [] },
        { index: 2, status: 'invalid', issues: [{ path: 'cityId', code: 'invalid_reference' }] },
      ],
    };
    expect(ImportResult.parse(result)).toEqual(result);
    expect(
      ImportResult.safeParse({ ...result, rows: [{ index: 0, status: 'maybe', issues: [] }] })
        .success,
    ).toBe(false);
  });
});

describe('scoped registrations export', () => {
  it('takes optional city, venue and local dates', () => {
    expect(AdminRegistrationsExportQuery.parse({})).toEqual({});
    expect(
      AdminRegistrationsExportQuery.parse({
        cityId: UUID,
        venueId: UUID_2,
        from: '2027-02-08',
        to: '2027-03-09',
      }),
    ).toMatchObject({ from: '2027-02-08', to: '2027-03-09' });
    expect(AdminRegistrationsExportQuery.safeParse({ from: '08/02/2027' }).success).toBe(false);
    expect(AdminRegistrationsExportQuery.safeParse({ cityId: 'x' }).success).toBe(false);
  });

  it('has a fixed header row', () => {
    expect(REGISTRATION_EXPORT_COLUMNS[0]).toBe('session_id');
    expect(REGISTRATION_EXPORT_COLUMNS).toContain('phone');
    expect(new Set(REGISTRATION_EXPORT_COLUMNS).size).toBe(REGISTRATION_EXPORT_COLUMNS.length);
  });
});

describe('update preview', () => {
  it('is a count of people', () => {
    expect(UpdatePreview.parse({ recipients: 0 })).toEqual({ recipients: 0 });
    expect(UpdatePreview.safeParse({ recipients: -1 }).success).toBe(false);
    expect(UpdatePreview.safeParse({}).success).toBe(false);
  });
});

describe('exported types', () => {
  it('names the shapes the apps used to derive from the client', () => {
    // Compile-time only: these assignments fail to type-check if a type is not exported.
    const assignment: Pick<StaffRoleAssignment, 'role' | 'phone'> = {
      role: 'national_admin',
      phone: '+923000000099',
    };
    const entry: Pick<AuditEntry, 'action'> = { action: 'venue.create' };
    const attendance: Pick<Attendance, 'headcount'> = { headcount: null };
    expect([assignment.role, entry.action, attendance.headcount]).toEqual([
      'national_admin',
      'venue.create',
      null,
    ]);
  });
});

describe('last_national_admin', () => {
  it('is a 409 with an English and an Urdu message', () => {
    expect(ERROR_CODES.last_national_admin).toBe(409);
    expect((messages.en as Record<string, string>)['errors.last_national_admin']).toBeTruthy();
    expect((messages.ur as Record<string, string>)['errors.last_national_admin']).toBeTruthy();
  });
});
