# Status: ui, member journey screens

Updated: 2026-10-26
Branch: lane/ui/member-journey (cut from lane/ui/member-redesign at 9119f7f; nothing pushed to main, no pull request)
Worktree: `../qc-member-journey`

Scope (from the orchestrator): My Journey, Joined, Updates, Memorisation, Profile, credits and the About / FAQ pages, and the member empty, offline and error states. Home, Nearby, session, venue and the join pledge belong to the "new member app UI" session; Quran and Prayer to the "Quran and Prayer screens" session. Designs: member canvas (https://claude.ai/artifact/PuCDBi5Z9h7zagkmfmRPov), states canvas (https://claude.ai/artifact/DDni9Bv9UzNL8ewm7Vt7Nm).

## Done

- **My Journey** (`screens/JourneyScreen.tsx`): a white tab page (`TabFrame` + `ScreenHeader`). "Circles you are joining" are flat white cards: title, venue and time, a green "Joining · Men" status line (a tag for waiting and cancelled), the reminder switch behind a bell between two hairlines, Directions and Cancel. "Venues and circles you follow" are flat rows (grey icon tile, name, bell for alerts, a close button to unfollow, named with the venue). Days read and Memorisation follow as in the drawing. Nothing joined and nothing followed shows one invitation (`EmptyJourneyState`) instead of two empty sections; a person with one of the two keeps the normal page with the small empty note for the other.
- **Days read** (`components/DaysReadCard.tsx`, also on Home): the month count moves to the end of the title row, seven 28 dp dots (green with a tick, plain ring otherwise), then the "I read today" outline pill and "Only you can see your days read." in one row.
- **Memorisation row** (`components/MemorisationEntryCard.tsx`): one flat row between hairlines with the grey tile, title, "N surahs to revise this week" and a chevron.
- **Updates** (`screens/UpdatesScreen.tsx`, `components/UpdateItem.tsx`): `Page` with back, the title, and a check button to mark all as read (only with unread updates). Rows are flat with a coloured tile per kind (clock for a new time, cross for a cancellation, star for a special lecture, megaphone for an announcement), the kind in its colour, the title bold while unread, the body, the date, "Go to session" and a green dot while unread.
- **Memorisation** (`screens/MemorisationScreen.tsx`): `Page`. Private note with a shield, "Revise this week" (Arabic name, last revised line, a ring tick button named for the surah), "Your surahs" (number ring, name, status tag: Memorised green, Revising gold, Learning grey), the surah picker and the status sheet as before. **The four count tiles on the old green header are gone**: the drawing has none.
- **Profile** (`screens/ProfileScreen.tsx`): `Page`. Avatar, name and number; name field; Language, Text size (with the sample line), Appearance, Alerts, Reading; then a flat list: About you (shown faded with "Coming soon": nothing is behind it yet), Sign out, Delete my account (red), Help and contact, About Quran Circles, About and credits, and the version. **The three quick tiles are gone** (My Journey is a tab; Updates is the bell on Home).
- **Credits** (`screens/CreditsScreen.tsx`): `Page`, the eight-point star with the intro sentence, group headings and flat cards, links with an arrow.
- **About / Help pages** (`screens/ContentPageScreen.tsx`, `features/content/faq.ts`): the body edited in the console is read as paragraphs. A one-line paragraph that ends in `?` or `؟` and has an answer under it becomes a question card that opens and closes (the first two start open); everything else is plain paragraphs, so About pages and notes read as written. The footer says "Updated {date}". There is no "Message us on WhatsApp" button yet: the app has no support number in its configuration (question below).
- **States** (`components/StateView.tsx`): `StateView` (tinted ring, title, one sentence, a main action and an outline action) with presets `NoCirclesState`, `LoadErrorState`, `OfflineState`, `EmptyJourneyState`. `QueryBoundary` now draws `OfflineState` / `LoadErrorState`, so every screen that uses it has the new error and offline look. The offline banner on `Page` and `TabFrame` says "You are offline. Showing what was saved on your phone." (`states.offline.banner`).
- **Joined**: `JoinDone` in `RegistrationScreen.tsx` already matches the drawing (tick ring, "You are joining this circle", the card with venue, time and "Joining · Men", "See it in My Journey" and "Done"), so I left that file to the join-pledge session.
- **Wrong code**: the code step of Sign in already shows the field in error with "That code is not right. Please check it and try again." (`errors.otp_invalid`) under the field and the resend countdown; checked, not changed.
- `IconTile` has a `tone="fill"` for the grey tile of the white-page lists.
- Strings: `states.*`, `journey.follows.unfollowNamed`, `content.updated`, in English and Urdu (Urdu are the drafts from the drawings, under the file's review marker).

## For the other member sessions (not done here, to keep clear of their files)

- **Nearby** should draw `NoCirclesState` (`onWiden`, `onAsk`) for "no circles in this area" and `LoadErrorState` (with `onSaved` when the phone holds a saved list) for a failed list. Both are exported from `components/StateView.tsx`.
- **Home offline**: the drawing shows the saved next-circle card with a disabled "Joining needs internet" button and a "Saved at 6:40 pm" line, plus a quiet "Try again". The banner part is done through `TabFrame`; the card part is `NextCircleCard`, which that session owns. Suggested keys, not added yet: `states.offline.joinNeedsInternet`, `states.offline.savedAt`.

## Questions for the orchestrator

- Where does the help page's "Message us on WhatsApp" number come from? No support contact exists in `config.get`. If a number should be added it is an API/config change (not mine).
- The drawing shows icon-only Directions and Cancel on a registration, and an icon-only reminder switch. I kept the words (Directions, Cancel, "Remind me before this session") beside the icons: clearer for elders and keeps the spoken name equal to the visible one. Say if you want the icon-only version.

## Checks

Last run (2026-10-26): `@qc/user-app` typecheck clean, eslint clean, prettier clean on my files, `@qc/i18n` 40/40, `@qc/user-app` 1165 of 1168 pass.

- Tests brought up to the new designs: Memorisation (no count tiles; status tag on the row; revise button named for the surah), My Journey (empty state leads to Nearby through `states.journey.find`), Profile (flat list, no quick tiles), Updates/Profile/Credits (the `Page` top bar now carries `testID="screen-header"`).
- **3 failures are not mine**: `redesign.test.tsx` > Registration (R2) (heading, women-only fade, section pictures). They assert the old registration screen; the join-pledge session replaced it and owns those tests (`RegistrationScreen.tsx` is unchanged here).
