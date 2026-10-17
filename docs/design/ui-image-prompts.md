# Quran Circles: complete UI design brief

This brief lists **everything the design has to cover**: every mode, primitive, component (micro and macro), component group, screen and state, with the real content and data each one shows. It does **not** set the look. The visual style, colours, type, shapes and layout choices are the designer's (or Figma's) to decide. The only suggestions are in section 11, and they can be ignored.

Use it in three ways:

- **As a Figma / AI brief:** paste section 1 (product context) first, then the part you want designed.
- **As a checklist:** sections 2 to 9 are the full inventory; section 12 is the list of frames to produce.
- **As a content source:** section 3 has realistic sample data so no frame needs lorem ipsum.

Send the results back in this thread, named `<app>-<screen or component>-<variant>.png`, for example `user-home-light-en.png`, `admin-attendance-dark-ur.png`, `comp-button.png`.

---

## 1. Product context (paste this before any prompt)

> **Quran Circles** is a Pakistani app that helps people find, join and keep up with Quran study circles (halaqa, dars-e-Quran) and the Ramadan **Dora-e-Quran** (night programmes where the Quran is recited and explained with Urdu tafsir, usually after Taraweeh) at masjids, academies and homes near them. It is run by Tanzeem-e-Islami volunteers.
>
> **Three products share one design system:**
>
> 1. **User app** (iOS, Android, mobile web): for attendees. Browse without an account; sign in with a WhatsApp code to register, follow venues and keep a journey. Tabs: Home, Nearby, Quran & Prayer, My Journey; plus Updates and Profile.
> 2. **Admin app** (iOS, Android): for venue and city coordinators on their phones at the masjid. Tabs: Today, Places, Updates, Account.
> 3. **Console** (desktop web): for city coordinators and national admins. Pages: Sessions, Venues, Coordinators, Exports, Bulk import, Audit log, Settings.
>
> **People:** attendees of every age, many older or first-time smartphone users, men and women attending separate sections (Women, Men, Family). Coordinators are volunteers, not tech staff. Everything is bilingual: **English** and **Urdu** (right-to-left, Nastaliq script). Quran text is Arabic in Uthmanic script.
>
> **Feeling:** calm, respectful, devotional, trustworthy and simple. Add Islamic character throughout the design.
>
> **Hard requirements:** WCAG 2.1 AA contrast, touch targets at least 48 × 48, text that scales to 4 sizes without breaking, full right-to-left mirroring for Urdu, every data view has loading, empty, error and offline states, and nothing relies on colour alone.

---

## 2. Modes and variants

Every screen and component must work in all of these. Not every combination needs its own frame (see section 12), but the system must support them.

| Axis                   | Values                                                                                                          | What changes                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour mode            | Light, Dark, Same as device                                                                                     | All colour roles. Dark is also used automatically at night if the user chooses.                                                                                                        |
| Contrast               | Standard, High contrast                                                                                         | Stronger borders, no tinted text on tinted fills, no low-opacity decoration, focus rings thicker.                                                                                      |
| Language and direction | English (LTR), Urdu (RTL)                                                                                       | Script, line height (Nastaliq needs about 1.9–2.2× line height), full layout mirroring, directional icons flip (back, chevron, arrows, progress), numbers stay Western digits and LTR. |
| Text size              | Standard, Large, Larger, Largest (4 steps)                                                                      | All type roles scale; layouts must wrap, not truncate key info; buttons grow in height.                                                                                                |
| Time of day            | Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha/Night                                                                  | The Home header (and optionally the whole app) reflects the current prayer period.                                                                                                     |
| Season                 | Dora (Ramadan) season, Circles (rest of year)                                                                   | Home leads with Dora programmes or with weekly circles; copy and featured content change.                                                                                              |
| Auth                   | Signed out (browsing), Signed in                                                                                | Signed-out users see everything public; registering, following, journey and bookmarks sync ask them to sign in.                                                                        |
| Role (admin, console)  | Venue coordinator, City coordinator, National admin                                                             | Scope of data, available pages and actions (approvals, settings, imports).                                                                                                             |
| Network                | Online, Offline (with saved data), Offline (nothing saved), Reconnecting                                        | Banners, disabled actions, "saved on this phone" states, queued writes.                                                                                                                |
| Data state             | Loading (first), Refreshing, Loaded, Empty, Partial, Error, Not found, Forbidden                                | Each list, card and screen.                                                                                                                                                            |
| Platform               | iOS, Android, Mobile web, Desktop web                                                                           | Status bar, safe areas, back gestures, system sheets, keyboard, date and time pickers.                                                                                                 |
| Device size            | Small phone (360 × 640), Standard (390 × 844), Large (430 × 932), Tablet (optional), Desktop (1280, 1440, 1920) | Layout density and columns.                                                                                                                                                            |
| Motion                 | Full, Reduced motion                                                                                            | Animations become fades or none.                                                                                                                                                       |

---

## 3. Data and sample content

Use this real-looking content in every frame. Pakistani names and places; times in Pakistan time.

### 3.1 Places

- **City:** Karachi (also Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad). Province, city and area names exist in English and Urdu.
- **Area:** Saddar, Gulshan-e-Iqbal, North Nazimabad, DHA Phase 6, Clifton, Malir, Model Town (Lahore), F-8 (Islamabad).
- **Venue** fields: name (EN, UR), address (EN, UR), area, city, map location, public contact phone (optional), status (Active, Archived), facilities:
  - Women's section (yes or no)
  - Parking
  - Wudu area
  - Access for elders and wheelchairs
  - Child friendly
  - How to find the entrance (free text, EN and UR)
- Sample venues: Masjid Al-Noor (Saddar), Jamia Masjid Tooba (DHA), Quran Academy (Gulshan-e-Iqbal), Masjid Al-Huda (North Nazimabad), Baitul Mukarram (Gulshan).
- Sample entrance note: "Women's entrance is on the side lane next to the pharmacy."

### 3.2 Sessions and occurrences

- **Session** fields: programme (Dora or Circles), kind (Recurring or One-off), title (EN, UR), description, section (Women, Men, Family), language (Urdu, English), start time, duration, days of week, start date, end date, venue, circle (name, teacher, online link), registration (on or off, capacity or no limit, seats taken, full), status (Draft, Published, Cancelled, Archived), next occurrence.
- **Occurrence** (one meeting) fields: start, end, status (Scheduled, Cancelled, Done), portion (Para 1–30, Surah 1–114, Ayah range, or a named Lesson) and its label, recap note (EN or UR), headcount (admin only).
- Sample sessions:
  - "Taraweeh with Dora", Dora, every night of Ramadan, 9:00 pm, 2 h 30 min, Women, Urdu, 60 seats, 42 taken, today's portion Para 3 (Al-Baqarah 142–252).
  - "Dars-e-Quran", Circles, every Friday 7:30 pm, 1 h, Men, Urdu, no limit, teacher Ustadh Kamran Ahmed.
  - "Family Tafsir Circle", Circles, Sunday 11:00 am, Family, Urdu, 30 seats, full, waiting list on.
  - "Special lecture: Surah Al-Kahf", One-off, Saturday 8:00 pm, Family, English, online link available.

