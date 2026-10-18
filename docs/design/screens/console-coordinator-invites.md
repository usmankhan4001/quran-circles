# Screen: Coordinator invites

App: Console (city lead and super admin). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

A city lead invites a person to coordinate a venue (or another city lead to the city) by their WhatsApp number, sees the state of each invite and can revoke or resend it. No password is ever created: the invited person signs in with a code sent to that number. The console is a desktop web app for city and super admins. It shares the kit's tokens, colour modes, type scale, direction helper and `ThemeProvider`; it does not use the phone-first components for tables or wide forms. Where this spec says "form field", "button" or "toast", the console uses the kit's `TextField`, `Button` and `Toast` unchanged, and builds its tables and page shell from tokens only.

## Layout

Two columns at 1024 px and wider; one column below.

1. Page header: "Coordinator invites" and a primary button "Invite someone" (opens the invite form in a side panel; on narrow screens a `Sheet`).
2. **Invite form**: Phone number (`TextField`, left-to-right), Role (`Select`: Venue coordinator | City lead), Scope (`Select` of venues or cities, depending on the role; labelled "Venue" or "City"). Primary "Send invite".
3. **Invites** table: columns Name or number (partly hidden), Role, Scope, Status (text plus a `Badge`-style label: Waiting, Accepted, Expired, Revoked), Date, and Actions ("Resend" and "Revoke" as tertiary buttons; revoke asks for confirmation in a `Sheet`).
4. Status filter above the table (`SegmentedControl`): All | Waiting | Accepted.

## States

| State       | What the person sees                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| Loading     | Table skeleton with five rows; the invite button is usable.                                |
| Empty       | "You have not invited anyone yet." with the Invite button repeated inside the empty state. |
| Validation  | Phone not valid: field error from the schema's message; role and scope required.           |
| Sending     | Send button busy.                                                                          |
| Success     | `Toast` "Invite sent."; the table gains the row at the top with status Waiting.            |
| Error       | Danger `Toast` with the reason (already invited, number invalid, not allowed).             |
| Offline     | Actions disabled with a banner "You are offline."; the table keeps the last loaded rows.   |
| Not allowed | A user without city-lead or higher scope sees the standard not-allowed `ErrorState`.       |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                               | English              | Used for              |
| --------------------------------- | -------------------- | --------------------- |
| `console.invites.title`           | Invite coordinators  | Page header           |
| `console.invites.new`             | Invite a coordinator | Invite button         |
| `console.invites.phone.label`     | WhatsApp number      | Field                 |
| `console.invites.role.label`      | Role                 | Select label          |
| `console.invites.role.city`       | City coordinator     | Role option           |
| `console.invites.role.venue`      | Venue coordinator    | Role option           |
| `console.invites.scope.city`      | City                 | Scope label for city  |
| `console.invites.scope.venue`     | Venue                | Scope label for venue |
| `console.invites.send`            | Send invite          | Send button           |
| `console.invites.sent`            | Invite sent.         | Success toast         |
| `console.invites.list.title`      | Invites              | Table title           |
| `console.invites.status.pending`  | Waiting              | Status                |
| `console.invites.status.accepted` | Accepted             | Status                |
| `console.invites.status.expired`  | Expired              | Status                |
| `console.invites.status.revoked`  | Cancelled            | Status                |
| `console.invites.revoke`          | Cancel invite        | Row action            |
| `console.invites.resend`          | Send again           | Row action            |
| `console.invites.empty`           | No invites yet.      | Empty text            |

Also uses, already defined elsewhere: `ui.*`, `errors.*`, `admin.venueEditor.*` for confirmation wording patterns.

## Urdu and right-to-left notes

- The console is bilingual and mirrors in Urdu: table columns reverse, the actions column moves to the left, the side panel opens from the left.
- The phone number is an isolated left-to-right run in the table and the field in both directions.
- Table headers use the Urdu type scale in Urdu; row height grows with the Urdu line height, never fixed.
- Numbers and dates use Western digits.

## Accessibility notes

- The table is a real table (`role="table"`, column headers, row headers); not a grid of buttons.
- Status is written text, with colour only as reinforcement.
- The side panel traps focus, closes with Escape and returns focus to the Invite button.
- Resend and Revoke have names that include the number's last digits so each is unique ("Revoke invite for number ending 21").
- Keyboard: Tab order follows reading order in both directions; the panel is reachable without a mouse.

## Components used

- TextField
- Select
- SegmentedControl
- Button
- Sheet (narrow screens)
- Toast
- EmptyState
- ErrorState
- Skeleton
- Text
- Table (console-only, from tokens)

## Data

- `adminRoles.invite`, `adminRoles.invites`, `adminRoles.revokeInvite`. Resend is a new invite for the same number (or a dedicated call; contracts lane to confirm).
- Invites carry no secrets in the UI; the sign-in link/code is sent by the messaging lane.

## Open questions

- Is there an explicit resend call, or does Resend create a new invite?
- Table component for the console: this lane proposes to add a minimal `Table` to the kit in a later pass; until then the console builds it from tokens.
