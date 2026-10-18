import { describe, expect, it } from 'vitest';
import * as all from './index';
import * as meta from './meta';
import * as prayer from './prayer';
import * as storage from './storage';
import * as home from './ui/home';
import * as screens from './ui/screens';
import pkg from '../package.json';

const subpaths = { meta, prayer, storage, home, screens } as const;

describe('subpath exports', () => {
  it.each(Object.entries(subpaths))(
    '`@qc/content/%s` is part of the main entry, value for value',
    (_name, mod) => {
      const names = Object.keys(mod);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect((all as Record<string, unknown>)[name], name).toBe(
          (mod as Record<string, unknown>)[name],
        );
      }
    },
  );

  it('together cover the main entry', () => {
    const covered = new Set(Object.values(subpaths).flatMap((mod) => Object.keys(mod)));
    const rest = Object.keys(all).filter((name) => !covered.has(name));
    // The Quran source, its cache and settings, bookmarks, the reading position and the saved
    // view are only in the main entry; the services in `/home` build them.
    expect(rest.sort()).toEqual(
      [
        'ALQURAN_CLOUD_BASE_URL',
        'ARABIC_ZOOM_STEPS',
        'CACHE_FRESH_MS',
        'CACHE_MAX_PASSAGES',
        'DEFAULT_ARABIC_ZOOM_INDEX',
        'DEFAULT_EDITIONS',
        'DEFAULT_READER_PREFS',
        'DEFAULT_VIEW_STATE',
        'IMPORT_MAX_ITEMS',
        'QuranSourceError',
        'V1_KEYS',
        'arabicZoom',
        'clampZoomIndex',
        'createAlQuranCloudSource',
        'createBookmarkService',
        'createCachedQuranSource',
        'createReaderPrefsStore',
        'createReadingPositionService',
        'createV1Importer',
        'createViewStateStore',
        'isAbortError',
        'mapV1Bookmarks',
        'mapV1LastRead',
        'passageBismillah',
        'readV1',
        'splitBismillah',
        'summariseV1',
        'zoomIndexFromV1Rem',
      ].sort(),
    );
  });

  it('are listed in package.json', () => {
    expect(pkg.exports).toEqual({
      '.': './src/index.ts',
      './meta': './src/meta/index.ts',
      './prayer': './src/prayer/index.ts',
      './storage': './src/storage/index.ts',
      './home': './src/ui/home.ts',
      './screens': './src/ui/screens.ts',
    });
  });

  it('keep the screens out of `/home`', () => {
    for (const screen of Object.keys(screens)) expect(Object.keys(home)).not.toContain(screen);
  });
});
