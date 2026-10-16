# Screen: Post an update

App: Admin app. Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Tell the people connected with a session something short: a changed time, a closed car park, "bring your own mat". The coordinator picks who gets it, optionally starts from a template, writes at most a few lines, previews it, and sends. A plain, safe flow: one clear confirmation before anything is sent to many people.

## Layout

1. `Header`: "Post an update" with the session name under it.
2. **Who gets it**: `SegmentedControl` "Followers" | "Registered people" (audience), with a line under it showing roughly how many people will receive it.
3. **Start from a template** (`Select`, optional): the venue's saved templates, plus "No template".
4. **Message** (`TextField`, multiline): label "Message", help "Keep it short and clear.", a live counter "{count} of {max}". Error: "Write your message before you send it." (or the API's too-long message).
5. **How it is sent**: two read-only `Chip`s showing the channels that will be used: "In the app" and "WhatsApp" (WhatsApp appears only for people who agreed to it).
6. **Preview** `Card`: the message as it will look in the app, in the language you are writing in.
7. Primary button "Send update" (disabled until a message exists).

**Confirm** (`Sheet`): title "Send this update?", text "{count} people will get it. You cannot take it back.", primary "Send", tertiary "Cancel".

## States

| State               | What the person sees                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Loading             | Skeleton for the template select; the form is usable at once.                                                    |
| Empty: no templates | The template select shows only "No template"; no extra text.                                                     |
| Validation          | Empty or too-long message: field-level error under the message, focus moves to the field.                        |
| Sending             | Send button busy; the form is read only; the confirm sheet cannot be dismissed.                                  |
| Success             | `Toast`: "Update sent." and the form resets; the person stays on the screen.                                     |
| Error               | Danger `Toast` with the API's plain-language reason; the message is kept so nothing is lost.                     |
| Offline             | The Send button is disabled with the reason "You are offline. Connect to send."; the draft is kept on the phone. |
| Rate limited        | The API's rate-limit message appears as the error; the draft is kept.                                            |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                                    | English                                   | Used for               |
| -------------------------------------- | ----------------------------------------- | ---------------------- |
| `admin.postUpdate.title`               | Post an update                            | Header                 |
| `admin.postUpdate.audience.label`      | Who should see this?                      | Audience label         |
| `admin.postUpdate.audience.followers`  | People who follow {venue}                 | Audience option        |
| `admin.postUpdate.audience.registered` | People registered for this session        | Audience option        |
| `admin.postUpdate.template.label`      | Start from a template                     | Template select        |
| `admin.postUpdate.template.none`       | Write my own                              | No template option     |
| `admin.postUpdate.body.label`          | Message                                   | Message label          |
| `admin.postUpdate.body.help`           | Keep it short and clear.                  | Message help           |
| `admin.postUpdate.body.error`          | Write a message.                          | Empty message error    |
| `admin.postUpdate.body.count`          | {count} of {max} characters               | Character counter      |
| `admin.postUpdate.channel.app`         | App notification                          | Channel chip           |
| `admin.postUpdate.channel.whatsapp`    | WhatsApp, only for people who agreed      | Channel chip           |
| `admin.postUpdate.preview`             | Preview                                   | Preview title          |
| `admin.postUpdate.submit`              | Post update                               | Send button            |
| `admin.postUpdate.confirm.title`       | Send to {count} people?                   | Confirm sheet title    |
| `admin.postUpdate.confirm.body`        | You cannot take it back after it is sent. | Confirm sheet text     |
| `admin.postUpdate.confirm.send`        | Send                                      | Confirm sheet primary  |
| `admin.postUpdate.confirm.cancel`      | Not yet                                   | Confirm sheet tertiary |
| `admin.postUpdate.success`             | Update posted.                            | Success toast          |

Also uses, already defined elsewhere: `ui.optional`, `ui.required`, `errors.*`.

## Urdu and right-to-left notes

- The message field uses `direction="auto"` so an Urdu message aligns to the right and an English one to the left in either app language. The preview uses the same rule.
- Urdu in the field gets the Urdu line height so the typed text is not cramped; the counter uses Western digits.
- The channel chips are labelled in words; the WhatsApp brand mark is not used.
- Template text is stored per language; the select shows the template names in the app's language.

## Accessibility notes

- The counter is not announced on every key press; it is announced at 90 and 100 percent of the limit.
- The audience control is a radio group (SegmentedControl) with a group name.
- The confirm sheet moves focus to its title, the first action after the title is "Cancel", and Escape cancels.
- The error is tied to the field (`aria-describedby`) and announced when it appears.

## Components used

- Header
- SegmentedControl
- Select
- TextField
- Chip
- Card
- Button
- Sheet
- Toast
- Skeleton
- Text

## Data

- `adminTemplates.list`, `adminUpdates.post`.
- Drafts are kept in local storage until sent; they hold no personal data other than what the coordinator typed.
- Delivery over WhatsApp is the messaging lane's job and respects consent.

## Open questions

- What is the character limit? Needs a value from the contracts lane (the screen reads it from the schema).
