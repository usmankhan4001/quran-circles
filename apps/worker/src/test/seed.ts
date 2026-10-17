import { tables, type Db } from '../db';

let phoneCounter = 0;
let slugCounter = 0;

/** Synthetic numbers: +923000000001, +923000000002, ... */
export const nextPhone = () => `+92300${String(++phoneCounter).padStart(7, '0')}`;
const slug = (p: string) => `${p}-${++slugCounter}`;

const first = async <T>(rows: Promise<T[]>): Promise<T> => {
  const [row] = await rows;
  if (!row) throw new Error('insert returned no row');
  return row;
};

export interface World {
  city: { id: string };
  area: { id: string };
  venue: { id: string };
  program: { id: string; key: 'dora' | 'circles' };
  session: { id: string; circleId: string | null };
}

export async function seedWorld(
  db: Db,
  opts: { program?: 'dora' | 'circles'; circle?: boolean } = {},
): Promise<World> {
  const province = await first(
    db
      .insert(tables.provinces)
      .values({ code: slug('P'), nameEn: 'Test Province', nameUr: 'ٹیسٹ صوبہ' })
      .returning(),
  );
  const city = await first(
    db
      .insert(tables.cities)
      .values({
        provinceId: province.id,
        slug: slug('city'),
        nameEn: 'Test City',
        nameUr: 'ٹیسٹ شہر',
      })
      .returning(),
  );
  const area = await first(
    db
      .insert(tables.areas)
      .values({ cityId: city.id, slug: slug('area'), nameEn: 'Test Area', nameUr: 'ٹیسٹ علاقہ' })
      .returning(),
  );
  const venue = await first(
    db
      .insert(tables.venues)
      .values({
        cityId: city.id,
        areaId: area.id,
        slug: slug('venue'),
        nameEn: 'Test Masjid',
        nameUr: 'ٹیسٹ مسجد',
        addressEn: '1 Test Road',
        addressUr: '۱ ٹیسٹ روڈ',
      })
      .returning(),
  );
  const key = opts.program ?? 'circles';
  const program = await first(
    db
      .insert(tables.programs)
      .values({ key, nameEn: `Program ${key}`, nameUr: `پروگرام ${key}` })
      .onConflictDoUpdate({ target: tables.programs.key, set: { nameEn: `Program ${key}` } })
      .returning(),
  );
  const circle = opts.circle
    ? await first(
        db
          .insert(tables.circles)
          .values({ venueId: venue.id, nameEn: 'Test Circle', nameUr: 'ٹیسٹ حلقہ', language: 'ur' })
          .returning(),
      )
    : null;
  const session = await first(
    db
      .insert(tables.sessions)
      .values({
        programId: program.id,
        venueId: venue.id,
        circleId: circle?.id ?? null,
        kind: 'recurring',
        titleEn: 'Weekly tafsir',
        titleUr: 'ہفتہ وار تفسیر',
        section: 'family',
        language: 'ur',
        localStartTime: '19:30',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-03-01',
      })
      .returning(),
  );
  return {
    city,
    area,
    venue,
    program: { id: program.id, key },
    session: { id: session.id, circleId: circle?.id ?? null },
  };
}

export async function seedUser(
  db: Db,
  over: Partial<typeof tables.users.$inferInsert> = {},
): Promise<typeof tables.users.$inferSelect> {
  return first(
    db
      .insert(tables.users)
      .values({
        phoneE164: nextPhone(),
        phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
        displayName: 'Test Person',
        locale: 'en',
        ...over,
      })
      .returning(),
  );
}

export async function seedDevice(
  db: Db,
  userId: string,
  over: Partial<typeof tables.devices.$inferInsert> = {},
): Promise<typeof tables.devices.$inferSelect> {
  return first(
    db
      .insert(tables.devices)
      .values({
        userId,
        platform: 'android',
        provider: 'fcm',
        token: `token-${++slugCounter}`,
        locale: 'en',
        ...over,
      })
      .returning(),
  );
}

export async function seedConsent(
  db: Db,
  userId: string,
  over: Partial<typeof tables.consents.$inferInsert> = {},
): Promise<typeof tables.consents.$inferSelect> {
  return first(
    db
      .insert(tables.consents)
      .values({
        userId,
        channel: 'whatsapp',
        purpose: 'session_reminders',
        grantedAt: new Date('2026-01-02T00:00:00Z'),
        source: 'test',
        ...over,
      })
      .returning(),
  );
}

export async function seedOccurrence(
  db: Db,
  sessionId: string,
  startsAt: Date,
  over: Partial<typeof tables.occurrences.$inferInsert> = {},
): Promise<typeof tables.occurrences.$inferSelect> {
  return first(
    db
      .insert(tables.occurrences)
      .values({ sessionId, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), ...over })
      .returning(),
  );
}

export async function seedRegistration(
  db: Db,
  input: {
    userId: string;
    sessionId: string;
    areaId: string;
    occurrenceId?: string | null;
    status?: 'confirmed' | 'waitlisted' | 'cancelled';
  },
): Promise<typeof tables.registrations.$inferSelect> {
  return first(
    db
      .insert(tables.registrations)
      .values({
        userId: input.userId,
        sessionId: input.sessionId,
        areaId: input.areaId,
        occurrenceId: input.occurrenceId ?? null,
        section: 'family',
        partySize: 1,
        status: input.status ?? 'confirmed',
      })
      .returning(),
  );
}

let tokenCounter = 0;

/** A sign-in code for a synthetic number, with a fake hash. */
export async function seedOtpChallenge(
  db: Db,
  input: { expiresAt: Date; consumedAt?: Date | null },
): Promise<typeof tables.otpChallenges.$inferSelect> {
  return first(
    db
      .insert(tables.otpChallenges)
      .values({
        phoneE164: nextPhone(),
        channel: 'sms',
        codeHash: 'fake-code-hash',
        expiresAt: input.expiresAt,
        consumedAt: input.consumedAt ?? null,
      })
      .returning(),
  );
}

/** A refresh-token session with a fake hash. */
export async function seedAuthSession(
  db: Db,
  input: { userId: string; expiresAt: Date; revokedAt?: Date | null },
): Promise<typeof tables.authSessions.$inferSelect> {
  return first(
    db
      .insert(tables.authSessions)
      .values({
        userId: input.userId,
        refreshTokenHash: `fake-refresh-hash-${++tokenCounter}`,
        expiresAt: input.expiresAt,
        revokedAt: input.revokedAt ?? null,
      })
      .returning(),
  );
}
