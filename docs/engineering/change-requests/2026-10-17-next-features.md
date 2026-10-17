# Change request: contracts and tables for the next features

Requested by: product discussion with the owner (see `docs/product/features-next.md`)
Contract: `@qc/contracts` (people, admin, config schemas, endpoints, scopes), `packages/db` schema
What I need: the data and endpoints for days read, the community total, ayah of the day and the memorisation tracker. Read-along needs nothing new beyond the reading log.
Why: today the app keeps only the last reading position (`ReadingPosition`, one surah and ayah). There is no daily history, no ayah of the day and no memorisation state.

Proposed changes, for the waves thread to decide and schedule:

1. **Reading log.** Table `reading_days` (user, Pakistan-time date, sources: `reader`, `goal`, `manual`, `attendance`, `portion`; pages or ayahs read). Endpoints: `POST /v1/me/reading-days` (record today, idempotent per day and source) and `GET /v1/me/reading-days?from&to` (own days only). Scope `reading.manage` (self). Attendance marks with a named user add an `attendance` day on the server.
2. **Daily goal.** Optional profile field: `{ unit: 'pages' | 'rukus' | 'minutes', amount }`.
3. **Community total.** `GET /v1/community/today` returning `{ date, readersToday, pagesTogether }`, public, cached. Counted from `reading_days` without user ids; no per-city or per-venue breakdown.
4. **Ayah of the day.** Table `daily_ayahs` (date, surah, ayah, scope: national, venue or circle; set by). Endpoints: `GET /v1/ayah-of-the-day` (resolves the national pick, or a followed venue's or circle's pick when exactly one applies, else the built-in list), `GET/PUT /v1/admin/daily-ayahs`. Scope `daily_ayah.manage` at national, city or venue level. Stores numbers only, never translation text.
5. **Ayah notification.** A consent or notification preference `ayah_daily` (push), default on; worker job to send it each morning.
6. **Memorisation.** Table `memorisation` (user, surah, status: `learning` | `memorised` | `revising`, last revised at). Endpoints: `GET /v1/me/memorisation`, `PUT /v1/me/memorisation/{surah}`, `DELETE` to clear. Setting `memorisationReviseAfterDays` (default 14).
7. **Account deletion** removes `reading_days` and `memorisation` rows.

Affected lanes: contracts, db, api-core, messaging (ayah push), user-app, console (ayah list), admin-app (coordinator ayah pick).
Workaround meanwhile: none needed; nothing is built until this is decided.
