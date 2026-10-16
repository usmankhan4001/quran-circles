# Translation key rules

Owned by the contracts lane. Keys live in `packages/i18n/src/en.json` and `ur.json`. Any lane adds its own keys, English and Urdu together, in the same pull request as the screen that uses them. Urdu values are drafts until a native speaker reviews them, and the `_meta.status` marker in `ur.json` stays.

## Structure

- Flat dotted keys: `<namespace>.<name>`, lower camel case after the namespace, for example `registration.partySize.label`.
- **One namespace per screen or feature:** `home`, `nearby`, `venue`, `session`, `registration`, `signIn`, `journey`, `quran`, `prayer`, `profile`, `updates`, `admin.registrants`, `admin.postUpdate`, `admin.schedule`, `admin.venueEditor`, `admin.circleEditor`, `admin.attendance`, `console.invites`, `console.import`, `console.exports`.
- **Shared namespaces:** `app` (name), `tabs`, `ui` (generic controls such as Close and Try again), `errors` (one key per API error code, `errors.<code>`, owned by the contracts lane), `facilities` (the venue checklist), `sections` (women, men, family), `days` (weekday names), `notifications` (push titles and bodies).
- A key names what the text is for, not the English words: `registration.submit`, not `registration.registerNow`.
- Never build a sentence by joining keys. One key per sentence, with placeholders.

## Placeholders

- `{name}` style, lower camel case: `"ui.unread": "{count} unread"`.
- Placeholders must be identical in English and Urdu, in any order the language needs.
- Numbers and dates are formatted by the app with the active locale before they are passed in. Never format inside a translation.

## Plurals

- Use `<key>.one` and `<key>.other` for text that changes with a count. Urdu uses the same two forms. The caller passes `count`.

## Error messages

- Every API error code `X` has `errors.X` in both languages. A contract test fails if one is missing.
- Plain words, no blame, say what to do next.

## Urdu

- Drafts carry the review marker. Do not remove it. Right-to-left and numeral rules are in `docs/design/` (ui lane).
- Keep product names the same in both languages: Quran Circles is `قرآن سرکلز`.

## Parity

`packages/i18n` tests fail when a key exists in one language and not the other, or when a value is empty.
