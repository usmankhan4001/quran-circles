import { describe, expect, it } from 'vitest';
import { createApiClient } from './client';
import { errorsFor, type EndpointDef } from './define';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { POSTER_FAILURE_CODES, POSTER_FORMATS } from './enums';
import * as fx from './fixtures';
import { fixtureId } from './fixtures';
import { createMockHandler } from './mock';
import {
  DEMO_POSTER_TEMPLATES,
  POSTER_FAILURE_RETRYABLE,
  posterFailureFromRenderer,
  posterLanguagesOf,
  posterLocaleOf,
  posterOutOfDate,
  posterSnapshotFromSession,
  posterStorageKey,
} from './posters';
import { ACTIONS, can, scopeFilter, type Principal, type ResourceScope } from './scopes';
import {
  Poster,
  PosterCreate,
  PosterFields,
  PosterRenderJob,
  PosterSourceSnapshot,
  PostersResponse,
  PosterTemplateKey,
  PosterTemplatesResponse,
  RendererErrorResponse,
  RendererRenderRequest,
  RendererRenderResponse,
  type RendererRenderRequestInput,
} from './schemas/posters';
import type { Session } from './schemas/sessions';

// The same synthetic sample the renderer's tests use (`apps/poster-renderer/src/sample.ts`).
const SAMPLE_SESSION: PosterSourceSnapshot = {
  sessionId: '0f6f1e4a-7c2b-4d1e-9a3b-5c8d2e1f4a60',
  sessionVersion: '2026-10-17T09:00:00.000Z',
  localStartTime: '21:30',
  durationMinutes: 60,
  daysOfWeek: [5],
  startsOn: '2026-10-23',
  endsOn: null,
  timezone: 'Asia/Karachi',
  venue: {
    id: '3b9d6c2e-1a4f-4e8b-8c7d-2f5e6a1b9c30',
    name: { en: 'Al-Noor Sample Masjid', ur: 'مسجد النور (نمونہ)' },
    area: { en: 'Block 7, Sample Town', ur: 'بلاک 7، نمونہ ٹاؤن' },
  },
};

const sampleRequest = (
  overrides: Partial<RendererRenderRequestInput> = {},
): RendererRenderRequestInput => ({
  templateId: 'cloud',
  formats: ['story'],
  language: 'en_ur',
  fields: {
    title: { en: 'Weekly Dars-e-Quran', ur: 'ہفتہ وار درسِ قرآن' },
    details: { en: 'Surah Al-Baqarah, verses 1 to 20', ur: 'سورۃ البقرہ، آیات 1 تا 20' },
    accent: 'tanzeem',
    qrTarget: 'register',
  },
  session: SAMPLE_SESSION,
  ...overrides,
});

const paths = (input: unknown): string[] => {
  const r = RendererRenderRequest.safeParse(input);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join('.')))];
};

