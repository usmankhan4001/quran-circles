/**
 * A new account may have no name yet. The sign-in lane stores a placeholder (a single dash) because
 * the column cannot be empty; the registration form asks for the real name the first time.
 */
export const NAME_PLACEHOLDER = '-';

export const isNameMissing = (displayName: string | null | undefined): boolean =>
  !displayName || displayName.trim() === '' || displayName.trim() === NAME_PLACEHOLDER;

/** The name to show, or null when the account has none yet. */
export const visibleName = (displayName: string | null | undefined): string | null =>
  isNameMissing(displayName) ? null : (displayName as string).trim();
