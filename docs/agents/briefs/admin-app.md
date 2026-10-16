# Brief: admin-app

Lane: admin-app
Work packages: WP6 (Wave 2), WP17 admin part (Wave 4)
Wave: 2
Priority: P0
Approval: reviewer agent, UI review, human for store build configuration

## Goal

The Expo admin and coordinator app for the top phone tasks: see and contact today's registrants, post an update, change a session time, create or edit a venue or circle, and mark attendance. It is scoped by role: a coordinator sees only their own city or venue.

## You own

`apps/admin-app/`.

## You must not touch

`packages/*` (use them as they are; send change requests), other apps.

## Read first

`docs/product/experience.md`, `docs/product/features.md`, `docs/product/decisions.md` (roles, circles, attendance), `docs/design/screens/` (admin screens), the frozen `packages/contracts` and its mock server.

## Deliverables

1. **App init.** Expo with Expo Router and TypeScript. Record the SDK version in a decision record.
2. **Sign-in.** Phone code, using the contract's sign-in endpoints. Only invited numbers get coordinator access. Show only what the person's scope allows.
3. **Today's registrants.** A live list for the person's venue with party size, section and one-tap contact by phone or WhatsApp link. Registrants' numbers are visible to coordinators only.
4. **Post an update.** Within scope, with a message template picker from the console's templates (Wave 4) and free text before that. Shows who will receive it before sending.
5. **Change a session time.** Confirms the effect (people notified, poster out of date) before saving.
6. **Venue and circle editor.** Create or edit a venue, including the facilities checklist, and create or edit a circle. A venue coordinator's new circle shows as pending until a city coordinator approves it.
7. **Attendance tick list.** For an occurrence: a headcount, plus optional names. Quick to use at the end of a session.
8. **Wave 4.** Venue facilities checklist polish, portion and recap notes for the session companion (WP17).

## Definition of done

- A venue coordinator cannot see or act on another venue's data, proven against the mock and later the real API.
- Every screen works left-to-right and right-to-left, light and dark, at four text sizes, with empty and error states.
- The app uses only the generated API client. No secrets, no hand-written fetch calls.
- Screens match the ui lane's specs, with a design review.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/admin-app typecheck
pnpm --filter @qc/admin-app test
```

## Decisions to respect

Coordinators are invited by an admin and sign in with a phone code. Teacher is an optional name on a circle. Attendance is coordinator-only. Every write is audited by the API. City coordinators approve circles before they go public.

## Stand-ins

API not ready: use the mock server. Component kit not published yet: wait for the ui lane's first release. No device: run on web and the simulators.
