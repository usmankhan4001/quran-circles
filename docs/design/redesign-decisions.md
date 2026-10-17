# Redesign decisions

The visual redesign agreed with the product owner, decision by decision. It replaces the look of the current kit (`packages/ui`) once the direction is settled. Nothing in the kit or the apps changes until the owner agrees the direction; then the ui lane (WP21) rebuilds the tokens and components from this page.

Started 2026-10-16. Each entry says what was decided and why.

## Status

Direction, colour and type agreed. The component set is drawn and waiting for review; screens come next, built only from those components.

## Reference mock-ups

- Today's screens, for comparison: https://claude.ai/artifact/MVZZxptQDwatcpanC2JxWZ
- The four starting directions: https://claude.ai/artifact/YVmV6u5X1trRxwuNTZmzKz
- Current direction, Tanzeem green: https://claude.ai/artifact/3U7PkY8rFtA44tf37c6RKk
- Type comparison: https://claude.ai/artifact/Qxrd5fVzYTsdsRGYPnstTk
- Components and primitives: https://claude.ai/artifact/9KvBSi9D2LsAtUVQhdndbe

## Decisions

### D1. Start from scratch

The current kit's look (emerald on parchment, stock card and pill shapes) is dropped. The rules that are not about looks stay: right-to-left first, four text sizes, 48 dp targets, contrast minimums, the four data states, one main action per screen (`principles.md`).

### D2. Direction: a blend of Clear, Courtyard and Night, more visual

- From Night: the next prayer leads Home; a sky at the top of the main screens follows the day's prayers; the app turns dark after Isha.
- From Courtyard: soft rounded cards and a warm, welcoming feel.
- From Clear: big plain numbers for times and countdowns, one main button per screen, short labels.
- More visual: icons in soft tiles, a drawn map with time pins, seat meters, swipeable date chips.

### D3. Colour: Tanzeem-e-Islami green

Taken from the owner's Quran Circle poster.

| Role | Value | Use |
| --- | --- | --- |
| Tanzeem green | `#226836` | Every main action, selected states, brand |
| Deep green | `#154a27` | Big numbers, pressed states |
| Night green | `#0c2a17` | The night (after Isha) background |
| Leaf tint | `#e5f0e8` | Selected pills, secondary buttons, chips |
| Cloud | `#f7fbf9` | Light backgrounds |
| Mist | `#dbe7e6` | Sky, quiet surfaces |
| Mushaf gilt | `#b8913a` | Quran moments only (reading progress, para chips); decoration, not body text |
| Alert | `#c4563f` | Unread counts and errors only |

Mist and gilt as the colours that go with the green: confirmed by the owner. Contrast for every text pair is checked when tokens are rebuilt.

### D4. Typefaces

- Urdu: a true Nastaliq. Jameel Noori Nastaleeq, or Mehr Nastaliq (Lahori style). Replaces Gulzar. Licence for bundling in the apps to be confirmed before use. Mock-ups use Noto Nastaliq Urdu as a stand-in because the chosen faces are not on a web font service.
- Quran Arabic: a true Quranic face. KFGQPC (King Fahd Complex) Uthmanic Hafs, or the QCF page fonts, or AlMushaf. Only for Quran text. Licence to be confirmed.
- No display serif from the poster (Oranienbaum) anywhere in the app, wordmark included.
- Latin: Figtree (chosen over Noto Sans and Manrope). Big times and countdowns use Figtree semibold, not a display face. Numbers inside Urdu text are set in Figtree.
- The Amiri Quran stand-in shown in the mock-ups was rejected by the owner. Quran text must use the real KFGQPC or QCF files; mock-ups show no Quran text until those files are available.

### D5. Type scale

| Role | English (Figtree) | Urdu (Nastaliq) |
| --- | --- | --- |
| Countdown | 56, weight 600 | Figtree figures |
| Time | 40, weight 600 | Figtree figures |
| Screen title | 26, weight 700, line 1.2 | 26, line 2.0 |
| Card title | 18, weight 700, line 1.25 | 20, line 2.0 |
| Body | 16, weight 400, line 1.5 | 17, line 2.2 |
| Label and button | 15, weight 600 | 17 |
| Caption | 13, weight 500 | 14, line 2.0 |
| Eyebrow | 12, weight 700, capitals | 13, no capitals |

Urdu has one weight; emphasis comes from size and colour.

### D6. Primitives (proposed, in review)

