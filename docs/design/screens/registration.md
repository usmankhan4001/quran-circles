# Screen: Registration, with the code step

App: User app (opens from the venue and session page). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Register for a session in as few steps as possible. Required: name, a WhatsApp number that is verified, area, section and party size (`docs/product/decisions.md`). Nothing else is asked here; the optional profile questions are asked later in Profile. A person who is already signed in skips the number and code steps.

## Layout

A single form in two steps. A `Header` with a back button and "Register"; under it a plain "Step 1 of 2" line (text, not a progress bar). The session's name and time sit in a `Card` at the top of both steps so the person never forgets what they are registering for.

**Step 1: Your details** (one column, labels above fields, 16 dp between fields):

1. `TextField` Full name (required).
2. `TextField` WhatsApp number (required), keyboard `phone-pad`, left to right, with helper text "We send a code to this number on WhatsApp."
3. `Select` Your area (required), list from our place list.
4. `SegmentedControl` Section: Women | Men | Family (required). Only the sections the session allows are shown.
5. Party size: "How many people are coming?" with a stepper made of two `IconButton`s (minus, plus) around a large number; helper "Count yourself too." Minimum 1; maximum from the session.
6. `Switch` "Send me reminders on WhatsApp" with helper "You can change this any time in Profile." Off by default; consent is recorded.
7. Large primary `Button` "Send code" (full width, pinned at the bottom above the keyboard).

**Step 2: The code**:

1. Title "Enter the code" and text "We sent a 6-digit code to {phone} on WhatsApp." The number is shown in full to the person themselves.
2. `TextField` "6-digit code", `number-pad`, auto-fills from the clipboard or SMS where the platform allows, 6 characters, centred large text.
3. Primary `Button` "Confirm" (large). Secondary: "Send the code again" (disabled with "Send again in {seconds} seconds" for 30 seconds), tertiary "Use a different number".

**Done**: a full page: success icon, "You are registered" (or "You are on the waiting list"), "We will remind you before the session.", the session summary, and two buttons: "See it in My Journey" (primary) and "Done" (tertiary). A `Toast` is not used here; the page is the confirmation.

## States

| State                | What the person sees                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading              | Buttons show the busy state while sending the code and while confirming; fields become read only. The page is never replaced by a spinner.                                                     |
| Field errors         | Each field has its own message under it and the first invalid field gets focus: "Enter your name.", "Enter a mobile number we can use.", "Choose your area.".                                  |
| Wrong code           | Message on the code field using `errors.otp_invalid`; the field keeps the digits and is selected for retyping. Three wrong codes: `errors.otp_too_many_attempts` and the confirm button waits. |
| Expired code         | `errors.otp_expired` with the "Send the code again" button focused.                                                                                                                            |
| Already registered   | `errors.already_registered` on a calm page with a button to My Journey. Not shown as a failure.                                                                                                |
| Full or closed       | `errors.session_full` leads to "Join the waiting list" in place of Register; `errors.registration_closed` and `errors.session_cancelled` show a message and return to the session page.        |
| Rate limited         | `errors.rate_limited` under the button; the button waits.                                                                                                                                      |
| Offline              | Step 1 can be filled in; "Send code" is disabled with "You are offline" next to it. Nothing is lost when the connection returns.                                                               |
| Waiting list success | Done page uses "You are on the waiting list" and "We will tell you if a seat opens.".                                                                                                          |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                               | English                                        | Used for                                         |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `registration.title`              | Register                                       | Header                                           |
| `registration.step`               | Step {current} of {total}                      | Step line                                        |
| `registration.name.label`         | Full name                                      | Name field                                       |
| `registration.name.error`         | Enter your name.                               | Name error                                       |
| `registration.phone.label`        | WhatsApp number                                | Number field                                     |
| `registration.phone.help`         | We send a code to this number on WhatsApp.     | Number helper                                    |
| `registration.phone.error`        | Enter a mobile number we can use.              | Number error                                     |
| `registration.area.label`         | Your area                                      | Area select                                      |
| `registration.area.placeholder`   | Choose your area                               | Area placeholder                                 |
| `registration.area.error`         | Choose your area.                              | Area error                                       |
| `registration.section.label`      | Section                                        | Section control name                             |
| `registration.partySize.label`    | How many people are coming?                    | Party size question                              |
| `registration.partySize.help`     | Count yourself too.                            | Party size helper                                |
| `registration.partySize.decrease` | Fewer people                                   | Minus button name                                |
| `registration.partySize.increase` | More people                                    | Plus button name                                 |
| `registration.consent.whatsapp`   | Send me reminders on WhatsApp                  | WhatsApp reminders switch                        |
| `registration.consent.help`       | You can change this any time in Profile.       | Switch helper                                    |
| `registration.sendCode`           | Send code                                      | Step 1 button                                    |
| `registration.code.title`         | Enter the code                                 | Step 2 title                                     |
| `registration.code.body`          | We sent a 6-digit code to {phone} on WhatsApp. | Step 2 text                                      |
| `registration.code.label`         | 6-digit code                                   | Code field                                       |
| `registration.code.confirm`       | Confirm                                        | Confirm button                                   |
| `registration.code.resend`        | Send the code again                            | Resend button                                    |
| `registration.code.resendIn`      | Send again in {seconds} seconds                | Resend wait text                                 |
| `registration.code.changeNumber`  | Use a different number                         | Change number button                             |
| `registration.success.title`      | You are registered                             | Done title                                       |
| `registration.success.body`       | We will remind you before the session.         | Done text                                        |
| `registration.waitlist.title`     | You are on the waiting list                    | Waiting list title                               |
| `registration.waitlist.body`      | We will tell you if a seat opens.              | Waiting list text                                |
| `registration.success.journey`    | See it in My Journey                           | Done primary button                              |
| `registration.success.done`       | Done                                           | Done tertiary button                             |
| `registration.submit`             | Register                                       | Final registration button when already signed in |