### 3.3 People and registrations

- **Me (user):** Ayesha Khan, +92 300 1234567, language Urdu, area Saddar. Profile (all optional): age band (Under 18, 18–24, 25–34, 35–44, 45–54, 55–64, 65+), profession, education, Quran reading so far (None, Basic, Regular, Advanced), preferred language.
- **Registration** fields: session, occurrence (or whole series), area, section, party size (1–20), status (Registered, Waiting list with position, Cancelled), created, WhatsApp reminders on or off.
- **Follows:** venues or circles followed, each with alerts on or off.
- **Bookmarks:** Ayah, Surah or Para, optional note, date.
- **Reading position:** surah and ayah, last updated.
- **Circle request:** area, preferred days, section, language, status (Active, Fulfilled, Cancelled, Expired), expiry.
- **Consents:** channel (WhatsApp, SMS, Push, Email) × purpose (Registration updates, Session reminders, Venue alerts, Announcements).

### 3.4 Coordinators and admin

- **Roles:** National admin (all of Pakistan), City coordinator (one city), Venue coordinator (one venue).
- Sample coordinator: Ustadh Kamran Ahmed, Venue coordinator, Masjid Al-Noor. City coordinator: Bilal Siddiqui, Karachi.
- **Staff registration row:** name (or "No name"), phone, area, section, party size, status, WhatsApp allowed, registered at.
- **Attendance:** headcount (0–5000), ticked registrants, extra named entries with counts, marked at.
- **Circle** statuses: Draft, Waiting for the city coordinator, Published, Not approved (with reason), Archived.
- **Invites:** phone, name, role, scope, status (Waiting, Accepted, Expired, Cancelled), expiry.
- **Audit entry:** when, who (or System), action, record type, record, where.
- **Settings:** Hijri date adjustment (−2 to +2 days), season on Home (Dora or Circles), WhatsApp messages per person per day (0–5), circle request alert level (1–1000).
- **Message templates:** key, channel, language, body with variables, cost category, status.

### 3.5 Updates and notifications

- **Update** kinds: Announcement, Time change, Cancellation, Special lecture. Scope: National, City, Venue. Title, body, linked session, published at, read or unread. Admin view adds author and number of recipients.
- Sample: "Time change: Taraweeh with Dora. Tonight starts at 9:15 because of rain." / "Cancelled: Dars-e-Quran this Friday." / "Special lecture on Surah Al-Kahf, Saturday 8 pm."
- Push notifications: Session reminder ("Taraweeh with Dora at Masjid Al-Noor, tonight 9:00"), A seat opened up, Time change, Cancelled.

### 3.6 Prayer and Quran

- Prayer times for the chosen city: Fajr 5:12, Sunrise 6:31, Dhuhr 12:18, Asr 3:52, Maghrib 6:04, Isha 7:25. Next prayer and countdown ("Maghrib in 1 h 20 min").
- Hijri date ("16 Rabi al-Thani 1448") with the note "The Hijri date follows moon sighting in Pakistan."
- Quran: 114 surahs (name EN, name AR, meaning, verses, Makki or Madani), 30 paras, Rub el Hizb markers, Urdu translation per ayah, bookmarks, offline download per para.

---

## 4. Primitives (foundations)

Define each set; values are the designer's choice (see section 11 for suggestions).

### 4.1 Colour roles

- **Brand:** primary, primary pressed, on-primary, primary container (tonal), on-primary-container.
- **Accent:** a second brand colour for sacred moments (Quran, prayer), its container and on-colour.
- **Neutrals:** page background, surface (cards), raised surface (sheets, dialogs), sunken surface (inputs, wells), overlay scrim.
- **Text:** primary, secondary, tertiary or hint, disabled, inverse, link.
- **Borders:** hairline, default, strong, focus ring.
- **Status:** success, warning, error, info. Each has a solid, a container and an on-container colour.
- **Domain:** section colours or markers if any (Women, Men, Family), registration status (Registered, Waiting list, Cancelled), circle status (Draft, Pending, Published, Not approved, Archived), occurrence status (Scheduled, Cancelled, Done), update kinds (Announcement, Time change, Cancellation, Special lecture).
- **Time of day:** a background set for each prayer period (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Night).
- **Map:** land, water, roads, labels, pin, selected pin, cluster, user location.
- **Every role** in Light, Dark and High contrast.

### 4.2 Typography

- **Families:** a Latin UI face; an Urdu Nastaliq face (Jameel Noori Nastaleeq or Mehr Nastaliq preferred); an Arabic Quran face (KFGQPC Uthmanic Hafs, QCF or Al_Mushaf preferred); a numeric style (tabular figures for times and counts).
- **Roles:**
  - Display / countdown
  - Large time
  - Screen title
  - Section title
  - Card title
  - Body
  - Body small
  - Label / button
  - Caption
  - Eyebrow / overline
  - Numeric stat
  - Quran verse
  - Quran translation
  - Tab label
  - Badge
- **For each role:** EN size, weight and line height; UR size and line height; behaviour at the 4 text sizes.
- **Rules:** maximum line length, truncation (and where it is never allowed: times, venue names, statuses), and how numbers sit inside Urdu text.

### 4.3 Spacing and layout

- **Spacing scale:** base unit and steps.
- **Phone layout:** screen margins, gaps between cards, padding inside cards, gaps between sections, list row heights.
- **Grid:** phone 4-column, tablet 8-column, desktop 12-column with sidebar.
- **Breakpoints:** sizes for phone, tablet and desktop.
- **Safe areas:** status bar, notch, home indicator, Android navigation bar.
- **Minimum touch target:** 48 × 48, with the spacing between targets.

### 4.4 Shape

- **Corner radius scale:** for chips, inputs, buttons, cards, sheets, dialogs, avatars and images.
- **Border widths:** hairline, default, focus.

### 4.5 Elevation and depth

- **Levels:** flat, card, raised (sticky bars), floating (FAB, map card), overlay (sheet, dialog), toast.
- **Shadow per level:** in Light; in Dark, the equivalent through borders or surface tone.
- **Scrim:** opacity for sheets and dialogs.

### 4.6 Iconography

- **Grid and size:** grid size; sizes for inline, list, button, tab, feature and empty-state icons.
- **Drawing rules:** stroke or fill style, corner style.
- **RTL:** which icons mirror.

