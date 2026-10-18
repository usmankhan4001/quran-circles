import type { EndpointId, Principal, ScopeAction } from '@qc/contracts';
import type { CallInput } from '../http';
import type { Person } from '../people';

/**
 * The kinds of caller every endpoint is tried as. The first eight mirror the API's in-process
 * matrix test (`apps/api/src/test/scope-matrix.test.ts`); `vc_revoked` adds a coordinator whose
 * assignment was revoked after they used it, to prove roles are read live ("a revoked assignment
 * never counts", SCOPES.md).
 */
export const CALLER_KINDS = [
  'anonymous',
  'attendee',
  'vc_venue',
  'vc_same_city',
  'vc_other_city',
  'cc_city',
  'cc_other_city',
  'national_admin',
  'vc_revoked',
] as const;
export type CallerKind = (typeof CALLER_KINDS)[number];

export const CALLER_NAMES: Record<CallerKind, string> = {
  anonymous: 'anonymous',
  attendee: 'attendee',
  vc_venue: 'venue coordinator of the venue',
  vc_same_city: 'venue coordinator of another venue in the city',
  vc_other_city: 'venue coordinator in another city',
  cc_city: 'city coordinator of the city',
  cc_other_city: 'city coordinator of another city',
  national_admin: 'national admin',
  vc_revoked: 'venue coordinator of the venue, revoked',
};

export interface Caller {
  kind: CallerKind;
  person: Person | null;
  /** What the scope engine should see: live roles only (a revoked caller has none). */
  principal: Principal | null;
}

/** Places the run created (or found) through the API. */
export interface World {
  cityA: { id: string; areaId: string };
  cityB: { id: string; areaId: string };
  /** The venue every staff scenario acts on, in city A. */
  venueA1: string;
  venueA2: string;
  venueB1: string;
}

/** Records the staff scenarios act on, made through the API for this run. */
export interface Fixture {
  world: World;
  runTag: string;
  fixedCode: string;
  /** Pakistan date of the run, and a date ahead for picks. */
  today: string;
  pickDate: string;
  sessionId: string;
  /** A second session at the venue, for registering and cancelling in a scenario's preparation. */
  session2Id: string;
  occurrenceId: string;
  circleId: string;
  inviteId: string;
  assignmentId: string;
  handoverTargetUserId: string;
  venueDailyAyahId: string;
  nationalDailyAyahId: string;
  posterId: string;
  hijriOffsetDays: number;
  /** A separate attendee whose own records the other callers must not reach. */
  owner: {
    userId: string;
    registrationId: string;
    followId: string;
    deviceId: string;
    bookmarkId: string;
    circleRequestId: string;
  };
}

/**
 * What a caller must get back.
 * - allow: past authorisation: not 401, not 403, not 5xx (the request may still fail for another
 *   reason, such as a conflict).
 * - unauthenticated: 401.
 * - deny: 403.
 * - not_found: 404 (a single record outside the caller's scope).
 * - row_forbidden: 200 with the import row reported invalid with the issue `forbidden`.
 * - refused: 403 or 404 (another person's own record: either refusal is fine, data is not).
 */
export type Expectation =
  'allow' | 'unauthenticated' | 'deny' | 'not_found' | 'row_forbidden' | 'refused';

export interface StaffSpec {
  action: ScopeAction;
  target: 'venue' | 'city' | 'national' | 'any';
  /** Overrides `can` when the endpoint decides by its own rule. */
  oracle?: 'holds_any' | 'list_covers';
  /** What a refused caller who holds a qualifying role somewhere sees, when that is not 403. */
  denied?: 'not_found' | 'row_forbidden';
  /** The actions that count as a qualifying role; the scenario's action when left out. */
  qualifying?: ScopeAction[];
}

/** Ids a scenario's preparation made for one caller (their own follow, a fresh challenge). */
export type Prepared = Record<string, string>;

export interface Scenario {
  id: EndpointId;
  label: string;
  /** Staff endpoints: the action and target the oracle checks. */
  staff?: StaffSpec;
  /** User endpoints: whose record the call acts on. `self` unless set. */
  owner?: 'self' | 'other';
  /**
   * Per-caller preparation through the API (their own follow to then delete, a fresh sign-in
   * challenge). Runs before the call; anonymous callers get the preparation of a fresh person.
   */
  prepare?: PrepareStep;
  request: (fx: Fixture, prepared: Prepared) => CallInput;
  /** Uses fresh callers of every kind, because it ends their session or deletes their account. */
  disposable?: boolean;
  /** Runs after every other scenario (it archives the shared venue). */
  last?: boolean;
}

export type PrepareStep =
  | 'fresh_phone'
  | 'challenge'
  | 'fresh_refresh_token'
  | 'own_follow_update'
  | 'own_follow_delete'
  | 'own_device'
  | 'own_bookmark'
  | 'own_circle_request'
  | 'own_registration'
  | 'own_memorisation';
