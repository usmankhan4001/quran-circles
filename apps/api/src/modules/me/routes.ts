import type { Handlers } from '../shared/route';
import {
  listBookmarks,
  createBookmark,
  deleteBookmark,
  getReadingPosition,
  importBookmarks,
  putReadingPosition,
} from './bookmarks';
import { cancelCircleRequest, createCircleRequest, listCircleRequests } from './circle-requests';
import { listConsents, setConsent } from './consents';
import { registerDevice, removeDevice } from './devices';
import { createFollow, deleteFollow, listFollows, updateFollow } from './follows';
import { deleteAccount, getMe, updateMe } from './profile';

export const meHandlers = (): Handlers => ({
  'me.get': (ctx) => getMe(ctx.db, ctx.uid()),
  'me.update': (ctx) => updateMe(ctx.db, ctx.uid(), ctx.body),
  'me.delete': async (ctx) => {
    await deleteAccount(ctx.db, ctx.uid(), ctx.now);
  },

  'consents.list': (ctx) => listConsents(ctx.db, ctx.uid()),
  'consents.set': (ctx) => setConsent(ctx.db, ctx.uid(), ctx.now, ctx.body),

  'follows.list': (ctx) => listFollows(ctx.db, ctx.uid()),
  'follows.create': (ctx) => createFollow(ctx.db, ctx.uid(), ctx.now, ctx.body),
  'follows.update': (ctx) =>
    updateFollow(ctx.db, ctx.uid(), ctx.now, ctx.params.followId, ctx.body.alertsEnabled),
  'follows.delete': async (ctx) => {
    await deleteFollow(ctx.db, ctx.uid(), ctx.now, ctx.params.followId);
  },

  'devices.register': (ctx) => registerDevice(ctx.db, ctx.uid(), ctx.now, ctx.body),
  'devices.remove': async (ctx) => {
    await removeDevice(ctx.db, ctx.uid(), ctx.params.deviceId);
  },

  'bookmarks.list': (ctx) => listBookmarks(ctx.db, ctx.uid()),
  'bookmarks.create': (ctx) => createBookmark(ctx.db, ctx.uid(), ctx.now, ctx.body),
  'bookmarks.delete': async (ctx) => {
    await deleteBookmark(ctx.db, ctx.uid(), ctx.params.bookmarkId);
  },
  'bookmarks.import': (ctx) => importBookmarks(ctx.db, ctx.uid(), ctx.now, ctx.body),
  'readingPosition.get': (ctx) => getReadingPosition(ctx.db, ctx.uid()),
  'readingPosition.put': (ctx) => putReadingPosition(ctx.db, ctx.uid(), ctx.now, ctx.body),

  'circleRequests.list': (ctx) => listCircleRequests(ctx.db, ctx.uid(), ctx.now),
  'circleRequests.create': (ctx) =>
    createCircleRequest(ctx.db, ctx.uid(), ctx.now, ctx.deps.config.circleRequestTtlDays, ctx.body),
  'circleRequests.cancel': (ctx) =>
    cancelCircleRequest(ctx.db, ctx.uid(), ctx.now, ctx.params.requestId),
});
