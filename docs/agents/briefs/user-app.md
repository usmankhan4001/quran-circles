# Brief: user-app

Lane: user-app
Work packages: WP5 (Wave 2), WP17 user part and WP18 wiring (Wave 4), WP19 user part and WP20 (Wave 7)
Wave: 2
Priority: P0 for WP5
Approval: reviewer agent, UI review, human for store build configuration

## Goal

The Expo user app for iOS, Android and the PWA: the four tabs and the Profile, built against the mock server until Gate 2. A person can find a session near them, register in a tap, see it under My Journey, and get a reminder.

## You own

`apps/user-app/`.

## You must not touch

`packages/*` (use `@qc/ui`, `@qc/contracts`, `@qc/i18n` as they are; send contract change requests for anything missing), other apps.

## Read first

`docs/product/experience.md`, `docs/product/features.md`, `docs/design/screens/` (written by the ui lane), `docs/product/messaging.md`, the frozen `packages/contracts` and its mock server.

## Deliverables

1. **App init.** Expo with Expo Router and TypeScript, the web target enabled for the PWA. Record the SDK version in a decision record. Do not add a UI library; use `@qc/ui`.
2. **Shell.** Four tabs (Home, Nearby, My Journey, Quran & Prayer) and the Profile avatar, using `TabBar` from `@qc/ui`. English and Urdu with right-to-left.
3. **Nearby.** Map and list toggle with a `MapProvider` interface (Google Maps behind it), filters for day and time, section, language and area, area search over our own place hierarchy, and "Request a circle near me" as an empty-state action (wired in Wave 7).
4. **Venue and session pages.** Details, facilities checklist, Contact and Location actions.
5. **Registration.** Required fields: name, WhatsApp number verified by code, area, section, party size. Consent checkbox for WhatsApp alerts. Confirmation screen.
6. **My Journey.** Registrations, followed venues and circles, per-session reminders. Companion content in Wave 4.
7. **Home.** Season-aware lead card, the Updates feed with unread badge, small cards for the next prayer and continue reading.
8. **Profile.** Language, text size (four steps), dark mode, alerts per venue, account and delete, support, About.
9. **Reminders.** On-device reminders scheduled relative to each session's start, and push registration with the contract's device endpoint.
10. **Offline.** Cache venues and sessions you have viewed, and show the cache with a clear offline state.
11. **Quran & Prayer tab.** Mount the modules from `packages/content` when the content lane publishes them.
12. **Later waves.** Session companion and invite share cards (WP17), request a circle (WP19), widget (WP20).

## Definition of done

- Every screen works left-to-right and right-to-left, light and dark, at four text sizes, offline, and with empty and error states.
- The app uses only the generated API client. No hand-written fetch calls and no secrets.
- It runs against the mock server on iOS, Android and web.
- Screens match the ui lane's specs, and the ui lane has given a design review.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/user-app typecheck
pnpm --filter @qc/user-app test
```

## Decisions to respect

Registration area is required and picked from our place list. Attendees see only the venue's contact number. No account is needed to browse. Dora portions are set by coordinators per session. English tab names are final; Urdu names are drafts. The PWA is the store fallback.

## Stand-ins

API not ready: use the mock server from `@qc/contracts`. Component kit not published yet: wait for the ui lane's first release rather than building your own components. No device: run on web and the simulators.
