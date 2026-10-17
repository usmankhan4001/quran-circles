# Change request: accounts without a name yet

Requested by: auth-scopes
Contract: schema (`users`)
What I need: `users.display_name` to allow NULL, or a documented placeholder.
Why: the contract says `Me.displayName` can be null and that registration asks for the name "the first time, when the account has no name yet". Sign-in creates the account before any name is known, but `users.display_name` is `NOT NULL` with a non-blank check, so the account cannot be created without inventing a value.
Proposed change: make `display_name` nullable and keep the non-blank check for non-null values (`display_name IS NULL OR char_length(btrim(display_name)) > 0`). The reverse migration needs a backfill, so it should refuse to run while any row is NULL.
Affected lanes: contracts (db), api-core (anything that reads the name), auth-scopes.
Workaround meanwhile: new accounts get the one-character placeholder `-` (`UNNAMED_DISPLAY_NAME`, exported from the auth lane). `PersonName` needs two characters or more, so a real name can never equal it, and `loadMe` reports it as `null`. Other code that reads `users.display_name` directly (for example a coordinator's registrant list) should treat `-` as no name until this lands.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.

Applied in api 2026-10-17: new accounts get `display_name` null, `loadMe` returns null, and every reader treats null (and a legacy `-`) as no name.
