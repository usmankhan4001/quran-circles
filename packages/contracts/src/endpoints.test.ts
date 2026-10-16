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

describe('error codes', () => {
  it('has a stable status for each code', () => {
    expect(ERROR_CODES.validation_failed).toBe(400);
    expect(ERROR_CODES.unauthenticated).toBe(401);
    expect(ERROR_CODES.forbidden).toBe(403);
    expect(ERROR_CODES.not_found).toBe(404);
    expect(ERROR_CODES.rate_limited).toBe(429);
    expect(ERROR_CODES.internal_error).toBe(500);
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