describe('RendererRenderRequest (moved from the renderer, unchanged)', () => {
  it('accepts the sample and fills the defaults', () => {
    const parsed = RendererRenderRequest.parse({
      ...sampleRequest(),
      fields: { title: { en: 'A', ur: 'ب' } },
    });
    expect(parsed.fields.accent).toBe('tanzeem');
    expect(parsed.fields.qrTarget).toBe('register');
  });

  it('needs a title in every language the poster shows', () => {
    expect(
      paths(sampleRequest({ language: 'en_ur', fields: { title: { en: 'Only English' } } })),
    ).toEqual(['fields.title.ur']);
    expect(
      paths(sampleRequest({ language: 'ur', fields: { title: { en: 'Only English' } } })),
    ).toEqual(['fields.title.ur']);
    expect(
      paths(sampleRequest({ language: 'en', fields: { title: { en: 'Only English' } } })),
    ).toEqual([]);
  });

  it('refuses colours outside the palette and unknown fields', () => {
    expect(
      paths(sampleRequest({ fields: { title: { en: 'A', ur: 'ب' }, accent: '#ff0000' as never } })),
    ).toEqual(['fields.accent']);
    expect(
      paths({ ...sampleRequest(), fields: { title: { en: 'A', ur: 'ب' }, css: 'body{}' } }),
    ).toEqual(['fields']);
    expect(paths({ ...sampleRequest(), html: '<p>' })).toEqual(['']);
  });

  it('keeps template ids open, but only as a plain key', () => {
    // The final designs come later: a new key needs no contract change. The renderer refuses a
    // key it does not have.
    expect(paths(sampleRequest({ templateId: 'custom' }))).toEqual([]);
    expect(paths(sampleRequest({ templateId: 'final_2027-a' }))).toEqual([]);
    for (const bad of ['', 'Cloud', '9lives', 'night/../x', 'a b', 'x'.repeat(41)]) {
      expect(paths(sampleRequest({ templateId: bad })), bad).toEqual(['templateId']);
    }
  });

  it('refuses repeated formats and unknown formats', () => {
    expect(paths(sampleRequest({ formats: ['story', 'story'] }))).toEqual(['formats']);
    expect(paths(sampleRequest({ formats: ['square' as never] }))).toEqual(['formats.0']);
    expect(paths(sampleRequest({ formats: [] }))).toEqual(['formats']);
    expect(paths(sampleRequest({ formats: [...POSTER_FORMATS] }))).toEqual([]);
  });

  it('refuses text that is too long, empty, or carries control or bidi override characters', () => {
    const title = (en: string) => sampleRequest({ language: 'en', fields: { title: { en } } });
    expect(paths(title('x'.repeat(80)))).toEqual([]);
    expect(paths(title('x'.repeat(81)))).toEqual(['fields.title.en']);
    expect(paths(title('   '))).toEqual(['fields.title.en']);
    expect(paths(title('Free ‮eerf'))).toEqual(['fields.title.en']);
    expect(paths(title('Line\u0007bell'))).toEqual(['fields.title.en']);
    expect(paths(title('Dars ⁦isolate⁩'))).toEqual(['fields.title.en']);
    expect(paths(title('Mark ‎left'))).toEqual(['fields.title.en']);
    const details = sampleRequest({
      language: 'en',
      fields: { title: { en: 'A' }, details: { en: 'y'.repeat(141) } },
    });
    expect(paths(details)).toEqual(['fields.details.en']);
  });

  it('refuses a snapshot that is not a session', () => {
    const r = sampleRequest();
    expect(paths({ ...r, session: { ...SAMPLE_SESSION, sessionId: 'not-a-uuid' } })).toEqual([
      'session.sessionId',
    ]);
    expect(paths({ ...r, session: { ...SAMPLE_SESSION, localStartTime: '25:00' } })).toEqual([
      'session.localStartTime',
    ]);
  });

  it('orders languages with the leading one first', () => {
    expect(posterLanguagesOf('en')).toEqual(['en']);
    expect(posterLanguagesOf('ur')).toEqual(['ur']);
    expect(posterLanguagesOf('en_ur')).toEqual(['en', 'ur']);
    expect(posterLanguagesOf('ur_en')).toEqual(['ur', 'en']);
    expect(posterLocaleOf('ur_en')).toBe('ur');
    expect(posterLocaleOf('en')).toBe('en');
  });
});

