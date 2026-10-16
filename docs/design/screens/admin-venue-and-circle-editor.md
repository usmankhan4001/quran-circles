# Screen: Venue and circle editor

App: Admin app. Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Create and edit a venue and its circles. Coordinators keep their own venue details right (name, address, pin, entrance, facilities, phone). Circles are created as drafts and sent for approval by the city lead; a city lead approves or rejects with a reason. Two forms in one flow: venue first, then its circles.

## Layout

**Venue form** (one scrolling page, sections with level-2 titles)

1. `Header`: "New venue" or "Edit venue".
2. Name in English and Name in Urdu (`TextField` x2; the Urdu field is right to left).
3. Address (`TextField`, multiline), Area (`Select`), Map pin (a button "Set pin on the map" that opens the map picker, shows the chosen place as text and coordinates are never shown).
4. Venue phone (`TextField`) with the help "Shown to the public. Use the venue's own number."
5. **Facilities** (`Checkbox` list): the facilities vocabulary (parking, women's section, wheelchair access, wudu area, ...). Help text: "Tick what the venue has."
6. **Entrance** (`TextField`, multiline): "How to find the entrance".
7. Primary "Save venue". Below, a tertiary danger "Archive this venue".

**Circle form** (opens from a circle row or "Add a circle"; same page pattern)

1. `Header`: "New circle" or "Edit circle", with a `Chip` for status: Draft, Waiting for approval, Published, Not approved.
2. Name, Teacher (`TextField`), Kind (`SegmentedControl`: Class | Drop-in), Language (`Select`), Section (`Select`: men, women, mixed, children).
3. Schedule (day and time; a repeat row `ListItem` that opens a `Sheet` with the day `Select` and time field), Capacity (`TextField` number) with a live count "{count} places", Online (`Switch`).
4. For a coordinator: "Save draft" (secondary) and "Send for approval" (primary). For a city lead: "Approve" (primary), "Not approved" (danger-outline) which asks for a reason in a `Sheet`.

**Archive venue** (`Sheet`): title "Archive this venue?", text, danger "Archive", tertiary "Keep it".

## States

| State            | What the person sees                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Loading          | Skeleton form blocks; fields appear when the record loads.                                                                   |
| Validation       | Field-level errors from the schema; first error is focused.                                                                  |
| Saving           | Primary button busy; fields read only.                                                                                       |
| Success          | `Toast`: "Saved." (`admin.venueEditor.saved` / `admin.circleEditor.saved`).                                                  |
| Pending approval | The circle's status chip reads Waiting for approval; coordinator fields are read only until it is approved or sent back.     |
| Rejected         | Status "Not approved" with the city lead's reason shown in a `Card` above the form; the coordinator can edit and send again. |
| Error            | Danger `Toast` with the reason; entered values stay.                                                                         |
| Offline          | Saving is disabled with the reason; values are kept as a draft on the phone.                                                 |
| Not allowed      | Not-allowed `ErrorState`; the editor never shows another venue's data.                                                       |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                                   | English                                                                                      | Used for                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| `admin.venueEditor.title.new`         | Add a venue                                                                                  | Header, new                          |
| `admin.venueEditor.title.edit`        | Edit venue                                                                                   | Header, edit                         |
| `admin.venueEditor.nameEn.label`      | Name in English                                                                              | Field                                |
| `admin.venueEditor.nameUr.label`      | Name in Urdu                                                                                 | Field                                |
| `admin.venueEditor.address.label`     | Address                                                                                      | Field                                |
| `admin.venueEditor.area.label`        | Area                                                                                         | Select                               |
| `admin.venueEditor.pin.label`         | Place the pin at the entrance                                                                | Pin button                           |
| `admin.venueEditor.phone.label`       | Venue phone number                                                                           | Field                                |
| `admin.venueEditor.phone.help`        | Everyone can see this number.                                                                | Field help                           |
| `admin.venueEditor.facilities.title`  | Facilities                                                                                   | Section title                        |
| `admin.venueEditor.facilities.help`   | Tick what the venue has.                                                                     | Section help                         |
| `admin.venueEditor.entrance.label`    | How to find the entrance                                                                     | Field                                |
| `admin.venueEditor.submit`            | Save venue                                                                                   | Save button                          |
| `admin.venueEditor.saved`             | Venue saved.                                                                                 | Saved toast                          |
| `admin.venueEditor.archive.action`    | Archive this venue                                                                           | Archive button                       |
| `admin.venueEditor.archive.title`     | Archive this venue?                                                                          | Archive sheet title                  |
| `admin.venueEditor.archive.body`      | People will no longer see it. You can bring it back later.                                   | Archive sheet text                   |
| `admin.venueEditor.archive.confirm`   | Archive                                                                                      | Archive sheet danger button          |
| `admin.venueEditor.archive.keep`      | Keep it                                                                                      | Archive sheet tertiary               |
| `admin.circleEditor.title.new`        | Add a circle                                                                                 | Header, new                          |
| `admin.circleEditor.title.edit`       | Edit circle                                                                                  | Header, edit                         |
| `admin.circleEditor.name.label`       | Circle name                                                                                  | Field                                |
| `admin.circleEditor.teacher.label`    | Teacher (optional)                                                                           | Field                                |
| `admin.circleEditor.kind.label`       | Type                                                                                         | Control label                        |
| `admin.circleEditor.kind.class`       | Regular class                                                                                | Option                               |
| `admin.circleEditor.kind.dropIn`      | Open drop-in                                                                                 | Option                               |
| `admin.circleEditor.language.label`   | Language                                                                                     | Select                               |
| `admin.circleEditor.section.label`    | Section                                                                                      | Select                               |
| `admin.circleEditor.schedule.label`   | When it meets                                                                                | Schedule row                         |
| `admin.circleEditor.capacity.label`   | Limit the seats                                                                              | Field                                |
| `admin.circleEditor.capacity.count`   | Number of seats                                                                              | Live count                           |
| `admin.circleEditor.online.label`     | Online link (optional)                                                                       | Switch                               |
| `admin.circleEditor.saveDraft`        | Save draft                                                                                   | Button                               |
| `admin.circleEditor.sendForApproval`  | Send for approval                                                                            | Button                               |
| `admin.circleEditor.status.draft`     | Draft                                                                                        | Status label                         |
| `admin.circleEditor.status.pending`   | Waiting for the city coordinator                                                             | Status label                         |
| `admin.circleEditor.status.published` | Published                                                                                    | Status label                         |
| `admin.circleEditor.status.rejected`  | Not approved                                                                                 | Status label                         |
| `admin.circleEditor.approve`          | Approve                                                                                      | City lead button                     |
| `admin.circleEditor.reject`           | Do not approve                                                                               | City lead button                     |
| `admin.circleEditor.reject.reason`    | Reason                                                                                       | Reason field                         |
| `admin.circleEditor.saved`            | Circle saved.                                                                                | Saved toast                          |
| `facilities.*`                        | 6 keys: womenSection, parking, wuduArea, elderWheelchairAccess, childFriendly, entranceNotes | Facility names for the checkbox list |
| `sections.*`                          | 3 keys: women, men, family                                                                   | Section names for the select         |
| `days.*`                              | 7 keys: mon, tue, wed, thu, fri, sat, sun                                                    | Day names for the schedule           |

Also uses, already defined elsewhere: `ui.optional`, `ui.required`, `errors.*`.

## Urdu and right-to-left notes

- The English and Urdu name fields are each fixed in their own direction (`dir="ltr"` and `dir="rtl"`) whatever the app language, so the person sees how the name will look. Labels mirror around them.
- Phone numbers are left-to-right runs and are entered with Western digits; the field accepts Urdu digits and converts them.
- The map pin text (area name) follows the chosen content language; coordinates are never shown.
- Facilities, sections and days use the translation keys; the venue's saved data holds ids, not words.

## Accessibility notes

- Every field has a visible label; required fields say "Required" in words, optional ones say "Optional".
- Status chips carry words, never colour alone. When the status changes the new status is announced.
- The facilities list is a group of checkboxes with the section title as its name; each box is a 48 dp target.
- Approve and Not approved are separate buttons with a clear difference in words; Not approved needs a reason.
- The map picker has a text alternative: a search field for the area name, because dragging a pin is not usable with a screen reader or a switch.

## Components used

- Header
- TextField
- Select
- SegmentedControl
- Checkbox
- Switch
- Chip
- ListItem
- Card
- Button
- Sheet
- Toast
- ErrorState
- Skeleton
- Text

## Data

- `adminVenues.create`, `adminVenues.update`, `adminVenues.archive`, `adminCircles.create`, `adminCircles.update`, `adminCircles.submit`, `adminCircles.approve`, `adminCircles.reject`.
- Facility and section vocabularies from `@qc/contracts`; their names come from i18n.

## Open questions

- The map picker is not in the kit. Proposal: the user-app lane provides it; this lane provides the text fallback (search by area name). Confirm.
- Is Online per circle or per session?
