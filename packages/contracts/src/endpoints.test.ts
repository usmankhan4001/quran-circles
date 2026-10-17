import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { messages } from '@qc/i18n';
import { errorsFor, type EndpointDef } from './define';
import { ENDPOINT_IDS, endpoints } from './endpoints';
import { ERROR_CODE_LIST, ERROR_CODES, errorMessageKey, makeApiError, ApiError } from './errors';
import { buildOpenApi, openApiJson } from './openapi';
import { ACTIONS, SCOPE_ACTIONS } from './scopes';

const defs = ENDPOINT_IDS.map((id) => [id, endpoints[id] as EndpointDef] as const);

describe('endpoint registry', () => {
  it('covers the P0 areas named in the contracts brief', () => {
    const groups = new Set(ENDPOINT_IDS.map((id) => id.split('.')[0]));
    for (const g of [
      'auth',
      'places',
      'venues',
      'sessions',
      'occurrences',
      'registrations',
      'consents',
      'follows',
      'updates',
      'devices',
      'adminRoles',
      'adminVenues',
      'adminCircles',
      'adminSessions',
      'adminOccurrences',
      'adminAttendance',
      'adminUpdates',
      'bookmarks',
      'readingPosition',
      'me',
      'config',
    ]) {
      expect(groups, g).toContain(g);
    }
    expect(ENDPOINT_IDS.length).toBeGreaterThanOrEqual(60);
  });

  it('keys equal ids and each id is group.operation', () => {
    for (const [key, def] of defs) {
      expect(def.id).toBe(key);
      expect(key.split('.')).toHaveLength(2);
    }
  });

  it('has unique method and path pairs', () => {
    const seen = new Set<string>();
    for (const [, d] of defs) {
      const k = `${d.method} ${d.path}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });

  it('puts every path parameter in the params schema and nothing else', () => {
    for (const [id, d] of defs) {
      const inPath = [...d.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const inSchema = d.params ? Object.keys(d.params.shape).sort() : [];
      expect(inSchema, id).toEqual(inPath);
    }
  });

  it('versions every path except the health check', () => {
    for (const [id, d] of defs) {
      if (id === 'system.health') expect(d.path).toBe('/health');
      else expect(d.path.startsWith('/v1/'), d.path).toBe(true);
    }
  });

  it('only sends bodies on POST, PUT and PATCH, and no body on GET', () => {
    for (const [id, d] of defs) {
      if (d.method === 'GET') expect(d.body, id).toBeUndefined();
      if (d.body) expect(['POST', 'PUT', 'PATCH', 'DELETE']).toContain(d.method);
    }
  });

  it('ties every endpoint to scope actions that match its auth level', () => {
    for (const [id, d] of defs) {
      for (const a of d.actions) expect(ACTIONS[a], `${id} -> ${a}`).toBeDefined();
      if (d.auth === 'staff') {
        expect(d.actions.length, id).toBeGreaterThan(0);
        for (const a of d.actions)
          expect(['public', 'self'], `${id} -> ${a}`).not.toContain(ACTIONS[a].level);
      }
      if (d.auth === 'user')
        for (const a of d.actions) expect(ACTIONS[a].level, `${id} -> ${a}`).toBe('self');
      if (d.auth === 'public')
        for (const a of d.actions) expect(ACTIONS[a].level, `${id} -> ${a}`).toBe('public');
    }
  });

  it('leaves no scope action without an endpoint', () => {
    const used = new Set(defs.flatMap(([, d]) => [...d.actions]));
    expect(SCOPE_ACTIONS.filter((a) => !used.has(a))).toEqual([]);
  });

  it('only lists real error codes, and common ones are added for you', () => {
    for (const [id, d] of defs) {
      for (const c of d.errors) expect(ERROR_CODE_LIST, `${id}: ${c}`).toContain(c);
      const all = errorsFor(d);
      expect(all).toContain('internal_error');
      expect(all).toContain('rate_limited');
      if (d.auth !== 'public') expect(all).toContain('unauthenticated');
    }
  });

  it('puts the sign-in code endpoints in the strict rate-limit bucket', () => {
    expect(endpoints['auth.requestCode'].rateLimit).toBe('auth_code');
    expect(endpoints['auth.verifyCode'].rateLimit).toBe('auth_code');
    expect(endpoints['registrations.create'].rateLimit).toBe('registration');
    expect(endpoints['adminUpdates.post'].rateLimit).toBe('messaging');
    expect(endpoints['adminRoles.invite'].rateLimit).toBe('messaging');
  });
});

describe('endpoints added in 1.0.0-rc.2', () => {
  const added = {
    'adminImport.venues': ['POST', '/v1/admin/import/venues', ['venue.create']],
    'adminImport.coordinators': [
      'POST',
      '/v1/admin/import/coordinators',
      [
        'role.assign_national_admin',
        'role.assign_city_coordinator',
        'role.assign_venue_coordinator',
      ],
    ],
    'adminImport.sessions': ['POST', '/v1/admin/import/sessions', ['session.create']],
    'adminRegistrations.export': ['GET', '/v1/admin/registrations/export', ['registration.export']],
    'adminSessions.get': ['GET', '/v1/admin/sessions/{sessionId}', ['session.list_admin']],
    'adminCircles.get': ['GET', '/v1/admin/circles/{circleId}', ['circle.list_admin']],
    'adminUpdates.preview': [
      'POST',
      '/v1/admin/updates/preview',
      ['update.post_national', 'update.post_city', 'update.post_venue'],
    ],
  } as const;

  for (const [id, [method, path, actions]] of Object.entries(added)) {
    it(`${id}: ${method} ${path}, guarded by existing actions only`, () => {
      const d = endpoints[id as keyof typeof endpoints] as EndpointDef;
      expect(d.method).toBe(method);
      expect(d.path).toBe(path);
      expect(d.auth).toBe('staff');
      // No new power: each endpoint reuses the action of the call it is equivalent to.
      expect([...d.actions]).toEqual(actions);
    });
  }

  it('runs the three imports as safe-to-retry POSTs with a dry-run flag and a 2000-row cap', () => {
    for (const id of [
      'adminImport.venues',
      'adminImport.coordinators',
      'adminImport.sessions',
    ] as const) {
      const d = endpoints[id] as EndpointDef;
      expect(d.idempotent, id).toBe(true);
      expect(d.success.status, id).toBe(200);
      expect(d.description, id).toMatch(/dryRun/);
      const ok = d.body!.safeParse({ dryRun: true, rows: [{}] });
      expect(ok.success, id).toBe(true);
      expect(
        d.body!.safeParse({ dryRun: true, rows: Array.from({ length: 2001 }, () => ({})) }).success,
        id,
      ).toBe(false);
    }
    expect(endpoints['adminImport.coordinators'].rateLimit).toBe('messaging');
  });

  it('returns the scoped export as CSV and keeps the one-session export', () => {
    expect(endpoints['adminRegistrations.export'].success.contentType).toBe('text/csv');
    expect(endpoints['registrations.export'].path).toBe(
      '/v1/admin/sessions/{sessionId}/registrations/export',
    );
  });

  it('documents resend as a new invite for the same number, and the handover field', () => {
    const description = (endpoints['adminRoles.invite'] as EndpointDef).description ?? '';
    expect(description).toMatch(/resend/i);
    expect(description).toMatch(/same number/);
    expect(description).toMatch(/replacesAssignmentId/);
  });

  it('lets me.delete fail with last_national_admin', () => {
    expect(errorsFor(endpoints['me.delete'] as EndpointDef)).toContain('last_national_admin');
  });

  it('allows not_found where the body points at an id that may not exist', () => {
    for (const id of [
      'registrations.create',
      'adminCircles.create',
      'adminSessions.create',
      'adminRoles.invite',
      'adminRoles.assign',
      'adminUpdates.post',
      'adminUpdates.preview',
      'follows.create',
    ] as const) {
      const d = endpoints[id] as EndpointDef;
      expect(d.params, id).toBeUndefined();
      expect(errorsFor(d), id).toContain('not_found');
    }
  });

  it('allows not_found on the scoped export for an unknown city or venue (rc.3)', () => {
    const d = endpoints['adminRegistrations.export'] as EndpointDef;
    expect(d.params).toBeUndefined();
    expect(errorsFor(d)).toContain('not_found');
    expect(errorsFor(d)).toContain('forbidden');
    expect(d.description).toMatch(/does not exist is `not_found`/);
  });

  it('refuses an import that races another write with conflict (rc.3)', () => {
    for (const id of [
      'adminImport.venues',
      'adminImport.coordinators',
      'adminImport.sessions',
    ] as const) {
      const d = endpoints[id] as EndpointDef;
      expect(errorsFor(d), id).toContain('conflict');
      expect(d.description, id).toMatch(/refused as a whole with `conflict`/);
    }
    expect(endpoints['adminImport.sessions'].description).toMatch(/invalid_range/);
  });

  it('documents that the invite response carries the handover for a resend (rc.3)', () => {
    const description = (endpoints['adminRoles.invite'] as EndpointDef).description ?? '';
    expect(description).toMatch(/returned `Invite`.*carries `replacesAssignmentId`/);
  });

  it('reads single records for sessions and circles with not_found', () => {
    expect(errorsFor(endpoints['adminSessions.get'] as EndpointDef)).toContain('not_found');
    expect(errorsFor(endpoints['adminCircles.get'] as EndpointDef)).toContain('not_found');
  });
});

describe('error codes', () => {
  it('has a stable status for each code', () => {
    expect(ERROR_CODES.validation_failed).toBe(400);
    expect(ERROR_CODES.unauthenticated).toBe(401);
    expect(ERROR_CODES.forbidden).toBe(403);
    expect(ERROR_CODES.not_found).toBe(404);
    expect(ERROR_CODES.rate_limited).toBe(429);
    expect(ERROR_CODES.internal_error).toBe(500);
    expect(ERROR_CODES.last_national_admin).toBe(409);
  });

  it('has 24 codes, none removed or renamed since Gate 1', () => {
    expect(ERROR_CODE_LIST).toHaveLength(24);
  });

  it('has an English and an Urdu message for every code', () => {
    for (const code of ERROR_CODE_LIST) {
      const key = errorMessageKey(code);
      expect((messages.en as Record<string, string>)[key]?.trim(), `en ${key}`).toBeTruthy();
      expect((messages.ur as Record<string, string>)[key]?.trim(), `ur ${key}`).toBeTruthy();
    }
  });

  it('builds a valid error body', () => {
    const body = makeApiError('rate_limited', 'req-1', { retryAfterSeconds: 30 });
    expect(ApiError.parse(body).error.messageKey).toBe('errors.rate_limited');
    expect(
      ApiError.safeParse({ error: { code: 'made_up', messageKey: 'x', requestId: 'r' } }).success,
    ).toBe(false);
  });
});

describe('OpenAPI document', () => {
  const doc = buildOpenApi() as {
    openapi: string;
    paths: Record<
      string,
      Record<
        string,
        { operationId: string; responses: Record<string, unknown>; security?: unknown }
      >
    >;
  };

  it('lists every endpoint once, under its method and path', () => {
    const ops: string[] = [];
    for (const methods of Object.values(doc.paths))
      for (const op of Object.values(methods)) ops.push(op.operationId);
    expect(ops.sort()).toEqual([...ENDPOINT_IDS].sort());
    for (const [, d] of defs)
      expect(doc.paths[d.path]?.[d.method.toLowerCase()]?.operationId).toBe(d.id);
  });

  it('documents the success status and each error status', () => {
    for (const [, d] of defs) {
      const op = doc.paths[d.path]![d.method.toLowerCase()]!;
      expect(Object.keys(op.responses)).toContain(String(d.success.status));
      for (const c of errorsFor(d))
        expect(Object.keys(op.responses)).toContain(String(ERROR_CODES[c]));
      expect(op.security !== undefined).toBe(d.auth !== 'public');
    }
  });

  it('is committed and up to date (run `pnpm --filter @qc/contracts gen`)', () => {
    const file = readFileSync(resolve(import.meta.dirname, '../openapi.json'), 'utf8');
    expect(file).toBe(openApiJson());
  });
});
