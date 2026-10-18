import { roleAssignAction } from '@qc/contracts';
import { inviteDepsOf } from '../shared/context';
import type { Handlers } from '../shared/route';
import {
  assignRole,
  createInvite,
  findAssignment,
  findInvite,
  listAssignments,
  listInvites,
  resolveRoleTarget,
  revokeAssignment,
  revokeInvite,
  targetOfRow,
} from './service';

export const roleHandlers = (): Handlers => ({
  'adminRoles.invite': async (ctx) => {
    const action = roleAssignAction(ctx.body.role);
    const target = await resolveRoleTarget(ctx.db, ctx.body);
    if (!target) return ctx.unknownRef(action);
    ctx.authorize(action, target.resource);
    return createInvite(ctx.db, inviteDepsOf(ctx.deps, ctx.now), ctx.uid(), target, ctx.body);
  },

  'adminRoles.invites': (ctx) => listInvites(ctx.db, ctx.now, ctx.scope('role.list')),

  'adminRoles.revokeInvite': async (ctx) => {
    const invite = await findInvite(ctx.db, ctx.params.inviteId);
    const target = invite ? await targetOfRow(ctx.db, invite) : null;
    if (!invite || !target) return ctx.missing('role.assign_venue_coordinator');
    ctx.authorize(roleAssignAction(invite.role), target.resource);
    await revokeInvite(ctx.db, ctx.now, ctx.uid(), invite, target);
  },

  'adminRoles.list': (ctx) => listAssignments(ctx.db, ctx.scope('role.list'), ctx.query),

  'adminRoles.assign': async (ctx) => {
    const action = roleAssignAction(ctx.body.role);
    const target = await resolveRoleTarget(ctx.db, ctx.body);
    if (!target) return ctx.unknownRef(action);
    ctx.authorize(action, target.resource);
    return assignRole(ctx.db, ctx.now, ctx.uid(), target, ctx.body);
  },

  'adminRoles.revoke': async (ctx) => {
    const found = await findAssignment(ctx.db, ctx.params.assignmentId);
    const target = found ? await targetOfRow(ctx.db, found.a) : null;
    if (!found || !target) return ctx.missing('role.assign_venue_coordinator');
    ctx.authorize(roleAssignAction(found.a.role), target.resource);
    await revokeAssignment(ctx.db, ctx.now, ctx.uid(), found.a, target);
  },
});
