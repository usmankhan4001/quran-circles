# Change request: one lock around issuing a sign-in code

Requested by: api-core (multi-process API, owner decision 2026-10-18: 2 CPUs at launch)
Contract: none (behaviour inside the auth-scopes lane: `apps/api/src/modules/auth/otp.ts`)
What I need: `requestCode` checks the resend wait and the code ceilings (10 per number a day, 1,000 an hour and 10,000 a day for everyone, SEC-04/SEC-07) with separate queries, then stores the code in a later transaction. Parallel requests all read the same count and all pass, so a ceiling with one slot left lets through every request in flight. Move the resend wait, the ceilings and the insert into the one transaction, behind `pg_advisory_xact_lock(hashtext('otp_issue'))`, so codes are issued one at a time on every API process.

Why: the ceilings must be exact (orchestrator brief for the 2-process API). Measured on a real Postgres 16 with the real API, 1,100 code requests from 100 addresses at 60 at a time, after 31 earlier codes: **1,025 codes stored with 1 process, 1,018 to 1,021 with 2 processes** (cap 1,000). With the patch below, 2 processes: **exactly 1,000**. The race is the same with one process (it is in the code, not in the cluster); more processes only make it likelier. In the lane's own test (PGlite, one process) 8 parallel requests under a cap of 3 all pass today; with the patch 3 pass. A cost: one global lock for a few milliseconds per code request, against at most 1,000 codes an hour.

Proposed change: the patch below (`git apply` from the repository root; checked to apply on main at 8fb8845). It passes the lane's tests (`src/modules/auth`, `src/auth`, `src/test/auth-wiring.test.ts`: 251), typecheck, eslint and prettier. It also adds the test `lets parallel requests take the last slots under a ceiling only once` to `sign-in.test.ts` (fails on today's code, passes with the patch). The sign-in limits per number, per address and for refresh are not part of this: they are shared across processes by the cluster primary (`apps/api/src/middleware/shared-limits.ts`, wired in `apps/api/src/index.ts` through `AuthDeps.rateLimiter`), with no change to the auth lane.

Affected lanes: auth-scopes (owns the files), api-core (requested), platform (`infra/ENV.md` mentions this request until it lands).

Workaround meanwhile: none needed for launch safety beyond the per-address and per-number limits, which stay exact; the global ceilings can be passed by about the number of code requests in flight at the moment they are reached (20 to 25 in the test above).

