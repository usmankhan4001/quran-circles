# Quran Circles: UI image-generation prompts

This file holds one prompt for every part of the redesign: the global style, primitives, components and each screen in the user app, the admin app and the web console. It follows the decisions we agreed in this thread (see `v2/docs/design/redesign-decisions.md`) and the signature page (mihrab arch, eight-point star, girih pattern, gilt ornament, Islamic icon set).

## How to use this file

1. **Always paste the Style Block (section 1) first, then the one prompt you want.** Image models forget the style between prompts; the style block keeps every image consistent.
2. **Phone screens:** portrait 9:19.5, 1290 × 2796 px (iPhone 15 Pro), one phone screen per image, flat screen with no device frame, no hand and no desk. If your tool can't do that ratio, use 9:16 and say "tall phone screen".
3. **Components:** 4:3 or 1:1 on a plain light background, laid out like a design-system sheet, several states side by side.
4. **Console (web):** 16:10, 1600 × 1000 px, desktop browser content only, no browser chrome.
5. **Variants:** each screen has Day, Night and Urdu notes. Generate Day English first; add "Night mode" or "Urdu, right-to-left" lines only when you want those versions.
6. **Text in images:** image models often garble text, especially Urdu and Arabic. Don't fight it: the layout, colour, shapes and icons are what I need. I'll set real text and fonts when I build. If a tool supports it, keep the English text exactly as written in quotes.
7. **Naming what you send back:** `screen-<app>-<name>-<variant>.png`, for example `screen-user-home-day-en.png`, `screen-admin-attendance-night-en.png`, `comp-buttons.png`. Upload them in this thread.

---

## 1. Style Block (paste before every prompt)

> Premium mobile app UI design for "Quran Circles", a Pakistani app for finding and joining Quran study circles (halaqa) and Ramadan Dora (Taraweeh with Quran explanation) at nearby masjids. Calm, devotional, modern and warm; feels like a beautifully printed mushaf meets a polished iOS app. Islamic geometric character, never kitsch: no clip-art mosques, no glitter, no cartoon people with faces.
>
> **Palette:** Tanzeem green #226836 (primary actions), deep green #154a27 (headings, active text), night green #0c2a17 (night background), leaf tint #e5f0e8 (tonal fills), cloud white #f7fbf9 and page #f4f6f2 (backgrounds), mist #dbe7e6 (soft sky and dividers), mushaf gilt gold #b8913a (thin ornament, highlights, only for Quran and prayer moments), alert terracotta #c4563f (badges and errors only). Mostly white and green; gold is sparing, never a large fill on day screens.
>
> **Type:** clean geometric sans-serif (Figtree) for English; big confident numbers for times (semi-bold, tight letter spacing). Urdu in Nastaliq calligraphic script (Jameel Noori Nastaleeq style), right-to-left. Quran verses in classic Uthmanic mushaf script (King Fahd Complex Hafs style).
>
> **Shapes:** generous rounded corners: cards 22 px, buttons 16 px, inputs 14 px, chips fully pill-shaped, bottom sheets 28 px. Signature mihrab arch shape (pointed Islamic prayer-niche arch, rounded shoulders rising to a soft point) used for picture frames, quick-action tiles, the active prayer pill and section choice cards. Eight-point star (Rub el Hizb, two overlapping squares) as the app mark, active-tab marker and list numbering. Faint girih (interlaced eight-point star lattice) pattern at 5–8% opacity in the sky header and on night screens, never behind body text. Thin gilt gold hairlines with a small eight-point star in the centre as section dividers.
>
> **Header sky:** the top of the home screen is a soft sky that follows the prayer time: pale dawn mist at Fajr, bright mist-white by day, warm sand at Asr, apricot and rose at Maghrib, deep night green with small stars and a crescent after Isha. Soft blurred clouds fade the sky into the page.
>
> **Icons:** custom line icons, 24 px grid, 1.75 px stroke, round caps and joins, single colour (green on light, mint #8fd3a5 or white on dark). Islamic set: man in a topi cap with a short beard (no face details), woman in hijab (no face details), family, child, masjid with dome and two minarets, Quran open on a rehal stand, closed mushaf with star, Kaaba, qibla compass, prayer mat, tasbih beads, wudu water drop, crescent with star, Ramadan lantern, mihrab, minbar, raised hands in dua, minaret with sound waves for adhan, Hijri calendar with crescent, halaqa (people seated in a circle around a book), Rub el Hizb star.
>
> **Depth:** soft, low shadows (0 6 18 rgba(10,30,18,.07)); night mode uses no shadows, only 1 px light hairlines. Lots of white space, 16 px screen margins, 12 px between cards, 16 px inside cards, 24 px between sections.
>
> **Quality:** high-fidelity Dribbble / Behance quality, pixel-perfect, crisp, realistic content, consistent spacing, iOS status bar at top (9:41), home indicator at bottom. No device frame, no mock-up hands, no watermarks, no lorem ipsum.

**Negative prompt (if your tool supports one):** cartoon, clip art, 3D render, glossy gradients, neon, purple, blue primary, faces on people, human facial features, photos of real people, cluttered, skeuomorphic, drop-shadow-heavy, distorted text, gibberish Arabic, Comic Sans, device frame, hands, watermark.

### Night-mode line (add when wanted)

> Night mode after Isha: background night green #0a1a10, cards #12281a with 1 px hairline borders rgba(255,255,255,.08), text off-white #eaf3ec, secondary text #a6bbac, icons mint #8fd3a5, active elements in gilt gold #b8913a with dark text, girih pattern in faint gold at 10% opacity, a few small stars and a thin crescent in the header sky. No shadows.

### Urdu line (add when wanted)

> Urdu version, fully right-to-left: all text in Nastaliq calligraphic Urdu script (Jameel Noori Nastaleeq), layout mirrored (back arrow on the right, tabs reversed, text aligned right), taller line height so the Nastaliq descenders don't clip. Numbers stay in Western digits (1, 2, 3).

---

## 2. Brand and motifs

### 2.1 App icon and mark
> App icon for "Quran Circles": a rounded-square tile in Tanzeem green #226836 with a subtle diagonal light, centred an eight-point star (two overlapping squares) drawn as a thin gilt gold outline, and inside it a tiny open Quran on a rehal in white line art. Also show the same mark small next to the wordmark "Quran Circles" in deep green Figtree bold, on white and on night green. Show sizes 1024, 180, 60, 29 px side by side.

### 2.2 Signature motifs sheet
> Design-system sheet titled "Signature motifs", four tiles in a row on a light page:
> 1) **Mihrab arch:** a pointed Islamic arch frame with a gilt gold outline and a dotted inner gilt line, a small eight-point star at the apex, inside a soft mist-to-white gradient and a simple green masjid skyline silhouette at the bottom.
> 2) **Eight-point star:** three stars: a large green outline star with the number "7" in the centre, a filled gold star, a small green outline star with "2".
> 3) **Girih pattern:** a seamless lattice of interlaced eight-point stars connected by short lines, drawn in thin green at low opacity on a white tile.
> 4) **Gilt ornament:** a thin gold hairline that fades at both ends with a small outlined star in the middle; under it a pill with a double gold border (solid plus dashed) reading "Today's reading"; under that a section header "Your next session" with a tiny gold star before it and a hairline after it.
> Each tile has a caption below with the motif's name.

