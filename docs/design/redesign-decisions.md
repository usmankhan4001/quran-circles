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

## Open questions

- Owner review of the component set.
- Screen-by-screen design (user app, then admin app, then console).
- Font files and licences: Jameel Noori Nastaleeq or Mehr Nastaliq, and KFGQPC or QCF.