- Spacing on a 4-point grid: 4, 8, 12, 16, 20, 24, 32, 48. Screen edges 16, between cards 12, inside cards 16, between sections 24.
- Corners: chip pill, field 14, button 16, card 22, sheet 28.
- Two shadows: resting (cards) and floating (sheets, map cards). At night depth comes from lighter surfaces.
- One line icon set: 24 grid, 1.75 stroke, round ends. Pointing icons mirror in Urdu.
- Night mode after Isha: night green page, lighter green surfaces, gilt for the current prayer.

### D7. Components (proposed, in review)

Button (primary, tonal, outline, quiet, danger; pressed, loading, disabled), IconButton (tonal, filled, glass, plain), TextField, CodeField, SearchField, SegmentedControl, Chip, Stepper, Switch, Checkbox, Tag (ok, gilt, alert, neutral, strong), Badge, Avatar, VenueMark, SeatMeter, ProgressRing, DateStrip, SessionCard (featured, compact), FactGrid, ListRow, UpdateRow, SurahRow, ResumeCard, SkyHeader, PrayerStrip, TopBar, TabBar, Banner, Toast, EmptyState, Skeleton, Sheet, ConfirmSheet, MapView, MapPin, MapCluster.

### D8. Buttons: soft rounded (A)

Chosen by the owner on 2026-10-17 from [Buttons](https://claude.ai/artifact/HukdzsoECQXcpjkMCeEvvH). Rounded rectangles, corner radius 16 (12 on the small size), solid Tanzeem green for the main action with a soft green shadow, leaf tint for the second action, a 1.5 green outline, text-only, and a terracotta outline for careful actions. Sizes 36 (inside cards only), 48 and 56. States: pressed (darker, 98% scale), focused (2 px ring, 3 px gap), disabled (40%), loading (rotating eight-point star). Icon buttons 44 square, same radius. Pill, mihrab-arch, tile, mushaf-frame and lantern shapes were rejected.

### D9. Text fields: outlined, label inside (A3)

Chosen by the owner on 2026-10-17 from [Text fields](https://claude.ai/artifact/F3KpcvHrUmPRQxEmHGfTQf). White field with a 1 px border, radius 14, 60 tall, the label small at the top inside the field (66 tall in Urdu so Nastaliq has room). Focus is a 2 px green border with a green label; error is a 2 px terracotta border with the message and a warning icon below. Search and the 6-digit code have no inside label (52 tall, search is pill-shaped). Phone numbers stay left-to-right with a +92 prefix, even in Urdu. Disabled fields are filled grey with a lock.

### D10. Choices: solid (C1)

Chosen by the owner on 2026-10-17 from [Choices](https://claude.ai/artifact/H9ZPTz7xKgQdipP93t2QUS). A chosen item fills with Tanzeem green and white text, matching the main button. Chips are 40 tall with radius 12 and a tick when chosen; the map or list switch sits in a grey track; toggles are green when on; tick boxes are rounded squares (radius 7); radios are rings with a green centre; tick and pick-one lists sit in white cards with dividers. Women, Men and Family cards (radius 18) fill green with a white tick when chosen and fade when a section is not offered. The people counter sits on a leaf tint with white minus and plus buttons.

### D11. Cards: raised (K1)

Chosen by the owner on 2026-10-17 from [Cards](https://claude.ai/artifact/ASLSHHQN2caYbQhX3VcnLK). White cards, corner radius 22, padding 14, no border, a soft two-layer shadow (0 1 2 and 0 8 22 at low green-black opacity). At night the shadow is replaced by a 1 px light hairline. Inside a card: eyebrow in green caps, title 17/700, muted 13 line, big time 28/600 on the trailing side, status tags radius 8 (leaf for good, gold for Quran and time changes, terracotta for problems), dividers as 1 px hairlines. Thumbnails radius 16; date blocks on leaf tint.

### D12. Screen direction: reference style, circles first

Agreed by the owner on 2026-10-17 from [New look](https://claude.ai/artifact/2NaxNfwZVYS4mWmryb6GAM), inspired by an Iqraa-style reference. Green header that fades into the page, picture cards for venues, light illustrated touches, a floating tab bar. The app is about Quran circles and the Dora: Home leads with your next session, then nearby circles; session, registration and journey screens carry the weight. Quran reading, prayer times, qibla and similar features stay in the app but sit in secondary places (a smaller row or their own tab), never as the main focus.

### D13. Sheets, dialogs and messages: green-topped (O3)

Chosen by the owner on 2026-10-17 from [Sheets, dialogs and messages](https://claude.ai/artifact/W7EG4KGSDkcssX83ozucMk). Bottom sheets (radius 28 top corners, grab handle, dimmed backdrop) and centred dialogs (radius 26) open with the app's green header gradient; the dialog icon sits on a white eight-point star. Sheet content uses the chosen chips and section cards, with Clear (outline) and the main action side by side. Dialogs stack the safe action as the main button above the careful (terracotta outline) one. Toasts are solid green with a white action, near the bottom. Banners run edge to edge: grey for offline, gold for time changes, terracotta for errors with a Retry action.

### D14. Home: next circle, then search and map (H4)

Chosen by the owner on 2026-10-17 from [Home options](https://claude.ai/artifact/2CiFog76rb9ZAHLF2BDCHX), a mix of H1 and H3. Top to bottom: green header with area, Hijri date and notifications, holding "Your next circle" (title, venue and distance, big start time and countdown, the portion, sections, Directions and My registration); a search field with a filter button; a small map card with start-time pins and "12 circles within 3 km"; "Circles near you" as picture cards (distance, time, sections, seats); an Ayah of the day card (Arabic, translation, reference, share); then a smaller "Also in the app" row with Quran, Prayer times, Qibla and Updates. Floating tab bar: Home, Nearby, Quran, Journey. In Ramadan the header card shows tonight's Dora instead.

### D15. Screens settled on 2026-10-17

The owner called the UI final on 2026-10-17. The picks below are the suggested ones from each set; the owner was asked to confirm or change them.

| Screen | Pick | What it means | Options page |
| --- | --- | --- | --- |
| Navigation | N2 | Floating tab bar: Home, Nearby, Quran, Journey | navigation page |
| Nearby | N2 | Green header as on Home with a Map / List switch; small cards for the nearest places on the map; the list ends with "Ask for a circle near you" | https://claude.ai/artifact/EYjcjnrHaSBfovNtJxtGHU |
| Session and venue | S1 | Photo of the place on top, details scroll over it in raised cards, one Register bar at the bottom | https://claude.ai/artifact/RgfYMvwTtFh8GuPtDa2ex3 |
| Register | R2 | Opens as a green-topped sheet (D13) over the session page | https://claude.ai/artifact/3aF22dRg3yjS8wbGxKr18k |
| My Journey | J1 | Green header with three season numbers, then upcoming (with reminder switches), circle progress and followed masjids | https://claude.ai/artifact/E8bF29LSW1Pc2FSGKM3xa7 |
| Quran and prayer times | Q1 | Clean lists: star-numbered surahs, verse cards with translation, prayer times as a list with a bell per prayer | https://claude.ai/artifact/MUf1ve9bvTGhCwsyahvgRx |
| Updates, profile and sign-in | B | Green header on each page; updates as cards linking to the session; profile opens with quick tiles | https://claude.ai/artifact/4WQhXBEstymMgd8GgEADrU |
| Admin app | A | Same look as the user app: green header, floating tabs, today's circles as big cards with quick actions | https://claude.ai/artifact/LgHSJiqzbsUtSWSKA4NDfc |
| Console | C2 | Green sidebar with the eight-point pattern; light content area | https://claude.ai/artifact/HKniV9wA9yrnpqWgGwB22m |

### D16. Feature and staff screens follow the picks

The remaining screens were drawn in the chosen styles (Q1 lists, O3 sheets, admin A, console C2) with no alternatives:

- Quran, prayer, posters, circle features and staff tools: https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR. Covers paras, search, reading settings, verse actions, bookmarks, offline copies, qibla, monthly timetable, prayer alerts, asking for a circle, first open, ayah share, the poster flow (design, edit, ready, out of date), session companion, invites, reminders, Ramadan Home, the home-screen widget, message templates, circle requests by area and venue handover.
- Admin app and console: https://claude.ai/artifact/9orj7uMZstU7Pq88PrjBY1. Covers today's registrants, changing or cancelling a time, venues and circles, venue and circle editors with approval, sign-in, account, coordinator invites, bulk import check and exports.
- Posters use the Tanzeem green (D3) and Figtree / Nastaliq (D4), not the emerald, DM Sans and Gulzar in `poster-direction.md`; that file needs updating to match.

## Open questions

- Confirm the D15 picks (asked on 2026-10-17).
- Update `poster-direction.md` to the D3 colours and D4 type.
- Font files and licences: Jameel Noori Nastaleeq or Mehr Nastaliq, and KFGQPC or QCF.
- Applying the design to `packages/ui` and the apps waits for the owner's go-ahead.
