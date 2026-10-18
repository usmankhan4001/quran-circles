import {
  can,
  scopeFilter,
  type ImportResult,
  type Principal,
  type ResourceScope,
  type ScopeAction,
} from '@qc/contracts';
import { endpointDef } from '../http';
import type { Expectation, Scenario, World } from './types';

/**
 * The oracle. Everything comes from the contract and the scope engine:
 * - `auth: 'public'`: everyone passes (and every listed action must be public for `can(null)`).
 * - `auth: 'user'`: anonymous is 401; a signed-in caller passes on their own record and is
 *   refused on another person's (`can` with `ownerUserId`).
 * - `auth: 'staff'`: `can` for the scenario's action at its target, as the API's matrix test.
 */
const holdsAny = (principal: Principal | null, actions: readonly ScopeAction[]): boolean =>
  actions.some((action) => {
    const f = scopeFilter(principal, action);
    return f.national || f.cityIds.length > 0 || f.venueIds.length > 0;
  });

const listCovers = (principal: Principal | null, action: ScopeAction, world: World): boolean => {
  const f = scopeFilter(principal, action);
  return f.national || f.cityIds.includes(world.cityA.id) || f.venueIds.includes(world.venueA1);
};

export function expectationFor(
  scenario: Scenario,
  principal: Principal | null,
  world: World,
  ownerUserId: string,
): Expectation {
  const def = endpointDef(scenario.id);
  if (def.auth === 'public') {
    for (const action of def.actions) {
      if (!can(null, action)) throw new Error(`${scenario.id}: public endpoint with ${action}`);
    }
    return 'allow';
  }
  if (!principal?.userId) return 'unauthenticated';
  if (def.auth === 'user') {
    const owner = scenario.owner === 'other' ? ownerUserId : principal.userId;
    const allowed = def.actions.every((a) => can(principal, a, { ownerUserId: owner }));
    return allowed ? 'allow' : 'refused';
  }
  const spec = scenario.staff;
  if (!spec) throw new Error(`${scenario.id}: staff endpoint without a staff spec`);
  let allowed: boolean;
  if (spec.oracle === 'holds_any') allowed = holdsAny(principal, [spec.action]);
  else if (spec.oracle === 'list_covers') allowed = listCovers(principal, spec.action, world);
  else {
    const resource: ResourceScope =
      spec.target === 'venue'
        ? { cityId: world.cityA.id, venueId: world.venueA1 }
        : spec.target === 'city'
          ? { cityId: world.cityA.id }
          : {};
    allowed = can(principal, spec.action, resource);
  }
  if (allowed) return 'allow';
  if (spec.denied && holdsAny(principal, spec.qualifying ?? [spec.action])) return spec.denied;
  return 'deny';
}

export interface Verdict {
  ok: boolean;
  /** Set when not ok: why, in a few words (never response data). */
  reason?: string;
}

/** Compares one answer with the expectation. */
export function judge(expected: Expectation, status: number, body: unknown): Verdict {
  if (status === 0) return { ok: false, reason: 'no HTTP answer' };
  if (status === 429) return { ok: false, reason: 'rate limited (inconclusive)' };
  if (status >= 500) return { ok: false, reason: `server error ${status}` };
  switch (expected) {
    case 'allow':
      return status === 401 || status === 403
        ? { ok: false, reason: `refused (${status}) where the matrix allows` }
        : { ok: true };
    case 'unauthenticated':
      return status === 401 ? { ok: true } : { ok: false, reason: `expected 401, got ${status}` };
    case 'deny':
      return status === 403
        ? { ok: true }
        : { ok: false, reason: `expected 403, got ${status}${status < 300 ? ' (LEAK)' : ''}` };
    case 'not_found':
      return status === 404
        ? { ok: true }
        : { ok: false, reason: `expected 404, got ${status}${status < 300 ? ' (LEAK)' : ''}` };
    case 'refused':
      return status === 403 || status === 404
        ? { ok: true }
        : { ok: false, reason: `expected 403/404, got ${status}${status < 300 ? ' (LEAK)' : ''}` };
    case 'row_forbidden': {
      if (status !== 200)
        return { ok: false, reason: `expected 200 with a forbidden row, got ${status}` };
      const result = body as Partial<ImportResult> | null;
      const row = result?.rows?.[0];
      const forbidden =
        result?.applied === false &&
        row?.status === 'invalid' &&
        row.issues.some((i) => i.code === 'forbidden');
      return forbidden
        ? { ok: true }
        : { ok: false, reason: 'import row not refused as forbidden (LEAK)' };
    }
  }
}