### 2.3 Sky by prayer time
> Six phone-width header strips (390 × 300 px each) stacked vertically showing the home screen sky through the day: "Fajr" pale blue-grey dawn mist, "Sunrise" soft gold glow at the bottom, "Dhuhr" bright mist white and pale green, "Asr" warm sand, "Maghrib" apricot to dusty rose with a faint sun at the horizon, "Isha / night" deep night green with tiny stars, a thin crescent and faint gold girih pattern. Each has soft blurred white clouds at the bottom blending into the page. Label each strip in small text.

---

## 3. Icon set

### 3.1 Islamic icons
> Icon sheet titled "Islamic icons", a 5 × 5 grid on white. Each icon is a single-colour line icon in Tanzeem green #226836, 1.75 px stroke on a 24 px grid, round caps, sitting on a soft leaf-tint #e5f0e8 rounded tile (radius 18) with its name under it in small grey Figtree. Icons: Man (topi cap, short beard, shoulders, no face), Woman (hijab framing the face, shoulders, no face), Family (man and woman side by side), Child, Masjid (central onion dome with finial and crescent, two slim minarets, arched door), Dome, Quran (open book on a crossed rehal stand), Mushaf (closed book with an eight-point star on the cover), Tafsir (open book with lines), Kaaba (cube with a gold band line), Qibla (compass with Kaaba marker), Musalla (prayer mat with mihrab arch), Tasbih (loop of beads with tassel), Wudu (water drop), Crescent (crescent with small star), Lantern (Ramadan fanoos lantern), Mihrab (pointed arch niche), Minbar (stepped pulpit), Dua (two raised open palms), Adhan (minaret with sound waves), Hijri (calendar with crescent), Halaqa (six small people seated in a circle around a book), Rub el Hizb (eight-point star), Access (wheelchair), Parking (P in a rounded square).

### 3.2 Everyday icons
> Matching icon sheet titled "Everyday icons" in the same exact style (1.75 px line, round caps, green on leaf-tint tiles): Search, Back arrow, Chevron, Close, Share, Heart, Bell, Clock, Calendar, Map pin, Navigate arrow, Map, List, Filter sliders, Check, Plus, Minus, Phone, WhatsApp bubble, Language (A and Urdu letter), Moon, Sun, Text size (Aa), Bookmark, Download, Wifi off, Warning triangle, Info, User, Settings gear, Edit pencil, Trash, Upload, Eye, Lock, Sign out.

### 3.3 Icons on dark
> The same two icon sheets on night green #0a1a10, icons in mint #8fd3a5 on #12281a tiles with a faint hairline border, active examples in gilt gold.

---

## 4. Primitives sheet

### 4.1 Colour and type
> Design-system sheet "Foundations". Left: colour swatches as large rounded cards with name and hex: Tanzeem green #226836, Deep green #154a27, Night green #0c2a17, Leaf tint #e5f0e8, Cloud #f7fbf9, Page #f4f6f2, Mist #dbe7e6, Mushaf gilt #b8913a, Alert #c4563f; below them a green ramp from #0c2a17 to #f3f8f4. Right: type scale in Figtree: "1 h 20 min" countdown 56 px semi-bold, "9:00" time 40 px semi-bold, "Nearby" screen title 26 px bold, "Taraweeh with Dora" card title 18 px bold, body paragraph 16 px regular, "See details" label 15 px semi-bold, "Masjid Al-Noor · Saddar" caption 13 px medium, "YOUR NEXT SESSION" eyebrow 12 px bold caps with letter spacing. Next to each English line its Urdu Nastaliq counterpart in the same role with taller line height. At the bottom a Quran verse line in Uthmanic mushaf script inside a thin gilt frame.

