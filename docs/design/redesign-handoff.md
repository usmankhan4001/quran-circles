# Redesign hand-off to the app lanes

The owner approved the redesign on 2026-10-17 (`redesign-decisions.md`, D1 to D16). The ui lane has rebuilt the kit in `packages/ui`, so every app picks up the new colours, fonts, corners, buttons, fields, chips, cards, green-topped sheets, toasts and the floating tab bar without code changes. App tests and typechecks pass against the new kit.

The app lanes own their screens (`docs/engineering/ownership.md`). This page lists what each lane changes to match the agreed layouts. The drawn screens are the reference; the screen specs in `screens/` still hold the states, keys and accessibility notes.

## Kit changes the apps should know about

- `Button` has a new `outline` variant. `secondary` is now the leaf-tint button (D8); use `outline` where a green outline was meant.
- `IconButton` has an `onHero` variant for icons on the green header.
- New semantic colours `hero`, `textOnHero`, `heroGlass` and `heroGlassPressed` for the green header that tops main screens (D12). Draw headers with these, not raw values.
- `TextField` puts its label inside the field (D9). No API change.
- `TabBar` floats and shows the label on the chosen tab only; every tab keeps its name for screen readers. Pass icons for every tab.
- Fonts are now Figtree, Jameel Noori Nastaleeq and KFGQPC Uthmanic Hafs. The apps bundle the files once their licences are confirmed; until then the system falls back.
- Night mode is the night green (`dark`).

## user-app

| Screen                    | Layout                                                                                                                           | Reference                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Home                      | H4: next circle in the green header, search, map card, circles near you as picture cards, ayah of the day, "Also in the app" row | https://claude.ai/artifact/2CiFog76rb9ZAHLF2BDCHX                                                       |
| Nearby                    | N2: green header with a Map / List switch; list ends with "Ask for a circle near you"                                            | https://claude.ai/artifact/EYjcjnrHaSBfovNtJxtGHU                                                       |
| Session and venue         | S1: photo on top, raised detail cards, one Register bar                                                                          | https://claude.ai/artifact/RgfYMvwTtFh8GuPtDa2ex3                                                       |
| Registration              | R2: in a green-topped sheet over the session page                                                                                | https://claude.ai/artifact/3aF22dRg3yjS8wbGxKr18k                                                       |
| My Journey                | J1: summary header, upcoming with reminder switches, progress, followed masjids; session companion                               | https://claude.ai/artifact/E8bF29LSW1Pc2FSGKM3xa7                                                       |
| Quran and prayer          | Q1: clean lists; paras, search, reading settings, bookmarks, offline, qibla, timetable, alerts                                   | https://claude.ai/artifact/MUf1ve9bvTGhCwsyahvgRx and https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR |
| Updates, profile, sign-in | B: green header on each page                                                                                                     | https://claude.ai/artifact/4WQhXBEstymMgd8GgEADrU                                                       |
| Feature screens           | Circle request, first open, ayah share, invites, reminders, Ramadan Home, widget                                                 | https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR                                                       |

Tabs: Home, Nearby, Quran, Journey. Quran, prayer and qibla stay secondary (D12).

## admin-app

Layout A, the same look as the user app (green header, floating tabs: Today, Places, Updates, Account).

- Today, attendance, post an update: https://claude.ai/artifact/LgHSJiqzbsUtSWSKA4NDfc
- Registrants, change or cancel a time, places, venue and circle editors, approval, sign-in, account: https://claude.ai/artifact/9orj7uMZstU7Pq88PrjBY1
- Posters, message templates, circle requests, handover: https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR

## console

C2: green sidebar with the eight-point pattern, light content area.

- Sessions: https://claude.ai/artifact/HKniV9wA9yrnpqWgGwB22m
- Coordinator invites, bulk import check, exports: https://claude.ai/artifact/9orj7uMZstU7Pq88PrjBY1

## renderer

Posters follow D3 and D4 (Tanzeem green, gilt for decoration, Figtree and Nastaliq), not the earlier emerald, DM Sans and Gulzar in `poster-direction.md`. Poster flow: https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR

## Kit pieces still to build

Now in the kit: `HeroHeader` (the green header, D12), `SearchField`, `CodeField`, `Tag` and `Banner`. Still to come from D7: Stepper, SeatMeter, DateStrip, SessionCard, PrayerStrip, ConfirmSheet and the map pieces. Apps can draw those locally until then.
