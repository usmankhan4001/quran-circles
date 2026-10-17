# Change request: shared home for the V1 bookmark import mapping

Requested by: data-migration
Contract: `@qc/contracts` (`BookmarkImport`) or a new shared package
What I need: a place apps may import the pure function that maps V1 local bookmarks to the contract's `BookmarkImport` shape.
Why: the user app reads V1 bookmarks from device storage and sends them to the API. Apps cannot import from `tools/`, so the helper cannot be used where it is needed. It has no I/O and no dependencies beyond `@qc/contracts`.
Proposed change: move `mapV1Bookmarks` and its ayah-count table (`tools/migration/src/bookmarks.ts`) into `packages/contracts` (for example `@qc/contracts/bookmarks`), keeping its tests. This lane then re-exports it.
Affected lanes: contracts, user-app.
Workaround meanwhile: it is exported from `@qc/migration/bookmarks`. The user-app lane can copy it or wait for the move.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.