### 4.2 Spacing, radii and elevation
> Design-system sheet "Spacing, shape and depth": spacing scale bars 4, 8, 12, 16, 20, 24, 32, 48 px with labels; a row of shapes showing radius: pill chip, 14 px input, 16 px button, 22 px card, 28 px top-rounded sheet, and the mihrab arch tile; two elevation samples (level 1 card shadow, level 2 floating sheet shadow) on day, and the same cards on night with hairline borders and no shadow.

---

## 5. Components

Each prompt makes one sheet. Show every state named; label each state in small grey text under it.

### 5.1 Buttons
> Component sheet "Buttons", Day mode. Rows: **Primary** (solid Tanzeem green, white label "Register for tonight", 48 px tall, radius 16, soft green glow shadow); **Tonal** (leaf-tint fill, deep green label "Get directions" with navigate icon); **Outline** (1.5 px green border, green label "Follow this venue"); **Text** (green label only, "Send the code again"); **Destructive** (terracotta label "Cancel registration" on white with terracotta border); **Icon button** (40 px square radius 14, translucent white on the sky, bell icon with a red dot); **Floating action** (56 px mihrab-arch tile in green with a plus). States in columns: default, pressed (slightly darker, scaled 98%), focused (2 px green focus ring with 2 px gap), disabled (40% opacity), loading (small spinner made of an eight-point star rotating). Also full-width and compact sizes. Second half of the sheet: the same in Night mode (primary #2f8a4b, tonal #1f4029, gold for the special action) and in Urdu with Nastaliq labels.

### 5.2 Inputs
> Component sheet "Inputs": text field with label above "Full name", 52 px tall, radius 14, white fill, 1 px hairline border; states: empty with placeholder, focused (2 px green border), filled, error (terracotta border, helper text "Enter your name." with warning icon), disabled. Phone field with "+92" prefix chip and WhatsApp icon and helper "We send a code to this number on WhatsApp." Six-box OTP code input (one box focused, digits large and centred). Search field, pill-shaped, with search icon and placeholder "Search by area or venue". Select field with chevron "Choose your area" and its opened bottom-sheet list with a check on the selected area. Multiline field "Message" with a character counter "48 of 300 characters". Show day and night.

### 5.3 Choice controls
> Component sheet "Choices": **Section cards** (three mihrab-arch-topped cards side by side with Woman in hijab, Man in topi, Family icons and labels "Women", "Men", "Family"; one selected in solid green with a white check badge); **Chips** (pill filters "Any day", "Friday", "Evening", "Urdu", selected chip green with check, unselected outline); **Segmented control** "Map | List"; **Toggle switch** on (green) and off (grey) with label "Send me reminders on WhatsApp"; **Checkbox list** of facilities with icons (Women's section, Parking, Wudu area, Access for elders and wheelchairs, Child friendly); **Radio list** "This session only / Every session from now on"; **Stepper** "How many people are coming?" with minus and plus buttons and small people icons filling the middle (2 women icons), helper "Count yourself too."; **Text size slider** with four stops "Standard, Large, Larger, Largest" and a sample sentence.

### 5.4 Cards
> Component sheet "Cards", Day mode, on page background #f4f6f2:
> 1) **Next session card:** white, radius 22, a mihrab-arch-shaped thumbnail on the left (mist gradient with a green masjid skyline), eyebrow with small gold star "YOUR NEXT SESSION", title "Taraweeh with Dora", "Masjid Al-Noor · Saddar", large time "9:00" with "tonight" on the right, meta row with woman icon "Women", walking icon "6 min", gold pill "Para 3", primary button "See details" and a square tonal navigate button.
> 2) **Venue result card:** arch thumbnail, "Masjid Al-Noor", "Saddar · 1.2 km away", facility icons row (woman, parking, wudu, access), "Next: Tonight 9:00" and a chevron.
> 3) **Session row card:** small eight-point star with number, title "Dars-e-Quran", "Every Friday at 7:30 pm", "Men", seats bar.
> 4) **Prayer times card:** five columns Fajr 5:12, Dhuhr 12:18, Asr 3:52, Maghrib 6:04 (active, arch-topped green pill), Isha 7:25, Hijri date "16 Rabi al-Thani 1448" with crescent icon.
> 5) **Continue reading card:** gilt double border, Quran-on-rehal icon, "Continue reading", "Al-Baqarah, verse 142", a short Arabic verse line in Uthmanic script, progress ring.
> 6) **Update card:** venue avatar arch, "Masjid Al-Noor", "2 h ago", message "Tonight's Dora starts 15 minutes late because of rain.", unread green dot.
> 7) **Registration card (Journey):** status pill "Registered" (green) / "Waiting list" (gold) / "Cancelled" (grey strike), date block, reminder toggle row.
> 8) **Empty-state card:** soft arch illustration with a single line icon, "No sessions near you yet", body text, tonal button "Request a circle near me".
> Show the same sheet in Night mode as a second image.

