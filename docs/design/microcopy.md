# Microcopy: rules and review

The ui lane reviews the wording of English text and Urdu drafts in `packages/i18n/` (`docs/agents/briefs/ui.md`, item 10). Urdu stays marked as a draft (`_meta.status` in each `src/ur/*.json` part) until a native speaker reviews it.

## Rules

1. **Plain.** Short sentences (under about 15 words). Common words. Say it the way you would to a neighbour.
2. **What happened, then what to do.** "We could not load this. Please try again."
3. **No blame, no panic.** Not "Invalid input", "Error 500", "You failed". No exclamation marks, no capitals for emphasis.
4. **Verbs on buttons.** Register, Send code, Save, Try again, Cancel registration. Pairs for a confirmation say what happens on each side: "Yes, cancel" and "Keep it", not "OK" and "Cancel".
5. **One word per thing**, in both languages:

   | Thing                          | English     | Urdu draft | Avoid                              |
   | ------------------------------ | ----------- | ---------- | ---------------------------------- |
   | A class time                   | session     | نشست       | event, occurrence, class, اجتماع   |
   | A regular class with a teacher | circle      | سرکل       | halqa, group, حلقہ                 |
   | A place                        | venue       | مقام       | location, masjid (unless the name) |
   | Staff                          | coordinator | کوآرڈینیٹر | admin, manager, organiser          |
   | Sign-up                        | register    | رجسٹر کریں | book, enrol, sign up               |
   | Follow                         | follow      | فالو کریں  | subscribe, watch                   |
   | Area                           | area        | علاقہ      | locality, zone                     |
   | Alerts                         | alerts      | اطلاعات    | notifications (in screens)         |

6. **Placeholders, never joined strings.** `"Every {day} at {time}"`. Plural forms are `key.one` and `key.other`. Numbers and dates are formatted by the app before they are passed in.
7. **Sentence case.** "Request a circle near me", not "Request A Circle Near Me".
8. **Numbers.** Western digits in both languages (`docs/design/rtl-urdu-guide.md`).
9. **Confirmations are for the irreversible only.** Cancel registration, delete account, send to many people, archive.
10. **Respectful forms of address in Urdu:** the polite "آپ", and "براہ کرم" before a request. No slang, no English words where a common Urdu word exists, except product names and terms people already say in English (WhatsApp, SMS, PDF, CSV).
11. **Do not translate Quran Circles.** It is `قرآن سرکلز` in Urdu.

## What was added

For the P0 screens, 372 keys were added to `packages/i18n` in these namespaces: `sections`, `days`, `facilities`, `home`, `prayer`, `nearby`, `venue`, `session`, `registration`, `journey`, `quran`, `profile`, `admin.registrants`, `admin.postUpdate`, `admin.schedule`, `admin.venueEditor`, `admin.circleEditor`, `admin.attendance`, `console.invites`, `console.import`, `console.exports`, plus 17 `ui.*` keys used by the kit. Every key is named in a screen spec in `docs/design/screens/`. English and Urdu were added together; every Urdu value is a draft.

## Review of the existing wording

Reviewed on 2026-10-16: `app.*`, `tabs.*`, `profile.title` and `errors.*` (written by the contracts lane). Values were not edited; the contracts lane owns `errors.*`. These are the findings.

| Key                            | Finding                                                                                                     | Suggested English                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `tabs.*`                       | Decided. Fine.                                                                                              | Keep. Native speaker checks the Urdu.                                    |
| `errors.conflict`              | "clashes with something that already exists" is vague; "refresh" is web wording.                            | "Someone changed this just now. Go back, open it again and try again."   |
| `errors.validation_failed`     | Says nothing about which detail. The form should show a field message too.                                  | Keep as the fallback. Forms show the specific message next to the field. |
| `errors.role_already_assigned` | "role" is jargon.                                                                                           | "This person is already a coordinator here."                             |
| `errors.last_national_admin`   | "national admin" is internal; fine for the console only.                                                    | "There must always be at least one national admin." Keep, console only.  |
| `errors.session_full`          | Good. Add the next step in the screen: offer the waiting list.                                              | Keep. Screen adds "Join the waiting list".                               |
| `errors.occurrence_in_past`    | "occurrence" is not used in the text, good.                                                                 | Keep.                                                                    |
| `errors.circle_not_pending`    | Console wording.                                                                                            | Keep.                                                                    |
| `errors.account_suspended`     | Fine; "not active" may confuse. Say who to ask.                                                             | "This account cannot be used right now. Please contact support."         |
| `errors.token_expired`         | Fine.                                                                                                       | Keep.                                                                    |
| `errors.internal_error`        | "on our side" is clear. Fine.                                                                               | Keep.                                                                    |
| Urdu `errors.*`                | Uses نشست for session and سرکل for circle (matches this guide). "سائن اِن" is read the same way as English. | Native speaker decides between "سائن اِن" and "لاگ اِن".                 |

Words the native reviewer must decide, because they shape every screen:

1. Session: نشست (used now) or اجتماع or ملاقات.
2. Circle: سرکل (used now, matches the app name) or حلقہ.
3. Follow: فالو کریں (used now) or اس کی اطلاع لیں.
4. Coordinator: کوآرڈینیٹر (used now) or منتظم.
5. Sign in: سائن اِن (used now) or لاگ اِن.
6. Wudu: وضو. Women's section: خواتین کا حصہ.
7. Digits: Western (proposed) or Eastern Arabic.
