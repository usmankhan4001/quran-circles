# Translation key rules

Owned by the contracts lane. Keys live in `packages/i18n/src/en/<part>.json` and `packages/i18n/src/ur/<part>.json` (see "Where a key goes" below). Any lane adds its own keys, English and Urdu together, in the same pull request as the screen that uses them. Urdu values are drafts until a native speaker reviews them, and the `_meta.status` marker in every `src/ur/*.json` file stays.

## Where a key goes

The catalogue is split into four parts so each app downloads only its own words, one language at a time. A key goes in the part for its namespace (the text before the first dot), in the same file name under both `src/en/` and `src/ur/`:

| Part        | Files                                            | Namespaces                                                                                                                                |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`    | `src/en/shared.json`, `src/ur/shared.json`       | `app`, `ui`, `errors`, `issues`, `time` (used by `@qc/ui` and every app)                                                                  |
| `admin-app` | `src/en/admin-app.json`, `src/ur/admin-app.json` | `admin.*`                                                                                                                                 |
| `console`   | `src/en/console.json`, `src/ur/console.json`     | `console.*`                                                                                                                               |
| `user-app`  | `src/en/user-app.json`, `src/ur/user-app.json`   | everything else, including the server's own wording (`notifications`, `reminders`, `poster`) and `tabs`, `facilities`, `sections`, `days` |

`partOf(key)` in `packages/i18n/src/catalogue.ts` is the rule; this table only restates it. `packages/i18n/src/parts.test.ts` fails when a key sits in the wrong part. There is no `src/en.json` or `src/ur.json` any more: a branch that adds keys there must move them to the right part.

## Structure

- Flat dotted keys: `<namespace>.<name>`, lower camel case after the namespace, for example `registration.partySize.label`.
- **One namespace per screen or feature:** `home`, `nearby`, `venue`, `session`, `registration`, `signIn`, `journey`, `quran`, `prayer`, `profile`, `updates`, `admin.registrants`, `admin.postUpdate`, `admin.schedule`, `admin.venueEditor`, `admin.circleEditor`, `admin.attendance`, `console.invites`, `console.import`, `console.exports`, `admin.posters` and `console.posters` (the poster screens: template picker, out-of-date band, Regenerate).
- **Shared namespaces:** `app` (name), `tabs`, `ui` (generic controls such as Close and Try again), `errors` (one key per API error code, `errors.<code>`, owned by the contracts lane), `issues` (one key per worded issue code, `issues.<code>`, owned by the contracts lane: the server's own validation issue codes that the apps explain in words wherever they appear, listed in `WORDED_ISSUE_CODES` in `packages/contracts/src/errors.ts`, key from `issueMessageKey`; today `issues.phone_not_pakistan_mobile` and `issues.invite_daily_limit`), `facilities` (the venue checklist), `sections` (women, men, family), `days` (weekday names), `time` (parts of the day for times: `time.period.lateNight|morning|noon|evening|night`, with the hour bands 00–03, 04–11, 12–15, 16–18 and 19–23 in `timePeriodKey` in `@qc/i18n`; an Urdu time is the period word, then the figures, `رات 9:00`), `notifications` (push titles and bodies), `poster` (text printed on posters and their alt text, drawn by the renderer; contract 1.0.0-rc.5).
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
- Every worded issue code `Y` (`WORDED_ISSUE_CODES`) has `issues.Y` in both languages, also checked by a contract test. A screen shows it for a `validation_failed` answer whose `issues` carry that code, in place of the general `errors.validation_failed`.
- Plain words, no blame, say what to do next.

## Urdu

- Drafts carry the review marker. Do not remove it. Right-to-left and numeral rules are in `docs/design/` (ui lane).
- Keep product names the same in both languages: Quran Circles is `قرآن سرکلز`.

## Parity

`packages/i18n` tests fail when a key exists in one language and not the other, when a value is empty, or when a key is not in the part `partOf` names (`src/parts.test.ts`).