### 5.5 Navigation
> Component sheet "Navigation": **User app tab bar** (white, hairline top border, five tabs: Home masjid icon, Nearby map icon, centre raised Quran tab as a green mihrab-arch tile 58 × 62 px with a white Quran-on-rehal icon floating above the bar, Journey halaqa icon, Updates adhan icon with red badge "2"; active tab green bold with a tiny gold eight-point star above the icon). **Admin app tab bar** (Today, Places, Updates, Account). **Top app bars:** large title "Nearby" with search and filter buttons; compact bar with back arrow, title "Register" and "1 / 3"; transparent bar over a hero with translucent white round-rect buttons (back, share, heart). **Step progress** three segments, first filled green. **Bottom sheet** with grab handle, title "Filters", rounded top 28 px. **Console sidebar** (white, green active item with left bar, icons and labels Sessions, Venues, Registrations, Coordinators, Import, Exports, Audit, Settings, Quran Circles mark at top). Day and night.

### 5.6 Feedback
> Component sheet "Feedback": **Toast** at bottom "Attendance saved." with check; **Offline banner** gold-tinted "You are offline. Showing what we saved earlier." with wifi-off icon; **Error state** full card with soft terracotta icon "Something went wrong", "Try again" button; **Loading skeletons** of a session card with shimmering grey blocks and an arch thumbnail placeholder; **Spinner** as a rotating eight-point star; **Confirm dialog** "Send to 42 people?" body "You cannot take it back after it is sent." buttons "Not yet" (tonal) and "Send" (primary); **Destructive dialog** "Delete your account?" with terracotta confirm; **Badges** red count, green "New", gold "Para 3"; **Status pills** Registered, Waiting list, Cancelled, Draft, Waiting for the city coordinator, Published, Not approved; **Success screen** big green check inside an eight-point star with gold sparkle lines.

### 5.7 Map elements
> Component sheet "Map": a soft custom map style (mist-green land, white roads, pale blue water, muted labels) with **venue pins** shaped like a small dome/masjid inside a teardrop (green, white icon), a **selected pin** larger in deep green with gold ring and label bubble "Masjid Al-Noor · 9:00", a **cluster pin** green circle with "12", the **user location** blue-green dot with soft halo, and a **map preview card** sliding up from the bottom with an arch thumbnail, venue name, distance and "See details". Map controls: recentre button and zoom as white rounded squares.

### 5.8 Quran reader elements
> Component sheet "Quran reader": a verse block in large Uthmanic Arabic script with an ayah-end marker (decorated circle with the verse number), the Urdu translation below in Nastaliq, bookmark and share icons; a surah header banner (gilt-framed cartouche with the surah name in Arabic calligraphy, "Al-Baqarah · 286 verses · Madani" in small text); a Juz marker with Rub el Hizb star; the reader toolbar (text size Aa, translation toggle, bookmark, save offline with progress "Saving: 64%"); a surah list row with star number, English name, Arabic name and verse count.

---

## 6. User app screens

Each prompt is one phone screen. Use the Style Block first.

### 6.1 Splash
> Splash screen: full night-green-to-deep-green gradient with a very faint gold girih pattern, centred the app mark (eight-point star in gold outline with a small Quran on rehal inside), the wordmark "Quran Circles" in white below, and at the bottom a short line "Find a circle near you" in mint. Soft vignette.

### 6.2 Welcome and language
> First-run screen: top half a tall mihrab arch window showing a dawn sky with a soft masjid skyline silhouette and a crescent, gold arch outline. Below: title "Welcome to Quran Circles", body "Find Quran circles and Dora near you, and keep up with your journey.", a language choice with two large cards "English" and "اردو" (Urdu in Nastaliq), English selected with a green border and check, primary button "Continue", text button "Already registered? Sign in".

### 6.3 Choose city / location permission
> Screen: "Choose your city" title, body "We need your city to show prayer times and nearby circles.", a primary card "Use my location" with navigate icon, a search field "Search city", list of cities with radio: Karachi (selected), Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad. Bottom primary button "Continue".

### 6.4 Sign in: phone
> Sign-in screen: compact top bar with back arrow; title "Sign in"; body "We send a code to your WhatsApp."; phone field with "+92" prefix and value "300 1234567"; helper text with WhatsApp icon; primary button "Send code"; at the bottom a small note "You can browse without an account." Decorative faint girih in the top corner only.

### 6.5 Sign in: code
> Code screen: title "Enter the code", body "We sent a 6-digit code to +92 300 1234567 on WhatsApp.", six large OTP boxes with "1 2 3 4" filled and the fifth focused with a green border and caret, text button "Send again in 24 seconds" (greyed), text button "Use a different number", primary button "Confirm" disabled until complete.

