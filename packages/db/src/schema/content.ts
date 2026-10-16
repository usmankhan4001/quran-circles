import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { CONTENT_STATUSES, LOCALES, POSTER_FORMATS, POSTER_STATUSES } from '@qc/contracts';
import { createdAt, enumArrayCheck, enumCheck, pk, rawCheck, tstz, updatedAt } from './_helpers';
import { users } from './people';
import { sessions } from './programs';

/** Locked poster layouts. Coordinators fill fields; they never edit the layout. */
export const posterTemplates = pgTable(
  'poster_templates',
  {
    id: pk(),
    key: text('key').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
    version: integer('version').notNull().default(1),
    formats: text('formats').array().notNull(),
    fieldsSchema: jsonb('fields_schema')
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
  },
  () => [
    enumArrayCheck('poster_templates', 'formats', POSTER_FORMATS),
    rawCheck('poster_templates_formats_nonempty_chk', 'cardinality("formats") > 0'),
    rawCheck('poster_templates_version_chk', '"version" >= 1'),
  ],
);

/** A generated poster, with the session details it was made from. */
export const posters = pgTable(
  'posters',
  {
    id: pk(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => posterTemplates.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    format: text('format', { enum: POSTER_FORMATS }).notNull(),
    locale: text('locale', { enum: LOCALES }).notNull(),
    fields: jsonb('fields')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Session details at creation time, so the console can flag the poster as out of date. */
    sourceSnapshot: jsonb('source_snapshot').notNull(),
    storageKey: text('storage_key'),
    status: text('status', { enum: POSTER_STATUSES }).notNull().default('queued'),
    createdAt: createdAt(),
  },
  (t) => [
    index('posters_session_idx').on(t.sessionId),
    enumCheck('posters', 'format', POSTER_FORMATS),
    enumCheck('posters', 'locale', LOCALES),
    enumCheck('posters', 'status', POSTER_STATUSES),
  ],
);

export const contentPages = pgTable(
  'content_pages',
  {
    id: pk(),
    slug: text('slug').notNull().unique(),
    titleEn: text('title_en').notNull(),
    titleUr: text('title_ur'),
    bodyEn: text('body_en').notNull(),
    bodyUr: text('body_ur'),
    status: text('status', { enum: CONTENT_STATUSES }).notNull().default('draft'),
    publishedAt: tstz('published_at'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  () => [enumCheck('content_pages', 'status', CONTENT_STATUSES)],
);

export type PosterTemplateRow = typeof posterTemplates.$inferSelect;
export type NewPosterTemplateRow = typeof posterTemplates.$inferInsert;
export type PosterRow = typeof posters.$inferSelect;
export type NewPosterRow = typeof posters.$inferInsert;
export type ContentPageRow = typeof contentPages.$inferSelect;
export type NewContentPageRow = typeof contentPages.$inferInsert;
