# 0010: Admin app stack (Expo SDK 58, router, sign-in storage, scope, tests)

Status: accepted
Date: 2026-10-16
Lane: admin-app

## Context

The admin app (`apps/admin-app`) is for coordinators on a phone: see who is coming, post an update, change a session time, take attendance, keep a venue and its circles right. It must work in English and Urdu (both directions), at four text sizes, in light and dark, and its logic has to be proved on the web target with tests, because native builds cannot run here.

## Options

Navigation: (1) expo-router (file based), (2) React Navigation by hand.
Data: (1) a small loader over the typed client, (2) a data library plus a store.
Where the sign-in lives: (1) the platform keychain on phones and session storage on the web, (2) local storage everywhere.
How the app knows what a person may do: (1) hide by role name in each screen, (2) ask the shared `can` of `@qc/contracts` with the person's roles.
Tests: (1) Vitest with react-native-web in jsdom (decision 0003), (2) Jest with the React Native preset.

## Decision

- Expo SDK 58 with expo-router, versions pinned. The same stack as the user app (decision 0009) so one team can read both. Web output is `single`.
- Screens never import the router. They call a `Navigation` (`push`, `replace`, `back`) from a context and build addresses with `src/navigation/routes.ts`. The root layout connects it to `useRouter`. Tests pass a recorder.
- Data: `useQuery` and `useMutation` in `src/api`, a few lines over `createApiClient`. They keep the last good data while reloading, ignore late answers and never log what they load. Every failure is mapped to an `errors.*` message by `errorMessageKey`; each contract error code has one, checked by a test against both languages.
- Sign-in: the phone code flow of decision 0002. Tokens go to the keychain (`expo-secure-store`) on phones and to session storage on the web, so a closed tab signs out. The access token is refreshed once on `token_expired` and a failed refresh signs the person out. Nothing about a person is written to a log.
- Scope: `principalOf(me)` turns `me.roles` into the shared `Principal`. Screens hide or disable what `can` refuses and never invent their own rules. The server stays the authority; a test per screen shows what happens when a request the app would not send is refused anyway (403, mapped message). A person with several roles picks the role they are working as (`ScopeSwitcher`); lists are narrowed to it.
- Screens for people with no staff role show a plain "not invited" page and call nothing.
- Registrants are shown to the coordinator of the session only. There is no export in this app; bulk export stays in the web console. A guard test fails if the source mentions the export endpoint.
- The kit has no stepper, date picker or time picker. The app has one thin local `Stepper` marked TODO and takes dates and times as typed text, validated by the same rules the contract uses. See the change request `2026-10-16-admin-app-kit-needs.md`.
- Tests: Vitest, react-native-web in jsdom. Hooks and forms are unit tested; every screen is rendered against an in-memory backend built on `createMockHandler`, with no network, in four combinations (en and ur, light and dark, smallest and largest text) and for each of the three roles where visibility differs. Attendance and recap are checked by reading back what the backend stored.
- Proof of a build: `expo export --platform web` bundles the app. No native or store build is made here.

## Consequences

- Moving to another router touches `app/_layout.tsx` and `navigation/routes.ts` only.
- Dates and times are typed until the kit ships pickers.
- Venue and circle screens page through lists to find one record until the contract gets `adminSessions.get` and `adminCircles.get`; the change request `2026-10-16-admin-app-contract-notes.md` asks for both.