### 6.6 Home (day, signed in, Ramadan)
> Home screen. **Top third: the sky** in Maghrib-approaching late-afternoon tones (warm sand to mist) with faint green girih and soft clouds. In the sky: left the app mark (small green eight-point star) and "Quran Circles"; right a translucent bell button with a red dot. Centre: a gilt mihrab-arch outline (dotted inner line, small star at apex) framing small text "Assalamu alaikum, Ayesha", green label "Maghrib in", and a huge countdown "1 h 20 min" (numbers 50 px, units small). Under the arch a row of five prayer times: Fajr 5:12, Dhuhr 12:18, Asr 3:52 (past ones faded), Maghrib 6:04 as an arch-topped solid green pill, Isha 7:25. **Overlapping the bottom of the sky:** the white "Your next session" card (arch thumbnail with masjid skyline, "Taraweeh with Dora", "Masjid Al-Noor · Saddar", "9:00 tonight", Women, 6 min walk, gold "Para 3" pill, "See details" button and navigate button). **Then:** four arch-topped quick-action tiles in a row with icons and labels: Nearby (masjid), Journey (halaqa), Updates (adhan, red badge 2), Qibla (qibla compass). **Then** a "Continue reading" card with gilt double border, Quran on rehal icon, "Al-Baqarah, verse 142" and progress. **Then** section header with gold star "Updates" and "See all" link, one update card. **Bottom:** tab bar with Home active and the raised green Quran tab in the centre.
>
> Variants: **Night** (after Isha: night-green sky with stars and crescent, gold arch, "Fajr in 8 h 40 min", Isha pill gold); **Urdu** (mirrored, Nastaliq, "مغرب میں 1 گھنٹہ 20 منٹ"); **Not signed in** (card becomes "Next session near you" with "Register" button); **Outside Ramadan** ("Circles near you" carousel of two session cards instead of Dora); **Offline** (gold offline banner under the sky); **Empty** ("No sessions near you yet" card with "Request a circle near me").

### 6.7 Nearby: map
> Nearby screen, map view. Top: large title "Nearby", pill search field "Search by area or venue", a filter button with a count badge "2", segmented "Map | List" with Map selected, a horizontal row of chips "Tonight", "Women", "Urdu", "Friday", "Evening". Most of the screen: the custom soft-green map of Karachi Saddar with eight green dome pins, one cluster "5", the selected pin enlarged with gold ring and label. A "Use my location" round button at right. Bottom: a floating venue preview card (arch thumbnail, "Masjid Al-Noor", "1.2 km away · Saddar", women/parking/wudu icons, "Next: Tonight 9:00 · Taraweeh with Dora", primary "See details"). Tab bar with Nearby active.

### 6.8 Nearby: list
> Nearby screen, list view: same header with "List" selected, small result count "12 places near you" with a sort control "Nearest", then a vertical list of venue cards (arch thumbnails in varied soft colours, venue names Masjid Al-Noor, Jamia Masjid Tooba, Quran Academy Defence, Masjid Al-Huda, distances, facility icons, "Next:" line, a small gold "Dora" or green "Circle" tag). Last item followed by a soft card "Can't find one? Request a circle near me".

### 6.9 Nearby: filters sheet
> Bottom sheet over a dimmed map, rounded top 28 px with grab handle, title "Filters" and "Clear filters" link. Groups each with a small header with gold star: Day (chips Any, Mon–Sun with Friday selected), Time (chips Morning, Afternoon, Evening selected, Night, each with a tiny sun/moon icon), Section (three arch section cards Women selected, Men, Family), Language (chips Urdu selected, English, Arabic), Area (select "Saddar"). Sticky bottom primary button "Show 12 results".

### 6.10 Nearby: empty and location denied
> Two states on one screen each: (a) "No sessions found" empty state: soft arch illustration with a magnifier and masjid line icon, body "Try another day or area, or ask for a circle near you.", buttons "Clear filters" and "Request a circle near me". (b) A gold-tinted banner "Location is off. Search by area instead." above the search field with a list of popular areas as chips.

