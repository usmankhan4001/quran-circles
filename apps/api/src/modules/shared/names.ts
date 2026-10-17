/**
 * `users.display_name` is NULL until registration asks for the name (migration 0008). Accounts
 * created before 0008 carry a one-character dash instead; nothing writes it any more, but readers
 * still treat it as "no name" so it never shows up as somebody's name. A real name (`PersonName`)
 * has two characters or more, so it can never be the dash.
 */
const LEGACY_PLACEHOLDER = '-';

export const isNameMissing = (displayName: string | null | undefined): boolean =>
  !displayName || displayName.trim() === '' || displayName.trim() === LEGACY_PLACEHOLDER;

/** The name to show, or null when the account has none yet. */
export const visibleName = (displayName: string | null | undefined): string | null =>
  isNameMissing(displayName) ? null : (displayName as string).trim();
