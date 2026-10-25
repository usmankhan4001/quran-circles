import { LOCALES, SECTIONS, type Locale, type Section } from '@qc/contracts';
import { textSizeSteps, type TextSizeStep } from '@qc/ui';
import { Observable } from './observable';
import { readJson, writeJson, type KeyValueStore } from './storage';

export const COLOR_PREFERENCES = ['system', 'light', 'dark', 'highContrast'] as const;
export type ColorPreference = (typeof COLOR_PREFERENCES)[number];

/** Per-person choices kept on the device. Nothing here is personal data. */
export interface Preferences {
  locale: Locale;
  textSize: TextSizeStep;
  color: ColorPreference;
  /** The city Nearby and Home look at. Null until the person or their profile picks one. */
  cityId: string | null;
  /** The area used to sort by distance, picked from our place list. */
  areaId: string | null;
  /** The section the person joins (women or men), asked once at sign up and kept on the device. */
  section: Section | null;
  /** True once the Welcome screen has been shown, so it is not shown again. */
  welcomed: boolean;
}

export const PREFERENCES_KEY = 'qc.preferences.v1';

/** Urdu if the phone's first language is Urdu, English otherwise. */
export function detectLocale(deviceLanguages: readonly string[]): Locale {
  const first = deviceLanguages[0]?.toLowerCase().split(/[-_]/)[0];
  return first === 'ur' ? 'ur' : 'en';
}

export function defaultPreferences(deviceLanguages: readonly string[] = []): Preferences {
  return {
    locale: detectLocale(deviceLanguages),
    textSize: 0,
    color: 'system',
    cityId: null,
    areaId: null,
    section: null,
    welcomed: false,
  };
}

function isPreferencesPatch(value: unknown): value is Partial<Preferences> {
  return typeof value === 'object' && value !== null;
}

/** Keeps only valid values, so an old or damaged file never breaks the app. */
export function sanitizePreferences(
  stored: Partial<Preferences>,
  fallback: Preferences,
): Preferences {
  const locale = LOCALES.find((l) => l === stored.locale) ?? fallback.locale;
  const textSize = textSizeSteps.find((s) => s === stored.textSize) ?? fallback.textSize;
  const color = COLOR_PREFERENCES.find((c) => c === stored.color) ?? fallback.color;
  const idOrNull = (v: unknown, fb: string | null) =>
    typeof v === 'string' && v.length > 0 && v.length < 64 ? v : v === null ? null : fb;
  return {
    locale,
    textSize,
    color,
    cityId: idOrNull(stored.cityId, fallback.cityId),
    areaId: idOrNull(stored.areaId, fallback.areaId),
    section:
      SECTIONS.find((s) => s === stored.section) ??
      (stored.section === null ? null : fallback.section),
    welcomed: typeof stored.welcomed === 'boolean' ? stored.welcomed : fallback.welcomed,
  };
}

export class PreferencesStore {
  private readonly state: Observable<Preferences>;

  constructor(
    private readonly storage: KeyValueStore,
    private readonly fallback: Preferences = defaultPreferences(),
  ) {
    this.state = new Observable(fallback);
  }

  get = (): Preferences => this.state.get();
  subscribe = (listener: () => void): (() => void) => this.state.subscribe(listener);

  async load(): Promise<Preferences> {
    const stored = await readJson(this.storage, PREFERENCES_KEY, isPreferencesPatch);
    if (stored) this.state.set(sanitizePreferences(stored, this.fallback));
    return this.state.get();
  }

  async update(change: Partial<Preferences>): Promise<void> {
    const next = sanitizePreferences({ ...this.state.get(), ...change }, this.state.get());
    this.state.set(next);
    await writeJson(this.storage, PREFERENCES_KEY, next);
  }
}
