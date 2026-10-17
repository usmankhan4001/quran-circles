/**
 * The V1 bookmark mapper moved to `@qc/contracts/bookmarks` so apps can use it (apps cannot
 * import from `tools/`). This file re-exports it, so `@qc/migration/bookmarks` keeps working.
 * Its tests live in `packages/contracts/src/bookmarks.test.ts`.
 */
export {
  AYAH_COUNTS,
  MAX_IMPORT_ITEMS,
  V1_BOOKMARKS_KEY,
  mapV1Bookmarks,
  type AyahBookmarkInput,
  type V1BookmarkImport,
} from '@qc/contracts/bookmarks';