### 4.7 Imagery and illustration

- **Venue images:** treatment, and the placeholder when there is no photo.
- **Illustrations:** a style for empty states, errors, success and onboarding.
- **Islamic elements:** add them.

### 4.8 Motion

- **Timing:** duration scale (fast, standard, slow) and easing curves.
- **Patterns:** page transitions, sheet in and out, list insert and remove, tab change, pressed feedback, loading skeleton shimmer, success celebration, countdown tick, time-of-day transition.
- **Reduced motion:** the alternative for each.

### 4.9 Interaction states (apply to every interactive component)

Default, Hover (web), Pressed, Focused (keyboard), Selected, Checked, Indeterminate, Disabled, Read-only, Loading, Error, Success, Dragged (if any).

### 4.10 Accessibility primitives

- **Focus:** the focus-ring style.
- **Contrast:** minimum ratios for text, icons and borders.
- **Screen readers:** label patterns for icons, numbers and times. For example, "1 h 20 min" should read as "1 hour 20 minutes".
- **Live regions:** for toasts and countdowns.
- **Order:** heading levels and reading order in RTL.

---

## 5. Icon inventory

These are the icons the app needs. Add Islamic icons wherever they fit.

**Islamic and domain icons:**

| Icon              | Used for                  |
| ----------------- | ------------------------- |
| Man               | Men's section             |
| Woman             | Women's section           |
| Family            | Family section            |
| Child             | Child friendly            |
| Masjid            | Venue, Home tab           |
| Dome              | Venue mark, map pin       |
| Quran             | Quran tab                 |
| Mushaf            | "Bring a mushaf"          |
| Tafsir            | Translation, tafsir       |
| Kaaba             | Qibla                     |
| Qibla compass     | Qibla                     |
| Musalla           | Prayer space              |
| Tasbih            | Dhikr, journey            |
| Wudu              | Wudu area                 |
| Crescent and star | Ramadan, night            |
| Lantern           | Dora, Taraweeh            |
| Mihrab            | Prayer times              |
| Minbar            | Lecture, bayan            |
| Dua hands         | After-session recap, duas |
| Adhan             | Prayer alerts, Updates    |
| Hijri calendar    | Hijri date                |
| Halaqa            | Circles, My Journey       |
| Rub el Hizb star  | Para and juz markers      |
| Para / juz marker | Reading portion           |
| Ayah end marker   | Verse numbers             |
| Wheelchair        | Access                    |
| Parking           | Parking                   |
| Door / entrance   | How to find the entrance  |

**General icons:**

| Group          | Icons                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation     | Home, Nearby/map, List, Search, Filter, Sort, Back, Forward, Chevron in 4 directions, Close, More (horizontal and vertical), External link   |
| Actions        | Share, Heart/follow, Bookmark (empty and filled), Bell (on and off), Edit, Delete, Add, Remove, Check, Copy, Download, Upload, Refresh, Undo |
| Time and place | Clock, Calendar, Pin, Navigate/directions, My location                                                                                       |
| Contact        | Phone, WhatsApp, SMS, Email                                                                                                                  |
| Settings       | Language, Text size, Dark mode, Light mode, Contrast, Settings, User, Sign in, Sign out, Lock, Eye (show and hide)                           |
| Status         | Info, Warning, Error, Success, Offline, Online, Sync, Hourglass (waiting list)                                                               |
| People         | People/group, Person add, Seat, Ticket                                                                                                       |
| Media          | Video/online, Audio                                                                                                                          |
| Console        | Table, Chart, Import (CSV), Export (file), Audit/history, Key/role, Handover, Approve, Reject                                                |

**Variants:** outline and filled, wherever a selected state exists (tabs, bookmark, heart, bell).

---

## 6. Components

For each component, design all **variants**, **sizes** and **states** listed, in Light, Dark and Urdu RTL. Each entry gives its purpose, its parts (anatomy), its content and where it is used.

### 6.1 Micro components (atoms)

1. **Text styles**: one specimen of every type role in EN and UR, at the 4 text sizes.
2. **Icon**: sizes; colour roles; mirrored-in-RTL examples.
3. **Button**
   - **Variants:** primary, secondary (tonal), outline, text/ghost, destructive, destructive-outline, link.
   - **Content options:** icon only, icon and label, label and trailing icon, full width.
   - **Sizes:** small, medium, large.
   - **States:** all of 4.9, including loading (spinner replaces the icon, label stays) and disabled.
   - **Sample labels:** "Register for tonight", "See details", "Get directions", "Follow this venue", "Cancel registration", "Send code", "Try again".