### 6.11 Venue detail
> Venue screen. Hero: a large mihrab-arch window (gilt outline) centred on a mist sky with girih, showing a photo-like soft illustration of the masjid façade in greens; translucent back, share and heart buttons on top. Sheet overlapping hero with rounded top: title "Masjid Al-Noor", subtitle "Saddar, Karachi", a gilt ornament divider, a row of three tonal buttons "Directions", "Call", "Follow". Section "Facilities" with gold star header: a 2-column grid of facility rows with Islamic icons (Women's section, Wudu area, Parking, Access for elders and wheelchairs, Child friendly). "How to find the entrance" note with door icon: "Women's entrance is on the side lane next to the pharmacy." "Address" with a small static map thumbnail and pin. "Sessions" list: two session rows (Taraweeh with Dora · Every night of Ramadan · 9:00 pm · Women; Dars-e-Quran · Every Friday · 7:30 pm · Men). Footer tonal button "Invite a friend or family" with WhatsApp icon.

### 6.12 Session detail
> Session screen. Hero sky with girih and a large central gilt-outlined mihrab arch window containing a green masjid skyline silhouette; translucent back, share and heart buttons. Overlapping sheet: tags "Seats open" (green with check) and "Para 3" (gold with star), centred title "Taraweeh with Dora", small gilt ornament divider, a row of four fact tiles with icons: clock "9:00 Starts", Hijri calendar "2.5 h Length", woman "Women For", tafsir book "Urdu Tafsir". Card "Today's portion" with gilt double border: "Para 3 · Al-Baqarah 142–252", a short Arabic line in Uthmanic script, link "Read ahead". "Seats" card with a segmented bar 9 of 12 filled green and "18 left of 60". "Teacher: Dr. Israr's student, Ustadh Kamran" row with man icon. "Hosted at" card with arch green tile and masjid icon, "Masjid Al-Noor", "6 min" walk tag. Sticky footer: "Free" in green with "Bring a mushaf" and mushaf icon on the left, primary button "Register for tonight" on the right.
>
> States as extra images: **Full** (tag "Full" in grey, button "Join the waiting list" tonal); **Cancelled** (terracotta banner "This session is cancelled.", greyed hero, button disabled); **Time changed** (gold banner "The time changed. New time: Friday 8:00 pm"); **Registered** (green banner "You are registered" with check, button becomes "Add reminder" and "Cancel registration" text); **After the session** (card "After the session" with recap text from the coordinator and dua icon); **Online** (button "Join online" with video icon).

### 6.13 Register: step 1, who is coming
> Register screen, step 1 of 3: compact bar with back and "Register", "1 / 3", three-segment progress bar with first green. Small summary card with lantern icon "Taraweeh with Dora · Masjid Al-Noor · 9:00 tonight". Header with gold star "Who is coming?" and three tall arch-topped section cards: Women (selected, solid green, white woman-in-hijab icon, check badge), Men (man in topi), Family. Header "How many people are coming?" with stepper showing two woman icons and minus/plus, helper "Count yourself too." A card with WhatsApp icon "Send me reminders on WhatsApp", "You can change this any time in Profile." and a green toggle. Primary button "Continue".

### 6.14 Register: step 2, your details
> Register step 2 of 3: fields "Full name" (filled "Ayesha Khan"), "WhatsApp number" with +92 prefix and helper with WhatsApp icon, "Your area" select "Saddar". A small privacy note with lock icon "Only the coordinator of this venue sees your number." Primary "Send code".

### 6.15 Register: step 3, code
> Register step 3 of 3: same layout as the sign-in code screen inside the register flow, title "Enter the code", OTP boxes, "Confirm" primary.

### 6.16 Register: success
> Success screen: centred a large green eight-point star badge with a white check, gold fine rays around it, a little confetti of small gold stars; title "You are registered"; body "We will remind you before the session."; a summary ticket card with arch thumbnail, "Taraweeh with Dora", "Tonight 9:00 · Masjid Al-Noor", "Women · 2 people", a dashed tear line and a small "Add to calendar" link; buttons "See it in My Journey" (primary) and "Done" (text). Variant: **Waiting list** with a gold hourglass inside the star, "You are on the waiting list", "We will tell you if a seat opens."

### 6.17 Quran: surah list
> Quran tab screen. Top: segmented "Quran | Prayer times" with Quran selected. Hero card with gilt double border: "Continue reading", "Al-Baqarah · verse 142", an Arabic line in Uthmanic script, green "Continue" button and a progress ring "Juz 2". Search field "Find a surah". Chips "Surahs | Juz | Bookmarks". List of surah rows: eight-point star with number (1, 2, 3…), English name "Al-Fatihah", meaning "The Opening", "7 verses · Makki" in grey, Arabic name in calligraphy on the right. A small "Saved on this phone" check on some rows. Tab bar with the centre Quran tab active (raised tile in gold-tinted green).

### 6.18 Quran: reader
> Quran reader screen: minimal top bar with back, surah name "Al-Baqarah", text-size "Aa", bookmark. A gilt-framed surah cartouche header with Arabic title and Bismillah in Uthmanic script. Page content on a warm off-white paper tone (#fbf8ef) with thin gilt margins: large right-aligned Uthmanic verses with decorated ayah-number medallions, each followed by an Urdu translation in Nastaliq in smaller grey text. One verse highlighted with a soft leaf-tint background and a bookmark ribbon. Bottom floating toolbar: "Show Urdu translation" toggle, text size, "Save for offline reading" with download icon. Night variant: deep green-black page with soft cream text and gold medallions.

### 6.19 Quran: bookmarks and offline
> Bookmarks list with Arabic snippet, surah and verse, date added, swipe-to-remove hint; empty state "No bookmarks yet. Tap the bookmark on any verse." with a bookmark ribbon illustration. Plus an offline sheet "Save for offline reading" with Juz checklist and progress "Saving: 64%".

### 6.20 Prayer times
> Prayer times screen (Quran tab, segment "Prayer times"): top sky strip matching the current time with gilt mihrab framing "Next prayer · Maghrib · 6:04" and countdown "in 1 h 20 min". Date line "Friday 16 October · 16 Rabi al-Thani 1448" with crescent icon and info tooltip "The Hijri date follows moon sighting in Pakistan." List of six rows Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha each with a small sky-colour dot matching that time, time on the right, a bell toggle; the next prayer row is arch-highlighted in green. A "Times for Karachi" row with change link. A qibla card with compass and Kaaba marker "Qibla 266° W".

### 6.21 My Journey
> Journey tab: large title "My Journey". Top summary card in deep green with faint gold girih: "This Ramadan", three stats with big numbers "12 nights attended", "Para 9 reached", "3 circles", a thin gold progress line across 30 small marks for the nights of Ramadan (12 filled). Section "Your registrations" with gold star header: registration cards with date blocks (Fri 16), title, venue, status pill "Registered" or "Waiting list", reminder toggle, overflow menu with "Cancel registration". Section "Circle progress": a horizontal timeline of Juz stars 1–30 with "Reached: Para 9". Section "Session companion": "Recap from the coordinator" card with dua icon and a short note. Section "Venues and circles you follow": horizontal row of arch avatars with names. Tab bar Journey active.
>
> Variants: **Signed out** (soft arch illustration of a halaqa, "Sign in to see your journey", "You can browse without an account. Sign in to register and follow.", primary "Sign in"); **Empty** ("You have not registered yet", "Find a session").

### 6.22 Cancel registration dialog
> Over the Journey screen, a centred dialog: title "Cancel your registration?", body "You can register again later if there is room.", buttons "Keep it" (tonal) and "Yes, cancel" (terracotta).

### 6.23 Updates
> Updates screen: large title "Updates", chips "All", "Following", "Registered". Grouped by day headers "Today", "Yesterday" with gold star. Update cards: arch venue avatar, venue name, time ago, message text, unread green dot, some with a small tag "Time changed" (gold) or "Cancelled" (terracotta), one with a WhatsApp icon showing it was also sent there. Empty state: adhan minaret illustration, "No updates yet. Follow a venue to hear from it."

### 6.24 Profile and settings
> Profile screen: header with an arch avatar showing initials "AK" on green, name "Ayesha Khan", phone "+92 300 1234567". Grouped settings cards with icons: Language (English / اردو segmented), Text size (slider with sample "This is how your text will look."), Appearance (Dark mode toggle, High contrast toggle), Alerts (per-venue rows "Alerts for Masjid Al-Noor" with toggles), WhatsApp reminders toggle. "About you" card with optional fields (Age, Profession, Education, Quran reading so far) and helper "These are optional. They help coordinators plan." "Account" card: Help and support, About Quran Circles, Sign out, and a terracotta "Delete my account" row.

### 6.25 Content page
> Static content page (About / Help): top bar with back and title "About Quran Circles", a gilt ornament under the title, rich text with headings, short paragraphs, a quote card with a Quran verse in Uthmanic script and Urdu translation, a contact card with WhatsApp and phone buttons.

### 6.26 Request a circle
> Screen "Request a circle near me": arch illustration of a halaqa, fields "Your area", "Section" (three arch section cards), "Preferred day" chips, "Preferred time" chips, "Language", note field, primary "Send request". Success state "We have shared your request with the city coordinator."

### 6.27 Not found and errors
> Not-found screen: a soft arch doorway illustration with a path leading into it, title "We could not find this", body, primary "Go home". Second image: offline full-screen state "You are offline" with wifi-off icon inside an arch, "Check your internet connection, then try again.", "Try again".

---

## 7. Admin app screens (coordinators, on phone)

Same style; admin screens are denser and more practical, with the same motifs used lightly (arch avatars, gold star headers). Tabs: Today, Places, Updates, Account.

### 7.1 Today
> Admin "Today" tab: small sky header with the coordinator's name "Assalamu alaikum, Ustadh Kamran", role pill "Venue coordinator · Masjid Al-Noor", and next-prayer chip "Maghrib 6:04". Big card for tonight's occurrence: "Taraweeh with Dora", "Tonight 9:00", three big stats "48 registered", "6 waiting list", "60 seats", and three action buttons in a row as arch tiles: "Registrants" (people), "Attendance" (check list), "Post update" (adhan). Below: "This week" list of upcoming occurrences with date blocks and counts; a gold card "1 circle waiting for your approval" (city coordinators only). Tab bar Today active.

### 7.2 Places
> Admin "Places" tab: title "Places", search, list of the coordinator's venues as cards (arch thumbnails, name, area, session count, status pill), each expandable to show circles under it with status pills "Published", "Draft", "Waiting for the city coordinator". Floating arch action button with plus offering "Add a venue" / "Add a circle".

### 7.3 Venue editor
> Admin "Add a venue" form: fields Name in English, Name in Urdu (Nastaliq, right-aligned), Address, Area select, a map with a draggable green pin and helper "Place the pin at the entrance", Venue phone number with helper "Everyone can see this number.", Facilities checklist with Islamic icons and helper "Tick what the venue has.", "How to find the entrance" multiline, sticky primary "Save venue". At the bottom of the edit version a terracotta text button "Archive this venue".

### 7.4 Circle editor
> Admin "Add a circle" form: Circle name, Teacher (optional), Type segmented "Regular class | Open drop-in", Language chips, Section arch cards, "When it meets" with day chips and a time picker, "Limit the seats" toggle with "Number of seats" stepper, "Online link (optional)", status pill at top "Draft". Footer buttons "Save draft" (tonal) and "Send for approval" (primary). Variant for city coordinators reviewing: banner "Waiting for the city coordinator" and buttons "Do not approve" (terracotta outline, opens a reason field) and "Approve" (primary).

### 7.5 Session overview (admin)
> Admin session screen: header with title "Taraweeh with Dora", "Every night of Ramadan · 9:00 pm", status pill "Published"; a horizontal date strip of upcoming occurrences with the selected one in an arch-shaped green pill; occurrence card with counts and actions "Registrants", "Attendance", "Change time", "Post update"; a list of past occurrences with headcount and "Portion read" chips.

### 7.6 Registrants
> Admin "Today's registrants": session select at top, search "Search by name", chips "All 48 | Waiting list 6", total line "48 people coming". List rows: arch avatar with initials, name, area, section icon (woman / man / family), "Party of 3" pill, call and WhatsApp icon buttons; waiting-list rows with a gold "Waiting list" tag. Offline banner variant "You are offline. This list is from 6:42 pm." Empty state "No one has registered yet".

### 7.7 Attendance
> Admin "Attendance" screen: big headcount stepper at top in a green card "Headcount 52" with helper "How many people came.", a line "31 of 48 ticked", buttons "Mark everyone present" and "Clear all". List of registrants with large round checkboxes (ticked ones green with check), name, party size. "Portion read" select "Para 3" with Rub el Hizb icon, "Recap note (optional)" field. Sticky "Save attendance". Toast variant: "Saved on this phone. We will send it when you are online."

### 7.8 Change time
> Admin "Change session time": card "Now: Friday 9:00 pm", fields New date (calendar sheet with Hijri dates in small grey under each Gregorian day), New time (wheel picker), "Apply to" radio "This session only / Every session from now on", "Tell registered people" toggle with helper, "Reason (optional)", primary "Save new time", terracotta text "Cancel this session". Error example "Choose a time that has not passed."

### 7.9 Post an update
> Admin "Post an update": "Who should see this?" radio cards "People who follow Masjid Al-Noor (312)" and "People registered for this session (48)"; "Start from a template" chips "Time changed", "Cancelled", "Bring a mushaf", "Write my own"; message field with counter "48 of 300 characters"; channel toggles "App notification" and "WhatsApp, only for people who agreed"; a live preview of the notification as it appears on a phone lock screen and as a WhatsApp message bubble; primary "Post update". Confirm dialog "Send to 312 people?".

### 7.10 Updates and Account (admin)
> Admin Updates tab: list of sent updates with audience, channel icons, delivered counts and time. Admin Account tab: profile card with role pills, scope ("Karachi · Saddar"), language, dark mode, text size, help, sign out.

---

## 8. Web console (national and city admins, desktop)

Desktop 1600 × 1000, same palette and type, more data-dense, white cards on page #f4f6f2, left sidebar 248 px, top bar with search, city switcher and avatar. The arch and star motifs appear lightly: arch avatars, star section headers, gold only on Quran/prayer data.

### 8.1 Console sign in
> Desktop sign-in: split screen, left half a tall night-green panel with gold girih pattern and a large gilt mihrab arch framing the app mark and "Quran Circles Console"; right half a white form "Sign in" with WhatsApp number field, "Send code", then six-box OTP.

### 8.2 Sessions
> Console "Sessions" page: page title with count, filter bar (city, area, section, language, status, date range), a data table with columns Session, Venue, Section (icon), Language, Schedule, Seats (mini bar), Registered, Status pill, actions menu; row hover in leaf tint; a right-side detail drawer for the selected session with occurrences and approval buttons.

### 8.3 Venues
> Console "Venues" page: table and map split view; table left (Venue with arch thumbnail, Area, Facilities icons, Circles count, Coordinator, Status), map right with green dome pins; "Add venue" primary button; bulk actions bar when rows are selected.

### 8.4 Registrations
> Console "Registrations" page: KPI cards across the top (Registered today, This week, Waiting list, Attendance rate) with big numbers and sparklines in green; table of registrations with person, phone (masked), session, section, party size, status, date; export button.

### 8.5 Coordinators and invites
> Console "Coordinators" page: tabs "Coordinators | Invites"; coordinator table with arch avatar, name, role pill (National admin, City coordinator, Venue coordinator), scope, last active; "Invite a coordinator" side panel with WhatsApp number, Role radio, City/Venue select, "Send invite"; invites list with status pills Waiting, Accepted, Expired, Cancelled and actions "Send again", "Cancel invite".

### 8.6 Bulk import
> Console "Bulk import" page: three-step stepper "Choose file → Check → Import"; a large dashed drop zone with upload icon "Choose a CSV file", helper "Use the template. One row for each venue.", link "Download the template"; after checking: summary "38 rows are ready" (green) and "3 rows need fixing" (terracotta), an error table "Row 12: Area is missing", button "Download the problems as a file", primary "Import 38 rows".

### 8.7 Exports, Audit and Settings
> Three console pages in one style: **Exports** (list of export jobs with type, filters used, created by, status, download button); **Audit** (timeline table of actions with actor, action, object, time, filter by actor and action); **Settings** (sections for Ramadan dates with Hijri picker, cities and areas list, WhatsApp templates with preview bubbles, default prayer calculation method).

---

## 9. Motion and micro-interaction notes (for reference images or short clips)

- The home sky crossfades between prayer palettes; stars fade in after Isha.
- The countdown digits roll like a flip counter each minute.
- The active prayer pill slides between columns with a soft spring.
- The eight-point star spinner rotates 45° per step.
- Section cards lift slightly (2 px) and the check badge pops in when selected.
- The registration success star draws its outline, then the check, then the gold rays sparkle once.
- Bottom sheets rise with a slight overshoot; the map preview card snaps to two heights.

## 10. Checklist of images to send back

| Group | Images |
|---|---|
| Brand and motifs | 2.1 app icon, 2.2 motifs, 2.3 sky strips |
| Icons | 3.1 Islamic, 3.2 everyday, 3.3 on dark |
| Primitives | 4.1 colour and type, 4.2 spacing and depth |
| Components | 5.1 to 5.8 (day, plus night for cards and navigation) |
| User app | 6.1 to 6.27, Home and Session also in night and Urdu |
| Admin app | 7.1 to 7.10 |
| Console | 8.1 to 8.7 |

Start with 2.2, 3.1, 6.6, 6.12 and 6.13. Those five set the character; once they look right the rest follows them.