describe('renderer answers and the queue job', () => {
  const hex = (c: string) => c.repeat(64);
  const answer = {
    templateId: 'cloud',
    templateVersion: 1,
    provisional: true,
    language: 'en_ur',
    locale: 'en',
    deepLink: `https://example.org/register/${SAMPLE_SESSION.sessionId}`,
    sourceSnapshot: SAMPLE_SESSION,
    altText: { en: 'Poster: Weekly Dars-e-Quran.', ur: 'پوسٹر: ہفتہ وار درسِ قرآن۔' },
    files: [
      {
        format: 'story',
        contentType: 'image/png',
        filename: 'poster-0f6f1e4a-cloud-story-en_ur.png',
        cacheKey: hex('a'),
        sha256: hex('b'),
        byteLength: 1234,
        cached: false,
        base64: 'iVBORw0KGgo=',
      },
    ],
  };

  it('reads the renderer body as `renderBody` builds it', () => {
    expect(RendererRenderResponse.safeParse(answer).success).toBe(true);
    expect(RendererRenderResponse.safeParse({ ...answer, files: [] }).success).toBe(false);
    const badKey = { ...answer, files: [{ ...answer.files[0], cacheKey: '../../etc' }] };
    expect(RendererRenderResponse.safeParse(badKey).success).toBe(false);
  });

  it('reads the renderer error body: codes and paths only', () => {
    expect(
      RendererErrorResponse.parse({
        error: { code: 'text_too_long', fields: ['title'], regions: ['title'] },
      }).error.code,
    ).toBe('text_too_long');
    expect(
      RendererErrorResponse.safeParse({
        error: {
          code: 'validation_failed',
          issues: [{ path: 'fields.title.en', code: 'too_big' }],
        },
      }).success,
    ).toBe(true);
    expect(RendererErrorResponse.safeParse({ error: {} }).success).toBe(false);
  });

  it('maps renderer failures to failure codes, and only the transient ones are retried', () => {
    expect(posterFailureFromRenderer(422, 'text_too_long')).toBe('text_too_long');
    expect(posterFailureFromRenderer(400, 'validation_failed')).toBe('invalid_request');
    expect(posterFailureFromRenderer(413, 'payload_too_large')).toBe('invalid_request');
    expect(posterFailureFromRenderer(503, 'busy')).toBe('busy');
    expect(posterFailureFromRenderer(504, 'render_timeout')).toBe('render_timeout');
    expect(posterFailureFromRenderer(500, 'render_failed')).toBe('render_failed');
    expect(posterFailureFromRenderer(401, 'unauthenticated')).toBe('render_failed');
    // No answer at all (network error).
    expect(posterFailureFromRenderer(0)).toBe('render_failed');
    expect(Object.keys(POSTER_FAILURE_RETRYABLE).sort()).toEqual([...POSTER_FAILURE_CODES].sort());
    expect(POSTER_FAILURE_CODES.filter((c) => POSTER_FAILURE_RETRYABLE[c]).sort()).toEqual([
      'busy',
      'render_failed',
      'render_timeout',
    ]);
  });

  it('stores files under the content-addressed key the renderer uses', () => {
    expect(posterStorageKey(SAMPLE_SESSION.sessionId, hex('c'), 'image/png')).toBe(
      `posters/${SAMPLE_SESSION.sessionId}/${hex('c')}.png`,
    );
    expect(posterStorageKey(SAMPLE_SESSION.sessionId, hex('d'), 'application/pdf')).toMatch(
      /\.pdf$/,
    );
  });

  it('carries one to four poster ids per job', () => {
    const one = fixtureId('poster', 1);
    expect(PosterRenderJob.safeParse({ posterIds: [one] }).success).toBe(true);
    expect(PosterRenderJob.safeParse({ posterIds: [] }).success).toBe(false);
    expect(PosterRenderJob.safeParse({ posterIds: Array(5).fill(one) }).success).toBe(false);
    expect(PosterRenderJob.safeParse({ posterIds: ['nope'] }).success).toBe(false);
  });
});