4. **Icon button**: plain, tonal, on-image (translucent), with badge dot, with count badge; sizes.
5. **Floating action button**: icon only and extended ("Add a circle").
6. **Link**: inline in body text, standalone, external.
7. **Badge**: dot, count (1, 9, 99+), "New", on icons and avatars.
8. **Tag / pill / status chip**: registration status (Registered, Waiting list #3, Cancelled), circle status (Draft, Waiting for the city coordinator, Published, Not approved, Archived), session status, occurrence status, update kind (Time change, Cancelled, Special lecture, Announcement), section (Women, Men, Family), programme (Dora, Circle), language (Urdu, English), portion ("Para 3", "Al-Baqarah 142–252"), "Free", "Online", "Seats open", "Full", "Saved on this phone".
9. **Avatar**: initials, image, icon (venue); sizes; group stack ("+3").
10. **Divider**: full, inset, with label, decorative/ornamental.
11. **Spinner / progress indicator**: indeterminate; determinate ring; linear bar with a percentage ("Saving: 64%").
12. **Skeleton blocks**: text line, title, avatar, image, card, list row, table row.
13. **Focus ring**: on every interactive shape.
14. **Tooltip** (web) and **info hint** (mobile, tap to reveal).
15. **Kbd / shortcut hint** (console only, optional).
16. **Number display**: time (9:00 pm / 21:00), countdown ("1 h 20 min"), distance ("1.2 km", "6 min walk"), counts ("42 of 60"), Hijri date, Gregorian date, relative time ("2 h ago").
17. **Seat meter**: taken against capacity, "No limit", full and nearly full versions.
18. **Section marker**: icon and label for Women, Men, Family.
19. **Facility marker**: icon and label for each facility, available and not available.
20. **Star / ordinal marker**: numbered marker for lists (surah numbers, steps).

### 6.2 Inputs and controls

1. **Text field**
   - **Parts:** label, optional or required marker, placeholder, helper text, error text, leading and trailing icon, character counter, clear button.
   - **States:** empty, focused, filled, error, disabled, read-only.
   - **Samples:** "Full name", "Circle name", "Teacher (optional)".
2. **Bilingual text field pair**: English and Urdu inputs side by side or stacked, the Urdu one right-aligned. Used for "Name in English", "Name in Urdu" and addresses.
3. **Multiline text area**: with counter ("48 of 300 characters"); used for update message, recap note, entrance notes, reason.
4. **Phone field**: "+92" prefix, formatting as you type ("0300 1234567"), WhatsApp hint ("We send a code to this number on WhatsApp."), preview ("Will be saved as +923001234567"), errors (empty, invalid, not a mobile number).
5. **OTP / code input**: 6 boxes. States: empty, typing, complete, wrong code, expired, too many attempts. Paste support, plus a resend countdown ("Send again in 24 seconds") and "Use a different number".
6. **Search field**: placeholder ("Search by area or venue", "Find a surah", "Search by name"), clear, recent searches, suggestions dropdown.
7. **Select / dropdown**: closed, open (sheet on mobile, menu on web), with search inside for long lists (areas, venues), selected check, empty result.
8. **Area picker**: city → area, with search.
9. **Checkbox**: single, in a list, indeterminate ("Mark everyone present"), with description.
10. **Radio group**: vertical list and card style ("This session only" / "Every session from now on").
11. **Switch / toggle**: with label and helper ("Send me reminders on WhatsApp", "You can change this any time in Profile.").
12. **Segmented control**: 2–4 options ("Map | List", "Quran | Prayer times", "Regular class | Open drop-in", "English | اردو", "Same as device | Light | Dark").
13. **Chip (filter / choice)**: single and multi select, with icon, with count, removable. Used for days, time of day, language and templates.
14. **Section choice cards**: three large selectable cards (Women, Men, Family), each with an icon, label, selected check and disabled state (for example, "No women's section here").
15. **Stepper (quantity)**: "How many people are coming?", minus and plus buttons, value display (with optional people icons), min and max limits, helper "Count yourself too."
16. **Big number stepper**: the headcount input (0–5000), tap to type.
17. **Slider with steps**: text size (Standard, Large, Larger, Largest) with a live sample sentence.
18. **Date picker**: a calendar with Hijri dates shown under the Gregorian ones, a disabled past, and a range for console filters.
19. **Time picker**: wheel on mobile, input on web; 12 h and 24 h.
20. **Day-of-week picker**: Mon–Sun toggles.
21. **Map pin picker**: a draggable pin with the hint "Place the pin at the entrance", plus a recentre button.
22. **File drop zone (console)**: idle, drag-over, file chosen (name, size), invalid file, uploading.
23. **Form field group**: label, control, helper and error stacked; required and optional conventions; inline validation timing.

### 6.3 Content components (molecules)

1. **List row**: leading (icon, avatar or marker), title, subtitle, meta, trailing (chevron, switch, value, button, checkbox). Single, double and triple line; tappable and static; swipe actions (remove bookmark).
2. **Settings row**: label, current value, chevron or switch.
3. **Key-value row**: "Starts: 9:00 pm", "Teacher: Ustadh Kamran Ahmed".
4. **Fact tile**: icon, value and label (for example, Starts 9:00, Length 2.5 h, For Women, Language Urdu).
5. **Stat tile**: big number, label, optional trend or sparkline ("48 registered", "6 waiting list").
6. **Section header**: title, optional count, optional action link ("See all").
7. **Prayer time item**: name, time, past, current, next and notification-on states.
8. **Prayer times strip**: 5 or 6 items with the next one highlighted.
9. **Countdown block**: next prayer label, countdown, greeting ("Assalamu alaikum, Ayesha").
10. **Hijri date line**: Hijri date, Gregorian date and an info hint.
11. **Venue summary**: image or placeholder, name, area, distance, facility markers, next session line.
12. **Session summary**: title, venue, time, section, language, portion, seats.
13. **Occurrence date block**: day name, date number, month ("Fri 16 Oct").
14. **Portion block**: portion label, Arabic snippet, "Read ahead" link.
15. **Recap block**: "Recap from the coordinator", text, author, date.
16. **Update item**: venue avatar, venue name, kind tag, title, body preview, time, unread marker, linked session.
17. **Registrant row (admin)**: name or "No name", area, section marker, party size, status tag, call and WhatsApp buttons.
18. **Attendance row (admin)**: checkbox, name, party size, present state.
19. **Surah row**: number marker, English name, meaning, verse count, Makki or Madani, Arabic name, saved-offline marker.
20. **Verse block**: Arabic ayah with an end marker and number, Urdu translation, bookmark and share actions, highlighted state.
21. **Bookmark row**: kind, Arabic snippet, surah and ayah, note, date.
22. **Follow item**: venue or circle avatar, name, alerts switch.
23. **Coordinator row (console)**: person, phone, role tag, scope, since, actions.
24. **Invite row (console)**: person, phone, role, scope, expires, status, actions (Send again, Cancel invite).
25. **Audit row**: when, who, action, record, where.
26. **Import issue row**: line, column, kind (Fix or Note), message.
27. **Notification preview**: how a push and a WhatsApp message will look (admin "Post an update").
28. **Template chip / card**: update templates ("Time changed", "Cancelled", "Bring a mushaf", "Write my own").
29. **Breadcrumbs (console)**.
30. **Pagination / "Show more"**.

### 6.4 Cards (macro)

1. **Next session card** (Home): eyebrow ("Your next session" or "Next session near you"), session summary, big time, relative day ("tonight"), meta, primary action ("See details" or "Register"), directions action. States: registered, not registered, signed out, cancelled, time changed, starting now, live online.
2. **Session card** (lists, carousels): compact and full.
3. **Venue card** (Nearby list): states with and without an image; a "Women's section" highlight.
4. **Map preview card**: the selected venue over the map, in collapsed and expanded heights.
5. **Continue reading card**: surah and ayah, Arabic line, progress, action ("Continue" or "Start reading").
6. **Prayer times card**: city, Hijri date, strip, change city.
7. **Qibla card**: compass, degrees, calibration hint.
8. **Registration card** (Journey): date block, session summary, status, waiting list position, reminder switch, cancel action, past or upcoming.
9. **Journey summary card**: season stats (nights attended, para reached, circles), progress through 30 nights or 30 paras.
10. **Circle progress card**: juz or para timeline with "Reached: Para 9".
11. **Update card**: full update with linked session button.
12. **Occurrence card (admin)**: date, time, status, counts (registered, people, waiting list), headcount if done, actions (Registrants, Attendance, Change time, Post update).
13. **Approval card (admin, city)**: "1 circle waiting for your approval" with Approve and Do not approve.
14. **Profile header card**: avatar, name, phone, role tags (admin).
15. **Empty-state card**: illustration, title, body, action.
16. **Request a circle card**: a prompt when there are no results.
17. **Ticket / confirmation card**: after registering, with session, date, section and party size.
18. **KPI card (console)**: number, label, change, sparkline.
19. **Privacy notice card**: "These are real people. Names and numbers are only for running the session."

### 6.5 Navigation

1. **Status bar** (iOS and Android, light and dark content).
2. **Top app bar**: large title; compact with back and title; with actions; transparent over a hero; with search; with step counter ("1 / 3"); with a progress bar.
3. **Bottom tab bar**:
   - **User app:** Home, Nearby, Quran & Prayer, My Journey (and decide where Updates and Profile live).
   - **Admin app:** Today, Places, Updates, Account.
   - **States:** active, inactive, with badge, pressed.
   - **Variants:** Light, Dark, Urdu reversed order.
4. **Segmented tabs / sub-navigation** inside a screen.
5. **Stepper / progress for flows**: "Step 1 of 3", segments, labels.
6. **Console sidebar**:
   - **Content:** logo and "Quran Circles console", nav items with icons (Sessions, Venues, Coordinators, Exports, Bulk import, Audit log, Settings), the current user with their role, and a footer with Language, Colours (Same as device, Light, Dark), Text size and Sign out.
   - **States:** collapsed and expanded; active item; items hidden by role.
7. **Console top bar**: page title, filters, search, actions, user menu.
8. **Skip link** ("Skip to main content"), shown on focus.
9. **Deep-link landing**: a screen opened from a notification or a WhatsApp link, with a back-to-Home path.

### 6.6 Overlays and feedback

1. **Bottom sheet**: grab handle, title, close, content, sticky footer; heights (peek, half, full); scrollable. Used for Filters, Select, Share and Cancel confirmation on mobile.
2. **Dialog / alert**: title, body, 1–2 actions; destructive variant. Samples:
   - "Cancel your registration?" (Keep it / Yes, cancel)
   - "Delete your account?"
   - "Send to 312 people?" (Not yet / Send)
   - "Archive this venue?"
   - "Remove access?"
   - "Import these rows?"
3. **Action sheet / context menu**: row overflow actions.
4. **Toast / snackbar**: success ("Attendance saved."), info, error, with an action ("Undo"), offline-saved ("Saved on this phone. We will send it when you are online.").
5. **Banner (inline, persistent)**: offline ("You are offline. Showing what we saved earlier."), time changed, cancelled, waiting list, registration closed, location off, read-only list ("This list is from 6:42 pm"), Hijri note, forbidden.
6. **Full-screen states**: loading, empty, error ("Something went wrong" / "Try again"), offline ("You are offline"), not found ("We could not find this venue"), forbidden ("You cannot open this page"), update required (minimum app version), maintenance.
7. **Success screen**: registered, waiting list, update posted, import finished.
8. **Permission prompts (pre-prompt screens)**: location ("Use my location"), notifications, before the system dialog.
9. **Pull to refresh** indicator.
10. **Inline validation messages**.
11. **Coach mark / first-use hint** (optional): for example, "Tap the bookmark on any verse."

### 6.7 Map components

Map base style (Light and Dark), venue pin, selected pin, pin with label, cluster pin with count, user location dot with accuracy halo, recentre button, zoom controls (web), map attribution, "Search this area" button, the map and list toggle, an empty map state, a location-off state, and the map preview card.

### 6.8 Quran reader components

Surah header (Arabic title, Bismillah, surah info), verse block, ayah end marker, para / juz / hizb markers in the margin, translation block, reader toolbar (text size, translation on or off, bookmark, offline save), page and scroll modes, a verse highlighted from "Continue reading", an offline-unavailable block ("This part is not saved. Connect to the internet to read it."), and a surah / para / bookmarks switcher.

### 6.9 Console (desktop) components

1. **Data table**: sortable headers, row hover, row selection, sticky header, column alignment for numbers, cell types (text, tag, number, date, avatar, actions), loading rows, empty table, error row, a caption, responsive overflow.
2. **Filter bar**: city, venue, status, dates, "All", and a clear option.
3. **Detail drawer / side panel**.
4. **Page header**: title, intro sentence, primary action.
5. **Form panel**: invite, handover, settings.
6. **Import wizard**: kind choice (Venues, Coordinator invites, Sessions, each with a hint), file step, check summary (Rows, Ready, Already there, Need fixing), issues table, confirm, progress ("Importing 12 of 38"), result, stopped part-way.
7. **Export builder**: target (session, venue, city), filters, "1 session will be exported" preview, progress ("Exported 3 of 8 sessions"), done, failed, privacy notice.
8. **Registrations view**: totals bar (Registrations, People, On the waiting list) and the table.
9. **Settings form**: Hijri adjustment selector (−2 to +2), season choice, numeric inputs with validation.

---

## 7. Component groups and patterns

1. **Sign-in pattern**: phone → code → signed in; "browse without an account"; the no-access state for admin and console ("This number cannot open the console").
2. **Registration flow pattern**: who is coming (section and party size) → details (name, phone, area, WhatsApp consent) → code (if not signed in) → success or waiting list. Includes "already registered", "registration closed", "session full", "session cancelled" and "occurrence in the past" errors.
3. **Discovery pattern**: search, filters (day, time, section, language, area), results as map or list, result count, sort, empty with "Request a circle near me".
4. **Detail page pattern**: hero, title, status tags, facts, primary content, secondary sections, sticky footer action.
5. **Feed pattern**: grouped by date (Today, Yesterday, This week), unread markers, mark all as read, filter chips.
6. **Settings pattern**: grouped rows, immediate-apply switches, a save-required form section ("Save" / "Saved.").
7. **Admin task pattern**: pick the occurrence → act (registrants, attendance, change time, post update) → confirm → toast; works offline with a queue.
8. **Approval pattern**: draft → send for approval → waiting → approve, or not approve with a reason.
9. **Destructive pattern**: action → confirm dialog → result toast; never one tap.
10. **Offline pattern**: banner, cached content timestamp, disabled actions with an explanation, queued writes, sync on reconnect.
11. **Empty / error / loading pattern** for every list and card.
12. **Bilingual content pattern**: content shown in the user's language with a fallback to the other, and admin forms that ask for both.
13. **Time-aware pattern**: content and visuals that change with prayer time and season.
14. **Notification-to-screen pattern**: a push or WhatsApp message opens the right screen with context highlighted.

---

## 8. User app screens

For each screen, design: the default (Light, EN), Dark, Urdu RTL, and every state listed. Regions are listed top to bottom.

### 8.1 Launch and onboarding

1. **Splash**: app mark, name, optional tagline.
2. **Welcome**: what the app does in one line; a language choice (English / اردو); Continue; "Already registered? Sign in".
3. **Choose city / location**:
   - **Actions:** "Use my location", or search and pick a city from the list.
   - **Explanation:** "We need your city to show prayer times."
   - **States:** location denied, no results.
4. **Notifications pre-prompt** (optional): why reminders help, with Allow and Not now.

### 8.2 Sign in

1. **Phone**:
   - **Content:** title "Sign in", the WhatsApp explanation, the phone field and "Send code".
   - **Note:** "You can browse without an account."
   - **States:** invalid number, rate limited ("Too many tries. Please wait a little and try again.").
2. **Code**:
   - **Content:** "Enter the code", "We sent a 6-digit code to +92 300 1234567 on WhatsApp.", the OTP boxes, Confirm, the resend countdown and "Use a different number".
   - **Errors:** wrong, expired, too many attempts.
3. **Account suspended**: "This account is not active. Please contact support."

### 8.3 Home (tab)

- **Regions:**
  - **Header:** app mark and name, notifications button with unread badge, profile entry.
  - **Prayer block:** greeting, next prayer and countdown, the strip of today's prayer times, Hijri date; reflects the time of day.
  - **Next session card:** registered or nearby.
  - **Quick actions:** Nearby, My Journey, Updates, Qibla (or as decided).
  - **Season block:** "Dora near you" (Ramadan) or "Circles near you", as a horizontal list of session cards.
  - **Continue reading card.**
  - **Updates preview:** two latest items and "See all updates".
  - **Request a circle prompt:** when nothing is nearby.
- **States:**
  - signed out
  - signed in with no registrations
  - signed in and registered
  - session starting soon
  - session time changed
  - session cancelled
  - no city chosen ("Choose your city")
  - offline ("You are offline. Showing what we saved earlier.")
  - loading
  - error
  - Dora season and Circles season
  - each prayer period, especially Night

### 8.4 Nearby (tab)

1. **Map view**: title, search, filter button with an active-filter count, map/list toggle, quick filter chips, the map with pins and clusters, "Use my location", the selected venue preview card.
2. **List view**: result count ("12 places near you"), sort, venue cards, "Request a circle near me" at the end.
3. **Filters sheet**:
   - **Groups:**
     - Day (Any, Mon–Sun)
     - Time (Morning, Afternoon, Evening, Night)
     - Section (Women, Men, Family)
     - Language (Urdu, English)
     - Area
   - **Actions:** "Clear filters", "Show results".
4. **Search results**: as you type, matching areas and venues.
5. **States:**
   - loading map
   - loading list
   - no results ("No sessions found" / "Try another day or area, or ask for a circle near you.")
   - location off ("Location is off. Search by area instead.")
   - offline ("Showing places we saved earlier.")
   - error

### 8.5 Venue detail

- **Regions:**
  - **Hero:** image or placeholder, back, share, follow.
  - **Header:** name and area.
  - **Action row:**
    - "Get directions"
    - "Call the venue"
    - "Follow this venue" / "Following"
  - **Facilities:** list or grid ("The coordinator has not added facilities yet." when empty).
  - **Entrance:** "How to find the entrance" note.
  - **Address:** text and a small map.
  - **Sessions:** list ("No sessions here yet." when empty).
  - **Invite:** "Invite a friend or family" (share).
- **States:** following, not following, signed out (following asks to sign in), not found ("We could not find this venue" / "It may have been removed. Go back to Nearby to find another."), archived, loading, offline.

### 8.6 Session detail

- **Regions:**
  - **Hero and status tags:** programme, seats, portion.
  - **Header:** title, venue link.
  - **Facts:** when (schedule, "Every Friday at 7:30 pm", "Next: Fri 16 Oct"), duration, section, language, teacher.
  - **Content:** description; "Today's portion" with "Read ahead"; seats ("18 seats left", "1 seat left", "No limit"); venue card with walking distance; online link ("Join online") if present; "After the session" recap if present.
  - **Sticky footer:** price ("Free") or note, and the primary action.
- **States:**
  - open
  - few seats left
  - full ("This session is full." + "Join the waiting list")
  - already registered (status and reminder; cancel)
  - waiting list (with position)
  - registration off (information only)
  - cancelled ("This session is cancelled.")
  - time changed ("The time changed. New time: …")
  - happening now
  - finished, with a recap
  - one-off
  - online only
  - signed out
  - loading
  - not found
  - offline

### 8.7 Register (flow)

1. **Step 1, who is coming**: session summary, section choice (only sections this session allows), party size stepper ("Count yourself too."), WhatsApp reminder consent ("You can change this any time in Profile.").
2. **Step 2, your details**:
   - **Fields:** full name, WhatsApp number, your area.
   - **Note:** privacy.
   - **Prefill:** skipped or prefilled when signed in.
3. **Step 3, code**: when not signed in.
4. **Success**: "You are registered" / "We will remind you before the session.", a ticket card, "See it in My Journey", "Done", add to calendar.
5. **Waiting list success**: "You are on the waiting list" / "We will tell you if a seat opens."
6. **Errors**: already registered, registration closed, session full, session cancelled, session already happened, validation errors per field.

### 8.8 Quran & Prayer (tab)

1. **Quran home**:
   - **Content:** segmented Quran / Prayer times, "Continue reading" (or "Start reading"), search ("Find a surah"), surah / para / bookmarks switcher, surah list, offline status per item.
   - **States:** first use, offline, loading.
2. **Reader**:
   - **Content:** surah header, verses with Urdu translation toggle ("Show Urdu translation"), text size, bookmark per verse (Add / Remove bookmark), share verse, para markers, reading position saved, "Save for offline reading" with progress ("Saving: 64%", "Saved on this phone").
   - **States:** part not saved and offline; Light, Dark and sepia (if wanted).
3. **Para list** and **Para reader** (same reader, by para).
4. **Bookmarks**: list; empty ("No bookmarks yet. Tap the bookmark on any verse."); edit note; remove.
5. **Prayer times**:
   - **Content:** city ("Times for Karachi") with change; Hijri and Gregorian date with the moon-sighting note; next prayer and countdown; the six times with past, current and next states; an alert toggle per prayer.
   - **Extras:** qibla compass, monthly timetable (optional).
   - **States:** no city ("Choose your city" / "We need your city to show prayer times.").
6. **Qibla**: compass, direction in degrees, calibration and accuracy states, location off.

### 8.9 My Journey (tab)

- **Regions:**
  - **Summary:** this season's stats and progress.
  - **"Your registrations":** upcoming and past, each with status (Registered, Waiting list, Cancelled), a reminder toggle ("Remind me before this session") and "Cancel registration".
  - **"Circle progress":** "Reached: Para 9".
  - **"Session companion":** "Recap from the coordinator" (or "No recap yet.").
  - **"Venues and circles you follow":** or "You are not following anything yet."
- **States:** signed out ("Sign in to see your journey" / "You can browse without an account. Sign in to register and follow." / "Sign in"), no registrations ("You have not registered yet" / "Find a session near you and register in a tap." / "Find a session"), loading, offline, error.
- **Cancel dialog:** "Cancel your registration?" / "You can register again later if there is room." / "Yes, cancel" / "Keep it".

### 8.10 Updates

- **Regions:** title, unread count ("3 unread"), filter (All, Unread, by venue), "Mark all as read", the feed grouped by date, each update item linking to its session or venue.
- **States:** empty ("No updates yet. Follow a venue to hear from it."), new updates arriving ("New updates" pill), loading, offline, error.
- **Update detail:** full title and body, venue, time, linked session button.

### 8.11 Profile and settings

- **Regions:**
  - **Header:** name, phone.
  - **Language:** English / Urdu.
  - **Text size:** 4 steps with the sample "This is how your text will look."
  - **Appearance:** Dark mode, High contrast.
  - **Alerts:** per followed venue ("Alerts for Masjid Al-Noor"), or "Follow a venue to set its alerts."
  - **WhatsApp reminders.**
  - **About you:** optional fields with the explanation "These are optional. They help coordinators plan."; Save / Saved.
  - **Account:** Help and support, About Quran Circles, Sign out, Delete my account.
- **States:** signed out (only language, text size and appearance, plus Sign in), saving, saved, error.
- **Delete account dialog:** "Delete your account?" / "This removes your registrations and personal details. It cannot be undone." / "Delete my account" / "Keep my account".

### 8.12 Other user screens

1. **Content page** (About, Help, Privacy, Terms): title, rich text (headings, paragraphs, lists, links, quote), contact options.
2. **Request a circle**:
   - **Fields:** area, preferred days, section, language.
   - **Submit:** sends the request.
   - **Result states:** success; already requested ("You have already asked for a circle in this area."); my active requests with status and expiry.
3. **Notifications permission settings / system-blocked state.**
4. **Not found** (bad link).
5. **Update required** (minimum version).
6. **Share sheet content**: what a shared venue or session link looks like (link preview card for WhatsApp).

---

## 9. Admin app screens (coordinators)

Same modes. Role differences are noted.

1. **Sign in**: phone → code; no access ("This number has no access" / ask a coordinator to invite you); invite accepted (welcome with role and scope).
2. **Today (tab)**:
   - **Header:** greeting, role and scope ("Venue coordinator · Masjid Al-Noor").
   - **Today's occurrences:** each an occurrence card with counts and quick actions (Registrants, Attendance, Post update, Change time).
   - **Then:** "This week" list.
   - **City coordinator only:** pending approvals ("1 circle waiting for your approval") and circle requests in their areas.
   - **States:** nothing today, offline, loading.
3. **Places (tab)**:
   - **Content:** venues in scope, each with circles and sessions and their statuses; search.
   - **Add actions:** "Add a venue" (city and up), "Add a circle".
   - **States:** archived venues toggle, empty.
4. **Venue editor** (new and edit):
   - **Fields:** Name in English, Name in Urdu, Address (EN, UR), Area, map pin ("Place the pin at the entrance"), venue phone ("Everyone can see this number."), facilities ("Tick what the venue has."), "How to find the entrance".
   - **Actions:** "Save venue" / "Venue saved."; on edit only, "Archive this venue" with its dialog.
5. **Circle editor** (new and edit):
   - **Fields:**
     - Circle name
     - Teacher (optional)
     - Type ("Regular class" / "Open drop-in")
     - Language
     - Section
     - "When it meets" (days and time)
     - "Limit the seats" plus "Number of seats"
     - "Online link (optional)"
     - Description
   - **Footer:** "Save draft", "Send for approval".
   - **Status banner:** Draft, "Waiting for the city coordinator", Published, "Not approved" with reason.
   - **City coordinator review mode:** "Approve", "Do not approve" plus "Reason".
6. **Session overview**: title, schedule, status, settings (registration on or off, capacity), occurrence date strip or list, the selected occurrence's actions, past occurrences with headcount and portion.
7. **Occurrence detail**: date and time, status, portion (para, surah, ayah range or lesson), recap note and language, "Cancel this occurrence", notify toggle.
8. **Registrants**:
   - **Content:** session and occurrence picker, search ("Search by name"), filter (All, Waiting list), totals ("48 people coming"), registrant rows with "Party of 3", call and WhatsApp.
   - **States:** empty ("No one has registered yet" / "People who register will appear here."), offline read-only ("You are offline. This list is from 6:42 pm.").
9. **Attendance**:
   - **Content:** headcount ("How many people came."), tick list ("Tick the people you know. The headcount can be higher."), "Mark everyone present", "Clear all", "31 of 48 ticked", add a walk-in by name, "Portion read", "Recap note (optional)", "Save attendance".
   - **States:**
     - Saved: "Attendance saved."
     - Saved offline: "Saved on this phone. We will send it when you are online."
     - No registrants: "No one is registered for this session. You can still enter a headcount."
10. **Change session time**:
    - **Content:** "Now: Friday 9:00 pm"; new date; new time; "Apply to" ("This session only" / "Every session from now on"); "Tell registered people" with helper; "Reason (optional)"; "Save new time" / "Time changed.".
    - **Error:** "Choose a time that has not passed."
    - **Cancel:** "Cancel this session" with its dialog ("Registered people will be told.").
11. **Post an update**:
    - **Audience:** "People who follow Masjid Al-Noor" or "People registered for this session", with counts.
    - **Kind:** announcement, time change, cancellation, special lecture.
    - **Template:** chips, including "Write my own".
    - **Message:** title and body, with the counter.
    - **Channels:** "App notification" and "WhatsApp, only for people who agreed".
    - **Preview:** of the push and the WhatsApp message.
    - **Sending:** "Post update", then the confirm dialog ("Send to 312 people?" / "You cannot take it back after it is sent."), then "Update posted.".
12. **Updates (tab)**: sent updates with kind, audience, channels, recipients and time; detail view.
13. **Circle requests** (city coordinator): requests by area with counts, days, section and language; a flag when the alert level is reached.
14. **Account (tab)**: name, phone, roles with scopes, language, text size, appearance, help, sign out.

---

## 10. Console screens (desktop web)

Shell on every page: sidebar, top bar, skip link, language, colours and text size controls, user and role, sign out. Each page has a title, an intro sentence, filters, content, and empty, loading, error and forbidden states.

1. **Sign in**:
   - **Content:** intro ("Coordinators sign in with a code sent to their WhatsApp."), phone ("For example 0300 1234567."), "Send code", 6-digit code, "Sign in", "Send a new code" with its countdown, "Use a different number".
   - **No access:** "This number cannot open the console" / "Ask a coordinator or admin to invite you first."
2. **Sessions**:
   - **Content:** intro ("Sessions at the venues you look after. Open one to see who registered."); filters (city, venue, status).
   - **Table:** Session, Venue, City, When, Section, Language, Seats ("42 of 60" / "No limit"), Status, Actions (Registrations).
   - **Extras:** "Show more"; empty state.
3. **Registrations (per session)**:
   - **Content:** back to sessions; sensitive-data notice; day filter ("All days" or an occurrence); totals (Registrations, People, On the waiting list).
   - **Table:** Name, WhatsApp number, Section, People, Status, WhatsApp alerts, Registered.
   - **Empty state:** "No registrations yet".
4. **Venues**:
   - **Content:** intro; filters; "Show archived venues".
   - **Table:** Venue, City, Address, Contact number, Women's section, Status.
   - **Empty state.**
5. **Coordinators**:
   - **Content:** intro.
   - **"Current coordinators" table:** Person, WhatsApp number, Role, Where, Since, Status, Actions (Hand over, Remove access); "Show past coordinators".
   - **Invites table:** Person, WhatsApp number, Role, Where, Expires, Status, Actions (Send again, Cancel invite); "Show past invites".
   - **"Invite a coordinator" form:**
     - Name
     - WhatsApp number, with the saved-as preview
     - Role
     - City or venue
   - **Handover form:** new coordinator picker, a warning, "Hand over"; the "No one else to hand over to yet" state.
   - **Dialogs:** "Remove access?", "Cancel this invite?".
   - **Toasts:** "Invite sent.", "Handed over.", "Access removed.", "Invite cancelled.".
6. **Exports**:
   - **Content:** intro; privacy notice ("This file has personal details. Share it only with people who need it." / "Every export is recorded in the audit log.").
   - **Builder:** "Export by" (Session, Venue, City); pickers; "1 session will be exported."; "Create export".
   - **States:**
     - progress ("Exported 3 of 8 sessions")
     - done ("Your file is saved, with 8 sessions.")
     - failed, partial and unreadable
     - empty ("Nothing to export for these filters.")
   - **"Recent exports":** list with Download.
7. **Bulk import**:
   - **Content:** intro ("Nothing has been saved yet.").
   - **Kind:** Venues, Coordinator invites or Sessions, with hints.
   - **File:** "Download the template", choose file ("A CSV file with a header row. Up to 500 rows.").
   - **Check:** summary (Rows, Ready, Already there, Need fixing); file problems; rows table (Line, Row, Status, Problems) with "Show every row" / "Show {count} more"; issue kinds (Fix, Note) with messages.
   - **States:**
     - blocked ("This file cannot be imported yet")
     - nothing new
     - confirm dialog ("Import these rows?" / "38 rows will be added." / "3 rows are already there and will be skipped." plus the warning)
     - progress ("Importing 12 of 38")
     - result ("Import finished. 38 rows added.")
     - stopped part-way ("The import stopped part of the way", with created and remaining counts and the next step)
   - **Actions:** "Import another file", "Download the problems as a file".
8. **Audit log**:
   - **Content:** intro ("Who did what, and when. It lists actions and records, not people's details."); filters (record type, from, to, city, venue).
   - **Table:** When, Who (or System), Action, Record, Where.
   - **Empty state:** "Nothing in the log".
9. **Settings** (national admin only; others see read-only or forbidden):
   - **Settings:**
     - Hijri date adjustment ("No change", ±1, ±2 days, with the moon-sighting hint)
     - Season on the home screen (Dora / Circles)
     - WhatsApp messages per person each day (0–5)
     - Circle request alert level (1–1000)
   - **Validation messages.**
   - **Saving:** "Save" / "Settings saved.".
   - **Optional:** message templates list with preview and status.
10. **Forbidden** ("You cannot open this page" / "Your role does not include this page. Ask an admin if you need it."), **Not found** ("We could not find that page"), **Rate limited** ("Please wait 30 seconds first.").

---

## 11. Suggestions (optional, not enforced)

These come from our earlier design conversation. Use, adapt or ignore them.

- **Colour:** Tanzeem-e-Islami green as the brand.
- **Type:**
  - Urdu in Jameel Noori Nastaleeq or Mehr Nastaliq.
  - Quran in KFGQPC Uthmanic Hafs, QCF or Al_Mushaf.
- **Islamic character:** add Islamic elements throughout.

## 12. Frames to produce

**Minimum set.** Every frame comes in Light EN; frames marked ★ also come in Dark EN and Light UR.

| Group       | Frames                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundations | Colour roles (Light, Dark, High contrast) · Type scale (EN, UR, Quran) · Spacing and layout · Shape · Elevation · Motion notes · Icon set ★                                                                                                            |
| Atoms       | Buttons ★ · Icon buttons and badges · Tags and status chips ★ · Avatars · Dividers · Progress and skeletons · Number displays                                                                                                                          |
| Inputs      | Text fields and text areas ★ · Phone and OTP ★ · Search and select · Checkbox, radio, switch · Segmented and chips · Section cards and stepper ★ · Pickers (date with Hijri, time, day, map pin) · File drop zone                                      |
| Content     | List rows · Prayer items, strip and countdown ★ · Venue, session, registration, update, surah and verse items · Admin rows · Console rows                                                                                                              |
| Cards       | All cards in 6.4 ★                                                                                                                                                                                                                                     |
| Navigation  | Tab bars (user, admin) ★ · App bars · Flow stepper · Console sidebar and top bar ★                                                                                                                                                                     |
| Overlays    | Sheet · Dialogs · Toasts · Banners · Full-screen states ★ · Success screens                                                                                                                                                                            |
| Map         | Map elements ★                                                                                                                                                                                                                                         |
| Quran       | Reader elements ★                                                                                                                                                                                                                                      |
| User app    | 8.1 to 8.12: every screen ★, plus each listed state at least once in Light EN                                                                                                                                                                          |
| Admin app   | 9.1 to 9.14: every screen, Today and Attendance ★                                                                                                                                                                                                      |
| Console     | 10.1 to 10.10: every page, Sessions and Import ★                                                                                                                                                                                                       |
| Extras      | Home in each prayer period (6 frames) · Home in Dora and Circles season · each screen at the Largest text size (one example per screen type) · one small phone (360 wide) example per screen type · High contrast examples of Home, Session and a form |

**Suggested order:** Foundations → Icons → Buttons and inputs → Cards → Home ★ → Session ★ → Register ★ → Nearby ★ → the rest.