```diff
--- a/apps/api/src/modules/auth/otp.ts
+++ b/apps/api/src/modules/auth/otp.ts
@@ -6,7 +6,7 @@
 import type { AuthContext } from '../../auth/context';
 import { hashCode, hashIdentifier, safeEqualHex, generateCode } from '../../auth/crypto';
 import { AuthHttpError, rateLimited } from '../../auth/errors';
-import { describeError } from '../../auth/types';
+import { describeError, type AuthDb } from '../../auth/types';
 import type { RequestCodeInput, RequestCodeResult, VerifyCodeInput } from './types';

 const { otpChallenges } = schema;
@@ -23,8 +23,8 @@
 }

 /** Codes made for this number in the last hour, newest first. */
-async function recentChallenges(ctx: AuthContext, phone: string, now: Date) {
-  return ctx.db
+async function recentChallenges(ctx: AuthContext, phone: string, now: Date, db: AuthDb = ctx.db) {
+  return db
     .select({ createdAt: otpChallenges.createdAt })
     .from(otpChallenges)
     .where(
@@ -38,8 +38,13 @@
 }

 /** Seconds until another code may be asked for, or 0. Kept in the database, so it survives restarts. */
-async function cooldownRemaining(ctx: AuthContext, phone: string, now: Date): Promise<number> {
-  const recent = await recentChallenges(ctx, phone, now);
+async function cooldownRemaining(
+  ctx: AuthContext,
+  phone: string,
+  now: Date,
+  db: AuthDb = ctx.db,
+): Promise<number> {
+  const recent = await recentChallenges(ctx, phone, now, db);
   const newest = recent[0];
   if (!newest) return 0;
   const elapsed = (now.getTime() - newest.createdAt.getTime()) / 1000;
@@ -59,11 +64,11 @@

 /** Codes made since `since` (for one number, or for everyone), and the oldest of them. */
 async function issuedSince(
-  ctx: AuthContext,
+  db: AuthDb,
   since: Date,
   phone?: string,
 ): Promise<{ n: number; oldest: Date | null }> {
-  const [row] = await ctx.db
+  const [row] = await db
     .select({ n: count(), oldest: min(otpChallenges.createdAt) })
     .from(otpChallenges)
     .where(
@@ -83,20 +88,26 @@
  * The ceilings kept in the database (SEC-04, SEC-07): codes per number in any 24 hours, and codes
  * for everyone together per hour and per 24 hours, a cost backstop against SMS pumping. They count
  * `otp_challenges` rows, which the purge keeps for a day past their expiry, so they hold across
- * restarts and processes. A delivery that failed deletes its row and is not counted.
+ * restarts and processes. A delivery that failed deletes its row and is not counted. Runs inside
+ * `requestCode`'s transaction, under its lock, so the count and the new row go together.
  */
-async function enforceCodeCaps(ctx: AuthContext, phone: string, now: Date): Promise<void> {
+async function enforceCodeCaps(
+  ctx: AuthContext,
+  db: AuthDb,
+  phone: string,
+  now: Date,
+): Promise<void> {
   const caps = ctx.config.codeCaps;
   const dayAgo = new Date(now.getTime() - DAY_MS);
-  const mine = await issuedSince(ctx, dayAgo, phone);
+  const mine = await issuedSince(db, dayAgo, phone);
   if (mine.n >= caps.perPhonePerDay) throw rateLimited(secondsUntilFree(mine.oldest, DAY_MS, now));

-  const lastHour = await issuedSince(ctx, new Date(now.getTime() - HOUR_MS));
+  const lastHour = await issuedSince(db, new Date(now.getTime() - HOUR_MS));
   if (lastHour.n >= caps.globalPerHour) {
     ctx.logger.warn('auth.code_global_cap_reached', { window: 'hour', limit: caps.globalPerHour });
     throw rateLimited(secondsUntilFree(lastHour.oldest, HOUR_MS, now));
   }
-  const lastDay = await issuedSince(ctx, dayAgo);
+  const lastDay = await issuedSince(db, dayAgo);
   if (lastDay.n >= caps.globalPerDay) {
     ctx.logger.warn('auth.code_global_cap_reached', { window: 'day', limit: caps.globalPerDay });
     throw rateLimited(secondsUntilFree(lastDay.oldest, DAY_MS, now));
@@ -144,16 +155,21 @@
   await enforce(ctx, `otp-request:ip:${ipHash}`, rateLimits.requestPerIp, now);
   await enforce(ctx, `otp-request:phone:${phoneHash}`, rateLimits.requestPerPhone, now);

-  const wait = await cooldownRemaining(ctx, phone, now);
-  if (wait > 0) throw rateLimited(wait);
-  await enforceCodeCaps(ctx, phone, now);
-
   const challengeId = randomUUID();
   const code = otp.fixedCode ?? generateCode();
   const expiresAt = new Date(now.getTime() + otp.ttlSeconds * 1000);

-  // Only the newest code for a number works: retire the others, then add this one.
   await ctx.db.transaction(async (tx) => {
+    // One code is issued at a time, on every API process: the resend wait and the ceilings are
+    // counted and the new code is stored under one transaction-scoped lock, so parallel requests
+    // cannot all pass a ceiling that has one slot left (SEC-04, SEC-07). Sign-ins are rare enough
+    // that waiting a few milliseconds for the lock costs nothing.
+    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('otp_issue'))`);
+    const wait = await cooldownRemaining(ctx, phone, now, tx);
+    if (wait > 0) throw rateLimited(wait);
+    await enforceCodeCaps(ctx, tx, phone, now);
+
+    // Only the newest code for a number works: retire the others, then add this one.
     await tx
       .update(otpChallenges)
       .set({ consumedAt: now })
--- a/apps/api/src/modules/auth/sign-in.test.ts
+++ b/apps/api/src/modules/auth/sign-in.test.ts
@@ -549,6 +549,33 @@
     }
   });

+  it('lets parallel requests take the last slots under a ceiling only once', async () => {
+    // The ceilings are counted and the code stored in one transaction under one lock, so requests
+    // arriving together (on one API process or several) cannot all pass at the ceiling.
+    const capped = await createHarness({ config: { codeCaps: { globalPerHour: 3 } } });
+    try {
+      await capped.reset();
+      const answers = await Promise.all(
+        Array.from({ length: 8 }, (_, n) =>
+          capped.requestCode(`+92300000041${n}`, { ip: `198.51.100.${n + 20}` }),
+        ),
+      );
+      expect(answers.filter((r) => r.status === 202)).toHaveLength(3);
+      expect(answers.filter((r) => r.status === 429)).toHaveLength(5);
+      expect(await capped.db.select().from(schema.otpChallenges)).toHaveLength(3);
+      expect(capped.sender.sent).toHaveLength(3);
+      // One number asking twice at once gets one code: the resend wait is under the same lock.
+      await capped.reset();
+      const twice = await Promise.all([
+        capped.requestCode(PHONE_B, { ip: '198.51.100.40' }),
+        capped.requestCode(PHONE_B, { ip: '198.51.100.41' }),
+      ]);
+      expect(twice.map((r) => r.status).sort()).toEqual([202, 429]);
+    } finally {
+      await capped.close();
+    }
+  });
+
   it('stops all sends at the global daily ceiling', async () => {
     const capped = await createHarness({ config: { codeCaps: { globalPerDay: 2 } } });
     try {
```
