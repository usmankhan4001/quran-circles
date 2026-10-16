# Product decisions

Agent-facing copy of the decisions in the Quran Circles V2 Plan. Do not re-decide these. If one blocks you, raise it with the orchestrator. Items marked **Proposal** are open to change through a decision record.

## Product

- **Name and brand:** Quran Circles. One universal app for Dora (Ramadan, seasonal) and Circles (year-round).
- **USP (draft):** attendees find the nearest Quran session, register in a tap and never miss it. Coordinators run a venue or circle from a phone. Quran and prayer times are supporting tools, not the USP.
- **Season mode:** the server decides whether Dora or Circles leads the home screen. Feature flags switch features on city by city.
- **Scale target:** about 200 venues and under 50k users in the first season, designed to grow nationally.
- **Languages:** English and Urdu (right-to-left) at launch. Urdu text is drafted by agents and must be reviewed by a native speaker before release.
- **Fees and billing:** none in V2. A Contribute section comes later.

## Places, sessions and people

- **Place hierarchy:** Country > Province > City > Area > Venue. Country is fixed to Pakistan in V2.
- **Sessions:** a venue can run several sessions; simple venues use one. A session is a recurring schedule or a one-off lecture. An occurrence is one dated instance. Attendance and circle progress attach to occurrences.
- **Roles:** national admin, city or regional coordinator, venue coordinator. Teachers are not a role: the teacher is an optional name field on a circle.
- **Coordinator accounts:** invited by an admin, sign in with a phone code, every action audited.
- **Attendee accounts:** optional phone login with a WhatsApp code. Browsing needs no account; registering and following do. Personal data is kept until the person deletes their account, and the app has an in-app delete option.
- **Coordinator handover:** an admin or city coordinator reassigns a venue or circle. History stays and the previous coordinator loses access at once.

## Registration

- **Required at sign-up:** name, OTP-verified WhatsApp number, area (from our place list), section (women, men or family) and party size.
- **Optional, asked later in the profile:** age band, profession, education, prior reading, language.
- **Capacity:** optional per session and off by default. When on: seat count, a full state and a waitlist.
- **Special lectures:** one-off events with optional registration, chosen per lecture, shown in the Updates feed.

## Circles

- Recurring classes with a teacher, or open drop-in sessions. Membership is not fixed. In person; an optional online link covers the rare online case.
- **Who creates:** venue coordinators create and edit circles for their venue. A city coordinator approves before it goes public.
- **Attendance:** coordinator-only, on a quick tick list in the admin app: a headcount, plus names when the coordinator knows them. No member check-in in V2.
- **Progress:** where each circle has reached (Para, Surah or lesson), plus each member's own reading position in the reader.
- **Dora portions** vary by venue and city, so coordinators set the portion for each of their sessions. There is no national schedule.

## Platform

- **Database:** one PostgreSQL with Drizzle ORM and SQL migrations in the repository. Replaces Supabase and Neon.
- **API:** Hono (TypeScript) with Zod validation. **Proposal.**
- **Background jobs:** pg-boss, a queue inside Postgres. **Proposal.**
- **Apps:** Expo (React Native) for the user app and the admin app, with the PWA built from the user app's web target. The PWA is the fallback if store release fails.
- **Admin console:** a separate React web app (Vite) sharing the API client and design tokens.
- **Maps:** Google Maps behind a swappable map interface.
- **Hosting:** the owner's VPS with Docker Compose and automatic TLS. A few minutes of downtime on Ramadan evenings is acceptable. A standby can come later.
- **Backups and monitoring:** daily encrypted database backups to a second location with a tested restore; self-hosted error and uptime tracking. **Proposal.**
- **Apple and Google:** organisation accounts exist. The Android app was never published, so the app ID is chosen once, from the final name and domain.

## Quran and prayer

- **Lean scope:** prayer times with a countdown and Hijri date, and a Quran reader with Urdu translation, bookmarks and an offline copy.
- **Hijri date** carries an admin-set offset, because Pakistan starts months by moon sighting.
- **Later, not in V2:** Adhan sound alarms, audio recitation, a prayer widget.
- **Text and rights:** the Arabic text is reported as CC BY 3.0 (copy it unchanged and credit Tanzil). Tanzil's translations are non-commercial unless the translator or publisher agrees, and the Maududi translation's rights are unconfirmed. Do not store or ship our own copy of the translation until rights are confirmed in writing (WP18). Until then, keep fetching from the current source.

## Migration

- Venues and past registrations are carried over. Registrations go into a legacy table tagged Ramadan 2026 and are not turned into accounts.
- WhatsApp subscribers must opt in again. Push subscriptions are not carried over.
- Browser bookmarks can be imported once at first login.
- The exposed V1 database password and push keys are rotated at V2 launch, not before. Treat existing registrant data as possibly seen by others.
