// The apps compile this file as part of their own programs; the reference carries the `*.ttf` and
// `*.otf` typings with it, which an import cannot do for a declarations-only file.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./font-assets.d.ts" />
/**
 * The font files the Expo apps bundle, grouped by family in the shape `expo-font`'s
 * `loadAsync` takes. Import it from `@qc/ui/font-sources`; it is a separate entry point because
 * it pulls in the font binaries, which the main entry and the console must not.
 *
 * - Plus Jakarta Sans (D17): the unmodified TTFs of `@expo-google-fonts/plus-jakarta-sans`
 *   (SIL OFL 1.1), only the weights the type roles use.
 * - Jameel Noori Nastaleeq (the full TTF, Urdu), Mehr Nastaliq Web (its fallback) and KFGQPC Uthmanic Script HAFS: the unmodified files in `assets/fonts`.
 *   The KFGQPC licence forbids changing the file, so it is never subset or converted.
 *
 * Licences, credits and checksums: `assets/fonts/LICENSES.md`.
 */
import jakarta400 from '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf';
import jakarta500 from '@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf';
import jakarta600 from '@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf';
import jakarta700 from '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf';
import jakarta800 from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf';
import jameelNoori from '../assets/fonts/JameelNooriNastaleeq-Regular.ttf';
import kfgqpcHafs from '../assets/fonts/KFGQPCUthmanicScriptHAFS-Regular.otf';
import mehrNastaliq from '../assets/fonts/MehrNastaliqWeb-Regular.ttf';
import { fonts, urduFallbackFont, type SansWeight } from './tokens';

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

const sansFiles: Record<SansWeight, FontAsset> = {
  '400': jakarta400,
  '500': jakarta500,
  '600': jakarta600,
  '700': jakarta700,
  '800': jakarta800,
};

export const bundledFonts: readonly BundledFontFamily[] = [
  {
    fontFamily: fonts.sans,
    fontDefinitions: (Object.keys(sansFiles) as SansWeight[]).map((weight) => ({
      path: sansFiles[weight],
      weight: Number(weight),
      style: 'normal',
    })),
  },
  {
    fontFamily: fonts.urdu,
    fontDefinitions: [{ path: jameelNoori, weight: 400, style: 'normal' }],
  },
  {
    fontFamily: urduFallbackFont,
    fontDefinitions: [{ path: mehrNastaliq, weight: 400, style: 'normal' }],
  },
  {
    fontFamily: fonts.quran,
    fontDefinitions: [{ path: kfgqpcHafs, weight: 400, style: 'normal' }],
  },
];

export { fontLoadTimeoutMs, loadFontsWithFallback, type FontLoadResult } from './font-loading';
