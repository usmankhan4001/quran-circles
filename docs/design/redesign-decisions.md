# Redesign decisions

The visual redesign agreed with the product owner, decision by decision. It replaces the look of the current kit (`packages/ui`) once the direction is settled. Nothing in the kit or the apps changes until the owner agrees the direction; then the ui lane (WP21) rebuilds the tokens and components from this page.

Started 2026-10-16. Each entry says what was decided and why.

## Status

Direction agreed in outline. Typography and the screen-by-screen deep dive are in progress.

## Reference mock-ups

- Today's screens, for comparison: https://claude.ai/artifact/MVZZxptQDwatcpanC2JxWZ
- The four starting directions: https://claude.ai/artifact/YVmV6u5X1trRxwuNTZmzKz
- Current direction, Tanzeem green: https://claude.ai/artifact/3U7PkY8rFtA44tf37c6RKk

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

The "mixture" with the green (mist and gilt) is proposed and awaiting the owner's confirmation. Contrast for every text pair is checked when tokens are rebuilt.

### D4. Typefaces

- Urdu: a true Nastaliq. Jameel Noori Nastaleeq, or Mehr Nastaliq (Lahori style). Replaces Gulzar. Licence for bundling in the apps to be confirmed before use. Mock-ups use Noto Nastaliq Urdu as a stand-in because the chosen faces are not on a web font service.
- Quran Arabic: a true Quranic face. KFGQPC (King Fahd Complex) Uthmanic Hafs, or the QCF page fonts, or AlMushaf. Only for Quran text. Licence to be confirmed.
- No display serif from the poster (Oranienbaum) anywhere in the app, wordmark included.
- Latin: to be chosen next (see Open questions).

## Open questions

- Latin typeface and the type scale.
- Confirm mist and gilt as the colours that go with the green.
- Screen-by-screen content and layout, then components and primitives.
