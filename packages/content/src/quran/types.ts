/**
 * One ayah as the reader shows it. The Arabic text and the Urdu translation come from the
 * online source at run time. Nothing in this repository holds them (see the rights section of
 * docs/agents/briefs/content.md).
 */
export interface QuranVerse {
  surah: number;
  /** The ayah number inside its surah. */
  ayah: number;
  arabic: string;
  /** Null when the translation was not available for this ayah. */
  urdu: string | null;
}

export type PassageKind = 'surah' | 'juz';

export interface PassageRef {
  kind: PassageKind;
  /** The surah number (1 to 114) or the juz number (1 to 30). */
  id: number;
}

export interface QuranPassage extends PassageRef {
  verses: QuranVerse[];
  /** True when the text came from the on-device cache and not from the network. */
  fromCache: boolean;
  /** True when the cached copy is older than its freshness window and could not be refreshed. */
  stale: boolean;
  /** When the text was fetched, as an ISO instant. */
  fetchedAt: string;
}

/** One ayah read on its own, for a card that shows a single ayah (Home's ayah of the day). */
export interface QuranAyah {
  verse: QuranVerse;
  /** True when the text came from the on-device cache and not from the network. */
  fromCache: boolean;
  /** True when the cached copy is older than its freshness window and could not be refreshed. */
  stale: boolean;
  /** When the text was fetched, as an ISO instant. */
  fetchedAt: string;
}

export type QuranSourceErrorCode =
  /** There is no connection, or the request failed. */
  | 'offline'
  /** The source answered with an error status. */
  | 'unavailable'
  /** The source answered with something we cannot read. */
  | 'invalid_response'
  /** The surah, juz or ayah does not exist. */
  | 'not_found';

export class QuranSourceError extends Error {
  constructor(
    readonly code: QuranSourceErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'QuranSourceError';
  }
}

export interface FetchOptions {
  signal?: AbortSignal;
}

/** Where ayah text comes from. The reader only knows this interface. */
export interface QuranSource {
  getSurah(surah: number, options?: FetchOptions): Promise<QuranPassage>;
  getJuz(juz: number, options?: FetchOptions): Promise<QuranPassage>;
  /**
   * One ayah, without fetching the whole surah. Like a passage's first verse, ayah 1 still
   * starts with the opening formula; `splitBismillah` cuts it off.
   */
  getAyah(surah: number, ayah: number, options?: FetchOptions): Promise<QuranAyah>;
}

/** A request that was cancelled on purpose. Not a failure to report. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}