Also uses, already defined elsewhere: `sections.*`, `errors.otp_invalid`, `errors.otp_expired`, `errors.otp_too_many_attempts`, `errors.already_registered`, `errors.session_full`, `errors.registration_closed`, `errors.session_cancelled`, `errors.rate_limited`, `ui.required`, `ui.optional`, `ui.on`, `ui.off`.

## Urdu and right-to-left notes

- Labels, errors and helper text align to the start (right in Urdu). Name and area follow the screen direction.
- The WhatsApp number and the code are left-to-right and aligned to the start side: `TextField contentDirection="ltr"`. In the sentence "We sent a 6-digit code to {phone}" the number is a left-to-right run (`ltrRun`).
- The stepper (minus, number, plus) mirrors: in Urdu plus is on the left. The number stays Western digits.
- The segmented control mirrors: Women is first at the right in Urdu.
- Name may be typed in Urdu or English; the field uses auto direction for what is typed.

## Accessibility notes

- Every field has a visible label; required and optional are both written. Errors are announced and focus moves to the first invalid field.
- The step line is text ("Step 1 of 2"); when step 2 appears, focus moves to its title.
- The phone field uses the phone keyboard and the platform autofill hints (`autoComplete` for tel and one-time-code).
- The stepper buttons are named ("Fewer people", "More people") and the number is announced as it changes.
- The resend wait is not a live region that counts; it announces only when the button becomes available.
- The consent switch is off by default and its state is written (On or Off).

## Components used

- Header
- Card
- TextField
- Select
- SegmentedControl
- IconButton
- Switch
- Button (large)
- Text
- ErrorState (page-level failures)
- EmptyState (done page layout)

## Data

- `auth.requestCode`, `auth.verifyCode`, `registrations.create`, `consents.set`, `places.areas`.
- Rate limits: sign-in codes and registration are limited by the API; the screen shows the matching error and waits.

## Open questions

- Kit gaps: a one-time-code field (6 boxes) and a stepper. Proposed: use `TextField` with `maxLength` 6 and two `IconButton`s now; add `CodeField` and `Stepper` to the kit if the first design review asks.
- Does the phone number need a country-code picker? Country is fixed to Pakistan in V2, so the screen takes a local number and the +92 prefix is added by the app.
