/**
 * Right-to-left helpers. See docs/design/rtl-urdu-guide.md.
 *
 * The rule: components never write `left`, `right`, `marginLeft`, `paddingRight` and so on.
 * They use `flexDirection: 'row'` and the logical `*Start` and `*End` properties, and the
 * `direction` style set by ThemeProvider mirrors the layout. The few places that need a
 * physical side (text alignment, icon mirroring) go through the helpers in this file.
 */
export type Direction = 'ltr' | 'rtl';
export type Locale = 'en' | 'ur';
export const locales: readonly Locale[] = ['en', 'ur'];
export const directions: readonly Direction[] = ['ltr', 'rtl'];

const rtlLocales: ReadonlySet<string> = new Set(['ur', 'ar', 'fa', 'he']);

/** Urdu is right-to-left, English is left-to-right. */
export function directionForLocale(locale: string): Direction {
  return rtlLocales.has(locale.toLowerCase().split('-')[0] ?? '') ? 'rtl' : 'ltr';
}

export function isRtl(direction: Direction): boolean {
  return direction === 'rtl';
}

/** The physical side that is the "start" of a line. */
export function startSide(direction: Direction): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

/** The physical side that is the "end" of a line. */
export function endSide(direction: Direction): 'left' | 'right' {
  return direction === 'rtl' ? 'left' : 'right';
}

/** Text alignment for the start of a line. React Native has no logical text alignment. */
export function textAlignStart(direction: Direction): 'left' | 'right' {
  return startSide(direction);
}

/**
 * Icons that point somewhere, or show reading order, mirror in right-to-left.
 * Icons that depict objects or fixed concepts do not: check, close, plus, clock, search,
 * phone, bell, heart, star, home, person, calendar, map pin, play and pause, download.
 */
export const flippingIcons: ReadonlySet<string> = new Set([
  'chevron-forward',
  'chevron-back',
  'arrow-forward',
  'arrow-back',
  // Phosphor names (D17)
  'caret-right',
  'caret-left',
  'arrow-right',
  'arrow-left',
  'arrow-up-right',
  'paper-plane-tilt',
  'back',
  'forward',
  'next',
  'previous',
  'send',
  'reply',
  'undo',
  'redo',
  'list-bullets',
  'sign-in',
  'sign-out',
  'external-link',
]);

export function shouldFlipIcon(name: string, direction: Direction): boolean {
  return direction === 'rtl' && flippingIcons.has(name);
}

/** The transform to apply to an icon so it reads correctly in the given direction. */
export function iconFlipTransform(
  name: string,
  direction: Direction,
): { transform: [{ scaleX: -1 }] } | undefined {
  return shouldFlipIcon(name, direction) ? { transform: [{ scaleX: -1 }] } : undefined;
}

const LRM = '‎';
const RLM = '‏';
const FSI = '⁨';
const PDI = '⁩';

/**
 * Wraps a run of text of unknown direction (a person's name, a phone number, a venue name in
 * English inside an Urdu sentence) in first-strong isolates, so it cannot reorder the text
 * around it.
 */
export function isolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}

/** Forces a left-to-right run, for things that are always left-to-right such as phone numbers. */
export function ltrRun(text: string): string {
  return `${LRM}${text}${LRM}`;
}

/** Marks the end of a right-to-left run, for trailing punctuation next to Latin text. */
export function rtlMark(): string {
  return RLM;
}
