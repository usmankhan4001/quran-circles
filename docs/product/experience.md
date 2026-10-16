# Experience: navigation, look and accessibility

## Navigation

Four tabs, with Quran and prayer times sharing one because they support the app rather than define it.

| Tab              | Holds                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home             | Season-aware: Dora leads around Ramadan, Circles otherwise. Next session near you or for your circles, the Updates feed with an unread badge, small cards for the next prayer and "continue reading" |
| Nearby           | Map and list of Dora venues and circles, area search, filters for day and time, section, language and area. Offers "Request a circle near me" when none is close                                     |
| My Journey       | Registrations, followed venues and circles, per-session reminders, circle progress, and the session companion                                                                                        |
| Quran & Prayer   | Quran reader with Urdu translation, bookmarks, last read and an offline copy; prayer times with a countdown and the Hijri date                                                                       |
| Profile (avatar) | Language, text size, dark mode, alerts per venue, account and delete, support, About                                                                                                                 |

The English tab names are decided. A native Urdu speaker checks the Urdu equivalents.

## Look

Keep the V1 brand: emerald `#064e3b`, gold `#d4af37`, parchment `#fdfcf6`, slate `#0f172a`. DM Sans for English, Gulzar for Urdu, AlMushaf for Quran text. Spacing, type scale and components become shared tokens in `packages/ui`, so a change is made once. Gold is a decoration colour: do not use it for body text, because it fails contrast on parchment.

## Accessibility

- Text size control across the whole app, not only the reader: four steps.
- Dark mode and high contrast.
- Touch targets of at least 48 dp.
- Body text contrast of at least 4.5:1.
- Every screen works left-to-right and right-to-left.
- The elders who use the app are a design target: plain wording, large defaults for key actions.

## Admin experience

The admin app covers the top phone tasks only. Reports, bulk import and exports live in the desktop web console. The console and the apps share the API client and design tokens, but not components.
