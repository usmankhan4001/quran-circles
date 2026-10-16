import { z } from 'zod';
import { ApiError, ERROR_CODES } from './errors';
import { endpoints, type EndpointId } from './endpoints';
import { errorsFor, type EndpointDef } from './define';

/** Bumped on a breaking change, with the lanes it affects. Frozen at Gate 1. */
export const CONTRACT_VERSION = '1.0.0-rc.1';

type Json = Record<string, unknown>;

const clean = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(clean);
  if (node && typeof node === 'object') {
    const obj = node as Json;
    const out: Json = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$schema') continue;
      // Zod emits long regexes next to these formats; the format says it already.
      if (k === 'pattern' && (obj.format === 'uuid' || obj.format === 'date-time' || obj.format === 'date')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return node;
};

export const toSchema = (schema: z.ZodType, io: 'input' | 'output'): Json =>
  clean(z.toJSONSchema(schema, { io, unrepresentable: 'any' })) as Json;

const parametersOf = (shape: z.ZodObject, where: 'path' | 'query'): Json[] => {
  const json = toSchema(shape, 'input') as { properties?: Record<string, Json>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, schema]) => {
    const { description, ...rest } = schema;
    const param: Json = {
      name,
      in: where,
      required: where === 'path' || (json.required ?? []).includes(name),
      schema: rest,
    };
    if (description) param.description = description;
    if (rest.type === 'array') Object.assign(param, { style: 'form', explode: true });
    return param;
  });
};

const toOperation = (def: EndpointDef): Json => {
  const parameters = [
    ...(def.params ? parametersOf(def.params, 'path') : []),
    ...(def.query ? parametersOf(def.query, 'query') : []),
  ];
  const successContent =
    def.success.status === 204
      ? undefined
      : {
          [def.success.contentType ?? 'application/json']: {
            schema: def.success.contentType === 'text/csv' ? { type: 'string' } : toSchema(def.success.schema!, 'output'),
          },
        };
  const responses: Json = {
    [String(def.success.status)]: {
      description: def.success.status === 204 ? 'No content' : 'Success',
      ...(successContent ? { content: successContent } : {}),
    },
  };
  const byStatus = new Map<number, string[]>();
  for (const code of errorsFor(def)) {
    const status = ERROR_CODES[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  for (const [status, codes] of [...byStatus].sort((a, b) => a[0] - b[0])) {
    responses[String(status)] = {
      description: `Error codes: ${codes.join(', ')}`,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
    };
  }
  const op: Json = {
    operationId: def.id,
    summary: def.summary,
    tags: [def.tag],
    ...(parameters.length ? { parameters } : {}),
    ...(def.body
      ? { requestBody: { required: true, content: { 'application/json': { schema: toSchema(def.body, 'input') } } } }
      : {}),
    responses,
    'x-auth': def.auth,
    'x-scope-actions': [...def.actions],
    'x-rate-limit': def.rateLimit,
    'x-idempotent': def.idempotent,
  };
  if (def.auth !== 'public') op.security = [{ bearerAuth: [] }];
  return op;
};

/** The OpenAPI 3.1 document, generated from the endpoint registry. `openapi.json` is its output. */
export function buildOpenApi(): Json {
  const paths: Record<string, Json> = {};
  for (const id of Object.keys(endpoints) as EndpointId[]) {
    const def = endpoints[id] as EndpointDef;
    paths[def.path] ??= {};
    paths[def.path]![def.method.toLowerCase()] = toOperation(def);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Quran Circles API',
      version: CONTRACT_VERSION,
      description:
        'Generated from packages/contracts. Times are UTC; show Pakistan time (UTC+5). Phone numbers are E.164. Errors carry a stable code and an i18n message key.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: { ApiError: toSchema(ApiError, 'output') },
    },
  };
}

export const openApiJson = (): string => `${JSON.stringify(buildOpenApi(), null, 2)}\n`;
