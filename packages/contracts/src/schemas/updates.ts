import { z } from 'zod';
import {
  InstantUtc,
  LocalizedInput,
  LocalizedLong,
  LocalizedLongInput,
  Localized,
  PageQuery,
  Uuid,
  pageOf,
} from '../common';
import { ScopeType, UpdateKind } from '../enums';
import { lazy } from '../lazy';

export const UpdateScope = lazy(() =>
  z.object({
    type: ScopeType,
    cityId: Uuid.nullable(),
    venueId: Uuid.nullable(),
  }),
);

export const Update = lazy(() =>
  z
    .object({
      id: Uuid,
      kind: UpdateKind,
      scope: UpdateScope,
      title: Localized,
      body: LocalizedLong,
      /** Set for time changes, cancellations and special lectures. Opens the session. */
      sessionId: Uuid.nullable(),
      publishedAt: InstantUtc,
      isRead: z.boolean(),
    })
    .meta({ id: 'Update' }),
);
export type Update = z.infer<typeof Update>;

export const FeedQuery = lazy(() =>
  PageQuery.extend({
    unreadOnly: z.stringbool().optional(),
    /** City to include city-level updates for when the person has none connected. */
    cityId: Uuid.optional(),
  }),
);
export const FeedResponse = lazy(() =>
  pageOf(Update).extend({ unreadCount: z.number().int().min(0) }),
);
export type FeedResponse = z.infer<typeof FeedResponse>;

export const UnreadCountResponse = lazy(() => z.object({ unreadCount: z.number().int().min(0) }));

export const MarkReadBody = lazy(() =>
  z.union([
    z.object({ updateIds: z.array(Uuid).min(1).max(100) }),
    z.object({ all: z.literal(true) }),
  ]),
);

export const PostUpdateBody = lazy(() =>
  z.object({
    scope: z.discriminatedUnion('type', [
      z.object({ type: z.literal('national') }),
      z.object({ type: z.literal('city'), cityId: Uuid }),
      z.object({ type: z.literal('venue'), venueId: Uuid }),
    ]),
    kind: UpdateKind.default('announcement'),
    title: LocalizedInput,
    body: LocalizedLongInput,
    sessionId: Uuid.optional(),
    /** Also send a push to the people in scope. WhatsApp is used only for critical changes. */
    notify: z.boolean().default(true),
    /** Pick an approved template instead of free text. */
    templateKey: z.string().optional(),
  }),
);
export type PostUpdateBody = z.infer<typeof PostUpdateBody>;

export const PostedUpdate = lazy(() =>
  Update.omit({ isRead: true }).extend({
    authorName: z.string().nullable(),
    recipients: z.number().int().min(0),
  }),
);
/** How many people an update would reach, before it is sent. */
export const UpdatePreview = lazy(() => z.object({ recipients: z.number().int().min(0) }));
export type UpdatePreview = z.infer<typeof UpdatePreview>;

export const AdminUpdatesQuery = lazy(() =>
  PageQuery.extend({
    cityId: Uuid.optional(),
    venueId: Uuid.optional(),
  }),
);
export const AdminUpdatesResponse = lazy(() => pageOf(PostedUpdate));