describe('posterOutOfDate (moved from the renderer, unchanged)', () => {
  const made = SAMPLE_SESSION;
  const later = (change: Partial<PosterSourceSnapshot>): PosterSourceSnapshot => ({
    ...made,
    sessionVersion: '2026-10-18T10:00:00.000Z',
    ...change,
  });
  const otherVenue = { ...made.venue, id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f' };

  it('is empty while the printed details are unchanged, even if the session version moved on', () => {
    expect(posterOutOfDate(made, made)).toEqual([]);
    expect(posterOutOfDate(made, later({}))).toEqual([]);
  });

  it('flags a new start time, new days or a new timezone as time', () => {
    expect(posterOutOfDate(made, later({ localStartTime: '20:00' }))).toEqual(['time']);
    expect(posterOutOfDate(made, later({ daysOfWeek: [4] }))).toEqual(['time']);
    expect(posterOutOfDate(made, later({ daysOfWeek: [4, 5] }))).toEqual(['time']);
    expect(posterOutOfDate(made, later({ timezone: 'Asia/Dubai' }))).toEqual(['time']);
  });

  it('ignores the order of days and what the poster does not print', () => {
    const multi = { ...made, daysOfWeek: [1, 5] };
    expect(posterOutOfDate(multi, { ...multi, daysOfWeek: [5, 1] })).toEqual([]);
    expect(posterOutOfDate(made, later({ durationMinutes: 90, endsOn: '2027-01-01' }))).toEqual([]);
    expect(posterOutOfDate(made, later({ startsOn: '2026-11-06' }))).toEqual([]);
  });

  it('flags a moved date for a one-off lecture', () => {
    const oneOff = { ...made, daysOfWeek: [], startsOn: '2026-11-07' };
    expect(posterOutOfDate(oneOff, { ...oneOff, startsOn: '2026-11-14' })).toEqual(['time']);
  });

  it('flags a new venue, a renamed venue or a new area as venue', () => {
    expect(posterOutOfDate(made, later({ venue: otherVenue }))).toEqual(['venue']);
    const renamed = {
      ...made.venue,
      name: { en: 'Renamed Sample Masjid', ur: made.venue.name.ur },
    };
    expect(posterOutOfDate(made, later({ venue: renamed }))).toEqual(['venue']);
    const noUrdu = { ...made.venue, name: { en: made.venue.name.en, ur: null } };
    expect(posterOutOfDate(made, later({ venue: noUrdu }))).toEqual(['venue']);
    expect(posterOutOfDate(made, later({ venue: { ...made.venue, area: null } }))).toEqual([
      'venue',
    ]);
  });

  it('reports both when time and venue changed', () => {
    expect(posterOutOfDate(made, later({ localStartTime: '20:00', venue: otherVenue }))).toEqual([
      'time',
      'venue',
    ]);
  });

  it('refuses to compare two different sessions', () => {
    expect(() =>
      posterOutOfDate(made, { ...made, sessionId: '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a' }),
    ).toThrow(RangeError);
  });

  it('builds the snapshot from the contract session', () => {
    const session = {
      id: made.sessionId,
      venue: {
        id: made.venue.id,
        cityId: made.venue.id,
        areaId: made.venue.id,
        name: made.venue.name,
        lat: 31.5,
        lng: 74.3,
      },
      localStartTime: '21:30',
      durationMinutes: 60,
      daysOfWeek: [5],
      startsOn: '2026-10-23',
      endsOn: null,
      timezone: 'Asia/Karachi',
    } as unknown as Session;
    const snapshot = posterSnapshotFromSession(session, 'v7', made.venue.area);
    expect(snapshot).toEqual({ ...made, sessionVersion: 'v7' });
    expect(posterSnapshotFromSession(session, 'v7').venue.area).toBeNull();
  });
});

describe('poster scopes, for every role', () => {
  const CITY_A = '00000000-0000-4000-8000-000000000a01';
  const CITY_B = '00000000-0000-4000-8000-000000000b01';
  const VENUE_A1 = '00000000-0000-4000-8000-0000000a0001';
  const VENUE_A2 = '00000000-0000-4000-8000-0000000a0002';
  const VENUE_B1 = '00000000-0000-4000-8000-0000000b0001';
  const ME = '00000000-0000-4000-8000-00000000fff1';
  const people: Record<string, Principal | null> = {
    public: null,
    attendee: { userId: ME, assignments: [] },
    venueCoordinatorA1: {
      userId: ME,
      assignments: [{ role: 'venue_coordinator', venueId: VENUE_A1 }],
    },
    cityCoordinatorA: { userId: ME, assignments: [{ role: 'city_coordinator', cityId: CITY_A }] },
    nationalAdmin: { userId: ME, assignments: [{ role: 'national_admin' }] },
  };
  const at: Record<string, ResourceScope> = {
    venueA1: { cityId: CITY_A, venueId: VENUE_A1 },
    venueA2: { cityId: CITY_A, venueId: VENUE_A2 },
    venueB1: { cityId: CITY_B, venueId: VENUE_B1 },
  };
  // Written out by hand: "Admins and coordinators in scope can make posters".
  const allowed: Record<string, string[]> = {
    public: [],
    attendee: [],
    venueCoordinatorA1: ['venueA1'],
    cityCoordinatorA: ['venueA1', 'venueA2'],
    nationalAdmin: ['venueA1', 'venueA2', 'venueB1'],
  };

  for (const action of ['poster.create', 'poster.read'] as const) {
    it(`${action} is a venue-level action for every staff role`, () => {
      expect(ACTIONS[action].level).toBe('venue');
      expect([...ACTIONS[action].roles].sort()).toEqual(
        ['city_coordinator', 'national_admin', 'venue_coordinator'].sort(),
      );
    });
    for (const [who, principal] of Object.entries(people)) {
      for (const [where, resource] of Object.entries(at)) {
        const expected = allowed[who]!.includes(where);
        it(`${who} ${expected ? 'can' : 'cannot'} ${action} at ${where}`, () => {
          expect(can(principal, action, resource)).toBe(expected);
        });
      }
    }
    it(`${action} filters lists to the caller's places`, () => {
      expect(scopeFilter(people.venueCoordinatorA1!, action).venueIds).toEqual([VENUE_A1]);
      expect(scopeFilter(people.cityCoordinatorA!, action).cityIds).toEqual([CITY_A]);
      expect(scopeFilter(people.nationalAdmin!, action).national).toBe(true);
      expect(scopeFilter(people.attendee!, action)).toEqual({
        national: false,
        cityIds: [],
        venueIds: [],
      });
    });
  }
});

describe('poster endpoints in the registry', () => {
  const table: Array<[keyof typeof endpoints, string, string, number, string]> = [
    ['adminPosters.templates', 'GET', '/v1/admin/poster-templates', 200, 'poster.create'],
    ['adminPosters.create', 'POST', '/v1/admin/sessions/{sessionId}/posters', 202, 'poster.create'],
    ['adminPosters.list', 'GET', '/v1/admin/sessions/{sessionId}/posters', 200, 'poster.read'],
    [
      'adminPosters.regenerate',
      'POST',
      '/v1/admin/posters/{posterId}/regenerate',
      202,
      'poster.create',
    ],
    ['adminPosters.file', 'GET', '/v1/admin/posters/{posterId}/file', 200, 'poster.read'],
  ];
  for (const [id, method, path, status, action] of table) {
    it(`${id}: ${method} ${path} answers ${status}, staff only, checked with ${action}`, () => {
      const d = endpoints[id] as EndpointDef;
      expect([d.method, d.path, d.success.status, d.auth]).toEqual([method, path, status, 'staff']);
      expect(d.actions).toEqual([action]);
    });
  }

  it('lists the errors each one can answer', () => {
    const errors = (id: keyof typeof endpoints) => errorsFor(endpoints[id] as EndpointDef);
    expect(errors('adminPosters.create')).toEqual(
      expect.arrayContaining(['forbidden', 'not_found', 'validation_failed', 'rate_limited']),
    );
    expect(errors('adminPosters.regenerate')).toEqual(
      expect.arrayContaining(['forbidden', 'not_found', 'conflict']),
    );
    expect(errors('adminPosters.file')).toEqual(
      expect.arrayContaining(['forbidden', 'not_found', 'conflict']),
    );
    expect(errors('adminPosters.templates')).not.toContain('not_found');
  });

  it('serves the file as bytes and everything else as JSON', () => {
    expect(endpoints['adminPosters.file'].success.contentType).toBe('application/octet-stream');
    expect(endpoints['adminPosters.list'].success.schema).toBe(PostersResponse);
    expect(endpoints['adminPosters.templates'].success.schema).toBe(PosterTemplatesResponse);
  });

  it('takes the create body with the same title rule as the renderer', () => {
    const body = { templateKey: 'night', language: 'ur_en', formats: ['story', 'print_a3'] };
    const ok = PosterCreate.safeParse({ ...body, fields: { title: { en: 'A', ur: 'ب' } } });
    expect(ok.success).toBe(true);
    const missing = PosterCreate.safeParse({ ...body, fields: { title: { en: 'A' } } });
    expect(missing.error?.issues.map((i) => i.path.join('.'))).toEqual(['fields.title.ur']);
    expect(
      PosterCreate.safeParse({ ...body, fields: { title: { en: 'A', ur: 'ب' } }, extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe('poster fixtures', () => {
  it('are the renderer templates, all formats, the demo ones provisional', () => {
    expect(fx.posterTemplates.map((t) => t.key)).toEqual(DEMO_POSTER_TEMPLATES.map((t) => t.key));
    expect(fx.posterTemplates.map((t) => t.key)).toEqual(['cloud', 'night', 'quranic_circles']);
    expect(PosterTemplatesResponse.safeParse({ items: fx.posterTemplates }).success).toBe(true);
    for (const t of fx.posterTemplates) {
      expect(t.formats).toEqual([...POSTER_FORMATS]);
      expect(t.provisional).toBe(t.key !== 'quranic_circles');
      expect(PosterTemplateKey.safeParse(t.key).success).toBe(true);
    }
  });

  it('validate against the poster schema, with a failure code only on failed ones', () => {
    for (const p of fx.posters) {
      const parsed = Poster.safeParse({ ...p, outOfDate: null });
      expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 2))).toBe(true);
      expect(p.failureCode !== null).toBe(p.status === 'failed');
      expect(p.fileUrl !== null).toBe(p.status === 'ready');
      expect(p.locale).toBe(posterLocaleOf(p.language));
      expect(PosterFields.safeParse(p.fields).success).toBe(true);
    }
  });
});

describe('mock server, poster endpoints by role', () => {
  const mock = createMockHandler();
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return mock(
      new Request(`http://mock.test${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  };
  const json = async (r: Response) => (await r.json()) as unknown;
  const code = async (r: Response) => ApiError.parse(await r.json()).error.code;

  const sessionAlNoor = fixtureId('session', 1); // Al-Noor, Rawalpindi
  const sessionIqra = fixtureId('session', 2); // Markaz Iqra, Rawalpindi, another venue
  const sessionLahore = fixtureId('session', 5);
  const STAFF = ['mock-venue', 'mock-city', 'mock-staff'] as const;
  const body = {
    templateKey: 'cloud',
    language: 'en_ur',
    formats: ['story', 'print_a4'],
    fields: { title: { en: 'Taraweeh with Dora', ur: 'تراویح مع دورہ' } },
  };

  it('lists the templates for every staff role, and nobody else', async () => {
    for (const token of STAFF) {
      const r = await call('GET', '/v1/admin/poster-templates', token);
      expect(r.status, token).toBe(200);
      expect(PosterTemplatesResponse.parse(await json(r)).items.map((t) => t.key)).toEqual([
        'cloud',
        'night',
        'quranic_circles',
      ]);
    }
    expect((await call('GET', '/v1/admin/poster-templates', 'mock-user')).status).toBe(403);
    expect((await call('GET', '/v1/admin/poster-templates')).status).toBe(401);
  });

  it('lists a session posters, newest first, with the out-of-date flag', async () => {
    const r = await call('GET', `/v1/admin/sessions/${sessionAlNoor}/posters`, 'mock-venue');
    expect(r.status).toBe(200);
    const items = PostersResponse.parse(await json(r)).items;
    expect(items.map((p) => p.id)).toEqual([5, 3, 1, 2].map((n) => fixtureId('poster', n)));
    const byId = new Map(items.map((p) => [p.id, p]));
    // Made when the session started at 20:30; it starts at 21:00 now.
    expect(byId.get(fixtureId('poster', 2))!.outOfDate).toEqual({ reasons: ['time'] });
    expect(byId.get(fixtureId('poster', 1))!.outOfDate).toBeNull();
    expect(byId.get(fixtureId('poster', 3))).toMatchObject({
      status: 'failed',
      failureCode: 'text_too_long',
      fileUrl: null,
    });
    expect(byId.get(fixtureId('poster', 5))!.replacesPosterId).toBe(fixtureId('poster', 2));
  });

  it('lets each role list posters only for sessions in its scope', async () => {
    const list = (token: string, sessionId: string) =>
      call('GET', `/v1/admin/sessions/${sessionId}/posters`, token).then((r) => r.status);
    expect(await list('mock-venue', sessionAlNoor)).toBe(200);
    expect(await list('mock-venue', sessionIqra)).toBe(403);
    expect(await list('mock-venue', sessionLahore)).toBe(403);
    expect(await list('mock-city', sessionIqra)).toBe(200);
    expect(await list('mock-city', sessionLahore)).toBe(403);
    expect(await list('mock-staff', sessionLahore)).toBe(200);
    expect(await list('mock-user', sessionAlNoor)).toBe(403);
    expect(await list('mock-staff', fixtureId('session', 999))).toBe(404);
  });

  it('queues one poster per format, from the session as it is now', async () => {
    const r = await call('POST', `/v1/admin/sessions/${sessionAlNoor}/posters`, 'mock-venue', body);
    expect(r.status).toBe(202);
    const items = PostersResponse.parse(await json(r)).items;
    expect(items.map((p) => p.format)).toEqual(['story', 'print_a4']);
    for (const p of items) {
      expect(p).toMatchObject({
        sessionId: sessionAlNoor,
        templateKey: 'cloud',
        language: 'en_ur',
        locale: 'en',
        status: 'queued',
        failureCode: null,
        fileUrl: null,
        outOfDate: null,
        replacesPosterId: null,
      });
      expect(p.fields).toMatchObject({ accent: 'tanzeem', qrTarget: 'register' });
      expect(p.sourceSnapshot).toEqual(fx.fixturePosterSnapshot(sessionAlNoor));
    }
  });

  it('lets each role make posters only for sessions in its scope', async () => {
    const make = (token: string, sessionId: string) =>
      call('POST', `/v1/admin/sessions/${sessionId}/posters`, token, body).then((r) => r.status);
    expect(await make('mock-venue', sessionAlNoor)).toBe(202);
    expect(await make('mock-venue', sessionIqra)).toBe(403);
    expect(await make('mock-city', sessionIqra)).toBe(202);
    expect(await make('mock-city', sessionLahore)).toBe(403);
    expect(await make('mock-staff', sessionLahore)).toBe(202);
    expect(await make('mock-user', sessionAlNoor)).toBe(403);
  });

  it('answers not_found for an unknown session or template, and names a missing title', async () => {
    const unknownSession = await call(
      'POST',
      `/v1/admin/sessions/${fixtureId('session', 999)}/posters`,
      'mock-staff',
      body,
    );
    expect(await code(unknownSession)).toBe('not_found');
    const unknownTemplate = await call(
      'POST',
      `/v1/admin/sessions/${sessionAlNoor}/posters`,
      'mock-staff',
      { ...body, templateKey: 'final_design' },
    );
    expect(unknownTemplate.status).toBe(404);
    const noUrdu = await call('POST', `/v1/admin/sessions/${sessionAlNoor}/posters`, 'mock-staff', {
      ...body,
      fields: { title: { en: 'Only English' } },
    });
    expect(noUrdu.status).toBe(400);
    expect(ApiError.parse(await json(noUrdu)).error.issues).toEqual([
      { path: 'fields.title.ur', code: 'custom' },
    ]);
  });

  it('regenerates a ready or failed poster, refuses a queued one, and checks scope', async () => {
    const regen = (token: string, n: number) =>
      call('POST', `/v1/admin/posters/${fixtureId('poster', n)}/regenerate`, token);
    const r = await regen('mock-venue', 2);
    expect(r.status).toBe(202);
    const fresh = Poster.parse(await json(r));
    expect(fresh).toMatchObject({
      status: 'queued',
      replacesPosterId: fixtureId('poster', 2),
      format: 'print_a4',
      templateKey: 'cloud',
      language: 'en_ur',
      outOfDate: null,
    });
    expect(fresh.sourceSnapshot.localStartTime).toBe('21:00');
    expect((await regen('mock-venue', 3)).status).toBe(202);
    const queued = await regen('mock-staff', 5);
    expect(queued.status).toBe(409);
    expect(await code(queued)).toBe('conflict');
    expect((await regen('mock-venue', 4)).status).toBe(403);
    expect((await regen('mock-city', 4)).status).toBe(403);
    expect((await regen('mock-staff', 4)).status).toBe(202);
    expect((await regen('mock-user', 1)).status).toBe(403);
    expect((await regen('mock-staff', 999)).status).toBe(404);
  });

  it('serves a ready poster file as PNG or PDF, and only in scope', async () => {
    const file = (token: string, n: number) =>
      call('GET', `/v1/admin/posters/${fixtureId('poster', n)}/file`, token);
    const story = await file('mock-venue', 1);
    expect(story.status).toBe(200);
    expect(story.headers.get('content-type')).toBe('image/png');
    expect(story.headers.get('content-disposition')).toMatch(/^attachment; filename="poster-/);
    const png = new Uint8Array(await story.arrayBuffer());
    expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
    const a4 = await file('mock-city', 2);
    expect(a4.headers.get('content-type')).toBe('application/pdf');
    expect(new TextDecoder().decode(new Uint8Array(await a4.arrayBuffer())).slice(0, 5)).toBe(
      '%PDF-',
    );
    expect(await code(await file('mock-staff', 3))).toBe('conflict');
    expect(await code(await file('mock-staff', 5))).toBe('conflict');
    expect((await file('mock-venue', 4)).status).toBe(403);
    expect((await file('mock-staff', 4)).status).toBe(200);
    expect((await file('mock-user', 1)).status).toBe(403);
    expect((await file('mock-staff', 999)).status).toBe(404);
  });
});

describe('typed client, poster endpoints', () => {
  const mock = createMockHandler();
  const api = createApiClient({
    baseUrl: 'http://mock.test',
    getAccessToken: () => 'mock-venue',
    fetch: (async (url: string | URL | Request, init?: RequestInit) =>
      mock(new Request(url as string, init))) as typeof fetch,
  });

  it('lists, creates and downloads, with the file as bytes', async () => {
    const templates = await api.adminPosters.templates();
    expect(templates.items).toHaveLength(3);
    const sessionId = fixtureId('session', 1);
    const list = await api.adminPosters.list({ params: { sessionId } });
    expect(list.items.some((p) => p.outOfDate?.reasons.includes('time'))).toBe(true);
    const made = await api.adminPosters.create({
      params: { sessionId },
      body: {
        templateKey: 'night',
        language: 'ur',
        formats: ['link_preview'],
        fields: { title: { ur: 'دورہ' } },
      },
    });
    expect(made.items[0]).toMatchObject({ locale: 'ur', format: 'link_preview' });
    const bytes = await api.adminPosters.file({ params: { posterId: fixtureId('poster', 1) } });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('refuses a body without the leading title before it is sent', async () => {
    await expect(
      api.adminPosters.create({
        params: { sessionId: fixtureId('session', 1) },
        body: {
          templateKey: 'cloud',
          language: 'ur_en',
          formats: ['story'],
          fields: { title: { en: 'English only' } },
        },
      }),
    ).rejects.toThrow();
  });
});
