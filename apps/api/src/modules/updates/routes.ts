import { updatePostAction } from '@qc/contracts';
import type { Handlers } from '../shared/route';
import { messagingDepsOf } from '../shared/context';
import { getFeed, markRead, unreadCount } from './feed';
import { listApprovedTemplates, listPostedUpdates, postUpdate, resolvePostScope } from './admin';

export const updateHandlers = (): Handlers => ({
  'updates.feed': (ctx) => getFeed(ctx.db, ctx.now, ctx.uid(), ctx.query),
  'updates.unreadCount': async (ctx) => ({
    unreadCount: await unreadCount(ctx.db, ctx.now, ctx.uid()),
  }),
  'updates.markRead': (ctx) => markRead(ctx.db, ctx.now, ctx.uid(), ctx.body),

  'adminUpdates.post': async (ctx) => {
    const action = updatePostAction(ctx.body.scope.type);
    const scope = await resolvePostScope(ctx.db, ctx.body.scope);
    if (!scope) return ctx.unknownRef(action, 'scope');
    ctx.authorize(action, scope.resource);
    return postUpdate(ctx.db, messagingDepsOf(ctx.deps, ctx.now), ctx.uid(), scope, ctx.body);
  },
  'adminUpdates.list': (ctx) =>
    listPostedUpdates(ctx.db, ctx.scope('update.list_admin'), ctx.query),
  'adminTemplates.list': async (ctx) => {
    ctx.scope('template.read');
    return listApprovedTemplates(ctx.db);
  },
});
