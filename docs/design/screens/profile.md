# Screen: Profile

App: User app (avatar button; not a tab). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

The person's settings and account: language, text size, dark mode and high contrast, alerts per venue, optional details, account actions (sign out and delete), support and About. Language and text size apply to the whole app at once. The in-app delete option is required (`docs/product/decisions.md`).

## Layout

Opens from the avatar on Home. A `Header` with back and "Profile". Sections in this order, each with a level-2 title:

1. **Account card**: `Avatar` (initials), name, the WhatsApp number (partly hidden, last 3 digits), a tertiary "Edit" button. Signed out: a primary "Sign in" button instead.
2. **Language**: `SegmentedControl` English | اردو. Changes language and direction immediately.
3. **Text size**: a `SegmentedControl` with four steps (Standard, Large, Larger, Largest) and a **live sample** in a `Card` below it: "This is how your text will look." in the current language. The sample is the only place where the change is shown before leaving; the rest of the app updates at once.
4. **Appearance**: `Switch` "Dark mode" and `Switch` "High contrast". Both default to follow the system when unset.
5. **Alerts**: a `Switch` "WhatsApp reminders" (consent), then one `Switch` row per followed venue "Alerts for {venue}". Empty: "Follow a venue to set its alerts."
6. **About you** (optional): helper "These are optional. They help coordinators plan." `Select`s and `TextField`s for Age, Profession, Education, Quran reading so far, with a primary "Save" button. Each field is optional and says so.
7. **Help**: `ListItem`s "Help and support" and "About Quran Circles" (open content pages from the content manager, English and Urdu).
8. **Account actions**: `Button` tertiary "Sign out"; `Button` secondary-danger "Delete my account" at the very bottom.

**Delete confirmation** (`Sheet`): title "Delete your account?", text "This removes your registrations and personal details. It cannot be undone.", danger button "Delete my account", tertiary "Keep my account". The danger button asks for a fresh code first if the sign-in is older than the API's limit.

## States

| State      | What the person sees                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading    | Account card and alert rows show skeletons; language, text size and appearance work at once because they are stored on the phone.                                            |
| Saving     | The Save button shows busy; fields are read only. On success a `Toast`: "Saved.".                                                                                            |
| Error      | Failed save: field-level message or a danger `Toast`; the typed values stay. Failed load of alerts: `ErrorState` for that section only.                                      |
| Offline    | Language, text size, dark mode and high contrast are saved on the phone and work offline. Account details, alerts and delete show a notice and are disabled with the reason. |
| Signed out | Account card shows Sign in; Alerts and About you are hidden; Language, Text size, Appearance, Help and About remain.                                                         |
| Deleting   | Danger button busy; on success the app returns to Home as a signed-out visitor with a `Toast` confirming.                                                                    |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                              | English                                                                    | Used for                         |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `profile.title`                  | Profile                                                                    | Header (existing key)            |
| `profile.name.label`             | Name                                                                       | Name field                       |
| `profile.phone.label`            | WhatsApp number                                                            | Number label                     |
| `profile.language.title`         | Language                                                                   | Language section                 |
| `profile.language.en`            | English                                                                    | Option written in its own script |
| `profile.language.ur`            | Urdu                                                                       | Option written in its own script |
| `profile.textSize.title`         | Text size                                                                  | Text size section                |
| `profile.textSize.sample`        | This is how your text will look.                                           | Live sample                      |
| `profile.textSize.step0`         | Standard                                                                   | Option                           |
| `profile.textSize.step1`         | Large                                                                      | Option                           |
| `profile.textSize.step2`         | Larger                                                                     | Option                           |
| `profile.textSize.step3`         | Largest                                                                    | Option                           |
| `profile.appearance.title`       | Appearance                                                                 | Appearance section               |
| `profile.darkMode`               | Dark mode                                                                  | Switch                           |
| `profile.highContrast`           | High contrast                                                              | Switch                           |
| `profile.alerts.title`           | Alerts                                                                     | Alerts section                   |
| `profile.alerts.venue`           | Alerts for {venue}                                                         | Per-venue switch                 |
| `profile.alerts.empty`           | Follow a venue to set its alerts.                                          | No followed venues               |
| `profile.whatsapp`               | WhatsApp reminders                                                         | WhatsApp consent switch          |
| `profile.details.title`          | About you                                                                  | About you section                |
| `profile.details.help`           | These are optional. They help coordinators plan.                           | About you helper                 |
| `profile.ageBand.label`          | Age                                                                        | Field                            |
| `profile.profession.label`       | Profession                                                                 | Field                            |
| `profile.education.label`        | Education                                                                  | Field                            |
| `profile.priorReading.label`     | Quran reading so far                                                       | Field                            |
| `profile.save`                   | Save                                                                       | Save button                      |
| `profile.saved`                  | Saved.                                                                     | Saved toast                      |
| `profile.account.title`          | Account                                                                    | Account section                  |
| `profile.account.signOut`        | Sign out                                                                   | Sign out button                  |
| `profile.account.delete`         | Delete my account                                                          | Delete button                    |
| `profile.account.delete.title`   | Delete your account?                                                       | Delete sheet title               |
| `profile.account.delete.body`    | This removes your registrations and personal details. It cannot be undone. | Delete sheet text                |
| `profile.account.delete.confirm` | Delete my account                                                          | Delete sheet danger button       |
| `profile.account.delete.keep`    | Keep my account                                                            | Delete sheet tertiary button     |
| `profile.support`                | Help and support                                                           | Help row                         |
| `profile.about`                  | About Quran Circles                                                        | About row                        |

Also uses, already defined elsewhere: `ui.on`, `ui.off`, `ui.optional`, `errors.*`.

## Urdu and right-to-left notes

- Changing the language flips the whole app at once, including this screen, with no restart. `ThemeProvider` takes the new `locale`.
- Language names stay in their own script in both languages (English, اردو) so a person who landed in the wrong language can still find theirs.
- The live sample is rendered in the chosen language and size, including Gulzar's extra line height at the largest step.
- The phone number is a left-to-right run and partly hidden: show the last three digits.
- Switch thumbs move towards the end side; in Urdu "On" is at the left.

## Accessibility notes

- Text size and language changes take effect without moving focus; the control keeps focus and the new state is announced.
- The four text sizes are described in words (Standard, Large, Larger, Largest), not numbers.
- Each switch row is one control: name, description and state read together; the whole row is a 48 dp target.
- The destructive action is last, separate, and needs a second confirmation. The confirmation's default focus is "Keep my account".
- Dark mode and high contrast respect the system setting by default and can be overridden here.

## Components used

- Header
- Avatar
- Card
- SegmentedControl
- Switch
- Select
- TextField
- ListItem
- Button
- Sheet
- Toast
- Skeleton
- ErrorState
- Text

## Data

- `me.get`, `me.update`, `me.delete`, `consents.list`, `consents.set`, `follows.list`, `follows.update`, `auth.signOut`.
- Language, text size, dark mode and high contrast are stored on the phone (and may sync later). `content.page` for Help and About.

## Open questions

- Should text size also be stored on the account? Proposed: phone only in V2.
