import type { z } from 'zod';
import type { ErrorCode } from './errors';
import type { ScopeAction } from './scopes';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Rate-limit buckets from docs/engineering/conventions.md. The API lane sets the numbers. */
export type RateLimitBucket = 'default' | 'auth_code' | 'registration' | 'messaging';

export interface EndpointDef {
  /** `group.operation`, two parts. The key in `endpoints` must equal it. */
  id: `${string}.${string}`;
  method: HttpMethod;
  /** OpenAPI style, for example `/v1/venues/{venueId}`. */
  path: string;
  summary: string;
  tag: string;
  /** public: no token. user: any signed-in person. staff: needs a role, checked per action. */
  auth: 'public' | 'user' | 'staff';
  /**
   * Scope actions checked for this endpoint. When there are several, the API picks one from the
   * request (for example by the scope in the body) using `roleAssignAction` / `updatePostAction`.
   */
  actions: readonly ScopeAction[];
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  success: {
    status: 200 | 201 | 202 | 204;
    schema?: z.ZodType;
    contentType?: 'application/json' | 'text/csv';
  };
  /** Domain errors only. Common errors are added by `errorsFor`. */
  errors: readonly ErrorCode[];
  rateLimit: RateLimitBucket;
  /** True when a client may retry the call safely. */
  idempotent: boolean;
}

export type EndpointInput = Omit<EndpointDef, 'rateLimit' | 'idempotent' | 'errors' | 'actions'> &
  Partial<Pick<EndpointDef, 'rateLimit' | 'idempotent' | 'errors' | 'actions'>>;

/** Fills in the defaults and keeps the literal types for the typed client. */
export function endpoint<const T extends EndpointInput>(
  def: T,
): T & { rateLimit: RateLimitBucket; idempotent: boolean; errors: readonly ErrorCode[]; actions: readonly ScopeAction[] } {
  return {
    errors: [],
    actions: [],
    rateLimit: 'default',
    idempotent: def.method === 'GET' || def.method === 'PUT' || def.method === 'DELETE',
    ...def,
  } as never;
}

/** All error codes an endpoint can return, in a stable order. */
export function errorsFor(def: EndpointDef): ErrorCode[] {
  const out = new Set<ErrorCode>(def.errors);
  out.add('rate_limited');
  out.add('internal_error');
  out.add('service_unavailable');
  if (def.auth !== 'public') {
    out.add('unauthenticated');
    out.add('token_expired');
    out.add('account_suspended');
  }
  if (def.auth === 'staff' || def.actions.length > 0) out.add('forbidden');
  if (def.params) out.add('not_found');
  if (def.params || def.query || def.body) out.add('validation_failed');
  return [...out];
}
