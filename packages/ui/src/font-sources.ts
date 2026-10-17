// The apps compile this file as part of their own programs; the reference carries the `*.ttf` and
// `*.otf` typings with it, which an import cannot do for a declarations-only file.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./font-assets.d.ts" />
/**
 * The font files the Expo apps bundle, grouped by family in the shape `expo-font`'s
 * `loadAsync` takes. Import it from `@qc/ui/font-sources`; it is a separate entry point because
 * it pulls in the font binaries, which the main entry and the console must not.
 *
 * - Figtree: the unmodified TTFs of `@expo-google-fonts/figtree` (SIL OFL 1.1), only the weights
 *   the type roles use.
 * - Mehr Nastaliq Web and KFGQPC Uthmanic Script HAFS: the unmodified files in `assets/fonts`.
 *   The KFGQPC licence forbids changing the file, so it is never subset or converted.
 *
 * Licences, credits and checksums: `assets/fonts/LICENSES.md`.
 */
import figtree400 from '@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf';
import figtree500 from '@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf';
import figtree600 from '@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf';
import figtree700 from '@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf';
import figtree800 from '@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf';
import kfgqpcHafs from '../assets/fonts/KFGQPCUthmanicScriptHAFS-Regular.otf';
import mehrNastaliq from '../assets/fonts/MehrNastaliqWeb-Regular.ttf';
import { fonts, type SansWeight } from './tokens';

/** A bundled font file: a Metro module id on iOS and Android, a URL on the web. */
export type FontAsset = number | string;

export interface BundledFontFace {
  path: FontAsset;
  weight: number;
  style: 'normal';
}

export interface BundledFontFamily {
  /** The family name, the same as the `fonts` token, used as `fontFamily`. */
  fontFamily: string;
  fontDefinitions: BundledFontFace[];
}

const figtreeFiles: Record<SansWeight, FontAsset> = {
  '400': figtree400,
  '500': figtree500,
  '600': figtree600,
  '700': figtree700,
  '800': figtree800,
};

export const bundledFonts: readonly BundledFontFamily[] = [
  {
    fontFamily: fonts.sans,
    fontDefinitions: (Object.keys(figtreeFiles) as SansWeight[]).map((weight) => ({
      path: figtreeFiles[weight],
      weight: Number(weight),
      style: 'normal',
    })),
  },
  {
    fontFamily: fonts.urdu,
    fontDefinitions: [{ path: mehrNastaliq, weight: 400, style: 'normal' }],
  },
  {
    fontFamily: fonts.quran,
    fontDefinitions: [{ path: kfgqpcHafs, weight: 400, style: 'normal' }],
  },
];

/** How long an app waits for the fonts before it draws anyway, with fallback fonts. */
export const fontLoadTimeoutMs = 3000;

export type FontLoadResult = 'loaded' | 'failed' | 'timedOut';

/**
 * Runs a font loader (in the apps, `expo-font`'s `loadAsync` with `bundledFonts`) but never
 * blocks for longer than `timeoutMs` and never rejects: a font that fails or is slow falls back
 * to the next font in the stack (web) or the system font (iOS, Android).
 */
export function loadFontsWithFallback(
  load: () => Promise<unknown>,
  timeoutMs: number = fontLoadTimeoutMs,
): Promise<FontLoadResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: FontLoadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish('timedOut'), timeoutMs);
    try {
      load().then(
        () => finish('loaded'),
        () => finish('failed'),
      );
    } catch {
      finish('failed');
    }
  });
}
