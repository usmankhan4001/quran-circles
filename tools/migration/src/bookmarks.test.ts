import * as contracts from '@qc/contracts/bookmarks';
import { describe, expect, it } from 'vitest';
import * as migration from './bookmarks';

// The mapper and its tests moved to @qc/contracts/bookmarks; this only checks the re-export.
describe('bookmarks re-export', () => {
  it('is the same mapper and table as @qc/contracts/bookmarks', () => {
    expect(migration.mapV1Bookmarks).toBe(contracts.mapV1Bookmarks);
    expect(migration.AYAH_COUNTS).toBe(contracts.AYAH_COUNTS);
    expect(migration.MAX_IMPORT_ITEMS).toBe(500);
    expect(migration.V1_BOOKMARKS_KEY).toBe('quran_bookmarks');
    expect(migration.mapV1Bookmarks('["2:255"]').payload.items).toEqual([
      { kind: 'ayah', surah: 2, ayah: 255 },
    ]);
  });
});
