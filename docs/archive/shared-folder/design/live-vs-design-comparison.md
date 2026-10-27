# Code on main (eb5c095) vs today's design (thread "Redesign UI from scratch, screen by screen")

Basis: the design system tokens and README, plus the code on main read in the repo. I could not open https://qurancircle.doraquran.pk from the cloud (proxy refuses the host) and I did not render any screen, so "Looks" columns are unverified until the PC session screenshots them.

## Main finding
Main already carries today's design system in code: logo green #0A6938 as the only action colour, light default, flat hairline cards, Plus Jakarta Sans, welcome + features screens, sign-up, full map, memorisation, credits. If the live site looks nothing like the boards, the likeliest cause is that the live site is an older deployed build, not that main lacks the design. This needs confirming with screenshots of main running.

## Per screen (code level)
| Area | Design shows | Main code | Verdict |
|---|---|---|---|
| Colours | #0A6938 only action colour, white page, hairline cards, no shadows | Tokens match (green, line, fill, ink) | Match |
| Header | No green band; large plain title | Member app plain; **admin app and console keep the green hero band** (semantic-colors comment says so) | Differs (coordinator app, console) |
| Tab bar | Boards show a labelled tab bar; Muhammad now wants the floating pill with animation | Flat bar, hairline on top, label on every tab, no floating, no transition animation | Differs |
| Fonts | Plus Jakarta Sans; Noori Nastaleeq for Urdu (file not supplied, fallback Noto Nastaliq) | Plus Jakarta Sans; Urdu is Mehr Nastaliq Web, Noto fallback | Urdu font differs (needs the Noori file and licence) |
| Welcome (member) | Single screen, big logo, Create account / Sign in / Browse, link to Features | WelcomeScreen + FeaturesScreen exist, 160 px logo | Probably matches, verify visually |
| Welcome (coordinator) | Welcome "by invitation", then sign in | Admin app has sign-in only (no welcome screen found) | Differs |
| Welcome (console) | Welcome, Sign in, Enter code | WelcomePage, SignInPage exist | Probably matches |
| Sign in / sign up / code | New boards | SignInScreen, SignUpScreen exist (member); sign-in only in admin app | Verify; coordinator welcome missing |
| Home, Nearby, Session, Venue, Join pledge, Joined | Boards | Screens exist, no party size | Verify visually |
| Quran index, reader, Mushaf, reading settings, prayer times | Boards | Quran & Prayer screen exists; no separate Mushaf or settings screen files found | Likely differs (Mushaf page, reading settings sheet) |
| My Journey, Memorisation, Updates, Profile, About/credits, Help | Boards | JourneyScreen, MemorisationScreen, UpdatesScreen, ProfileScreen, CreditsScreen, ContentPageScreen exist | Verify visually |
| Full-screen map, venue map, map states | Boards | FullMapScreen exists | Verify visually |
| Coordinator app (17 screens, poster maker) | Boards | 12 feature folders (home, attendance, occurrence, post-update, venues, places, schedule, daily-ayah, posters, account, registrants, circles) | Verify visually; poster maker redesign likely not applied |
| Console (11 screens) | Boards | Pages for sessions, venues, registrations, coordinators, daily ayahs, posters, exports, import, audit, settings | Verify; green band differs; registrations table may still show party size |
| App icon | Muhammad's logo (green + gold Quran, brand #0A6938) | Admin app icon exists (icon-1024, adaptive foreground); user app config has no icon asset path I could find | Needs checking on device |
| Splash | Big logo on white | Not found in config | Needs checking |
| States (empty, offline, error) | Boards | Not individually checked | Unverified |

## Not decided by the design (assumed kept)
No party size anywhere; OTP stays inside join/sign-in; light default, night opt-in.
