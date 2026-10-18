# Contract changelog

## Unreleased

- **Schemas are built on first use, not at import (low-end start-up).** Every schema the package declares (exports, internal pieces and the endpoints' inline params, query, body and success schemas) is now made by the internal `lazy()` helper (`src/lazy.ts`): importing `@qc/contracts` builds no zod schema (it built about 1,870 before), and each one is built the first time it is read. No export, name, type, field, error code, issue code, scope action or OpenAPI output changes; no version bump. `lazy-equivalence.test.ts` loads the package eagerly and lazily and checks that all 411 exported and endpoint schemas give the same JSON Schema and the same parse result (data and every issue) on over 100,000 inputs; `lazy.test.ts` covers the helper (metadata and ids, `instanceof`, `z.instanceof`'s refusal code, a failed build, reading a schema while it is built). One thing to know: a schema's own keys (`Object.keys`) are empty until it is first read.

- **Invitation and poster ceilings (change request `invite-and-poster-ceilings`, SEC-03 and SEC-13) and sign-in limits (`auth-limits-doc`, SEC-04 and SEC-07).** No error code, field or scope action changes; no version bump. `adminPosters.create` now lists `conflict`: a new poster for a session and template is refused while one for them is still `queued` (any format or language, a remake included; a queued row older than an hour no longer blocks). New issue-code exports: `COORDINATOR_IMPORT_MAX_ROWS` (100), `INVITE_DAILY_LIMIT` (`invite_daily_limit`), `IMPORT_REQUEST_ISSUE_CODES` (`too_big`, `invite_daily_limit` on `rows`, refusing a whole `adminImport.coordinators` file), and `WORDED_ISSUE_CODES` (`phone_not_pakistan_mobile`, `invite_daily_limit`) with `issueMessageKey` for their new i18n messages `issues.<code>` (en and ur; plus `console.import.issue.tooManyInviteRows` with `{max}`). Descriptions now state the per-staff poster allowance (create and regenerate, 10 a minute by default), the invitation ceilings on `adminRoles.invite` and `adminImport.coordinators`, the Pakistani-mobile rule on `auth.requestCode`, and that the sign-in limits replace the `auth_code` bucket on `auth.requestCode`, `auth.verifyCode` and `auth.refresh`. OpenAPI regenerated (descriptions and the 409 on poster create). The mock does not refuse a second queued poster.

- **SEC-01 (messaging lane):** `DeviceRegister` refuses a `webpush` token unless it is a `PushSubscription` JSON (`endpoint`, `keys.p256dh`, `keys.auth`) whose endpoint is `https:` on a known push service (`fcm.googleapis.com`, `updates.push.services.mozilla.com` and `*.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com` and `*.push.apple.com`), default port, no user info, no IP literal: issue `{ path: 'token', code: 'custom' }`, so `devices.register` answers `validation_failed`. FCM and APNs tokens are unchanged. New exports `WEB_PUSH_HOSTS`, `WEB_PUSH_HOST_SUFFIXES`, `isAllowedWebPushEndpoint`, `WebPushSubscriptionToken`, `parseWebPushToken`; the worker applies the same check before every send. No endpoint, field or error code changes; OpenAPI is unchanged (the check is a refinement).

### Stricter input validation (security review SEC-04, SEC-08, SEC-09)

No endpoint, field, error code or scope action changes; inputs that were accepted before can now be refused with `validation_failed`.

- **Names and place text (SEC-08).** New shared refinement `SafeText(min, max, { multiline? })` in `common.ts` refuses C0 and C1 controls and DEL, the bidi marks and controls (LRM, RLM, ALM, U+202A to U+202E, U+2066 to U+2069), and invisible format characters (zero-width space and joiner, U+2028/U+2029, U+2060 to U+2064, U+206A to U+206F, BOM, U+FFF9 to U+FFFB); ZWNJ (U+200C) stays allowed for Urdu. Line text also refuses tab and line breaks; long text keeps them. Issue code `custom`, message `SAFE_TEXT_MESSAGE`. Used by `PersonName`, `LocalizedInput` (now one line: venue, circle and session names and titles, update titles), `LocalizedLongInput` (multiline), the new `LocalizedAddressInput` (venue `address`, multiline, 500), circle `teacherName`, lesson `Portion.title`, attendance drop-in `name`, `PosterFields` (replaces its own check, same characters plus the invisible ones; one line) and the venue and area names in `PosterSourceSnapshot`. Helpers `isSafeText` and `stripUnsafeText` (the poster renderer strips as a second guard).
- **Links (SEC-09).** New `HttpsUrl`: `https://` with a domain name, at most 2048 characters, no user info; `http:`, `javascript:`, `data:`, `file:` and every other scheme, IP addresses and `localhost` are refused. Used by every `onlineLink` (`CircleCreate`, `CircleUpdate`, `AdminCircle`, `CircleInfo`).
- **Sign-in numbers (SEC-04, owner decision).** New `PakistaniMobilePhone` (`+923` and nine digits) for `RequestCodeBody.phone` only. A well-formed number elsewhere, or a Pakistani landline, gets issue code `phone_not_pakistan_mobile` (`PHONE_NOT_PAKISTAN_MOBILE`); a malformed one keeps `invalid_format`. Every other phone field (invites, role assignments, venue `contactPhone`, people) stays `PhoneE164`. `issuesFromZod` now reports a custom refinement's own `params.code` (new `issueCodeOf`); servers that build issues by hand must use it to surface that code.

## 1.0.0-rc.5 (2026-10-17)

Posters (WP16), from the change request `docs/engineering/change-requests/2026-10-17-poster-renderer.md`, accepted with the choices listed there. Database migration 0010 goes with it. Additive only: no endpoint, field, error code or scope action is removed or renamed, and no new error code. Also fixes a mock bug (below).

### New endpoints (90 to 95 operations)

| Endpoint                  | Call                                           | Auth  | Action          | Success                       |
| ------------------------- | ---------------------------------------------- | ----- | --------------- | ----------------------------- |
| `adminPosters.templates`  | `GET /v1/admin/poster-templates`               | staff | `poster.create` | 200 `PosterTemplatesResponse` |
| `adminPosters.create`     | `POST /v1/admin/sessions/{sessionId}/posters`  | staff | `poster.create` | 202 `PostersResponse`         |
| `adminPosters.list`       | `GET /v1/admin/sessions/{sessionId}/posters`   | staff | `poster.read`   | 200 `PostersResponse`         |
| `adminPosters.regenerate` | `POST /v1/admin/posters/{posterId}/regenerate` | staff | `poster.create` | 202 `Poster`                  |
| `adminPosters.file`       | `GET /v1/admin/posters/{posterId}/file`        | staff | `poster.read`   | 200 PNG or PDF bytes          |

- **Templates.** `PosterTemplate { id, key, name { en, ur }, version, formats, provisional }`: the active `poster_templates` rows, for any role that holds `poster.create` somewhere (the API checks the role, not a place). Template keys are open (`PosterTemplateKey`, lower-case slug up to 40 characters), not a closed list: the renderer's own templates (`DEMO_POSTER_TEMPLATES`: `cloud`, `night`, all four formats, provisional) are the demo templates until the final designs, which arrive as new keys with no contract change.
- **Make.** Body `PosterCreate { templateKey, language: en | ur | en_ur | ur_en, formats (1 to 4, no repeats), fields: PosterFields }`. A title is required in every language shown (issue `fields.title.<locale>`, code `custom`). The server builds the snapshot from the session (`posterSnapshotFromSession`, `sessionVersion` = the session's `updatedAt`), inserts one queued `posters` row per format and enqueues one `poster-render` job (`PosterRenderJob { posterIds }`, queue `POSTER_RENDER_QUEUE`). Unknown or inactive template key: `not_found` (rule for unknown references). A format the template does not offer: `validation_failed` with `{ path: 'formats', code: 'invalid_value' }`.
- **List.** `Poster { id, sessionId, templateKey, format, language, locale, fields, status, failureCode, altText, fileUrl, sourceSnapshot, outOfDate, replacesPosterId, createdAt }`, newest first. `outOfDate` is `{ reasons: ('time' | 'venue')[] }` or null, from `posterOutOfDate(row.sourceSnapshot, snapshot of the session now)`. `fileUrl` is set when `ready` (the `adminPosters.file` path, or a short-lived signed URL, as the storage allows); `failureCode` when `failed`.
- **Regenerate.** Same template, language, format and fields; a fresh snapshot; a new queued row with `replacesPosterId`. The worker deletes the old row and its file once the new one is ready. A poster still `queued`: `conflict`.
- **File.** The stored bytes, `image/png` (story, link preview) or `application/pdf` (A4, A3), `Content-Disposition: attachment`. Not `ready`: `conflict`. New success content type `application/octet-stream` in `EndpointDef` (OpenAPI lists `image/png` and `application/pdf`, binary); the typed client returns a `Uint8Array`.

### Shared with the renderer and the worker

Moved from `apps/poster-renderer/src/` with the same JSON shapes (checked schema for schema against the renderer's copies): `PosterSourceSnapshot` (= `SourceSnapshot`), `posterOutOfDate` (= `outOfDate`, its tests moved too), `posterSnapshotFromSession` (= `snapshotFromSession`), `PosterFields` (title max 80, details max 140, control and bidi override characters refused), `PosterLanguage`, `PosterAccent` (`tanzeem`, `deep`, `night`), `PosterQrTarget`, `posterLanguagesOf` (= `languagesOf`), `RendererRenderRequest` (= `RenderRequest`), `RendererRenderResponse` (= `renderBody`'s JSON), `RendererErrorResponse`. One difference: `templateId` is a `PosterTemplateKey`, not the enum `cloud | night`; the renderer keeps refusing a key it has no template for. New helpers for the worker: `POSTER_FAILURE_CODES` (`invalid_request`, `text_too_long`, `busy`, `render_timeout`, `render_failed`), `POSTER_FAILURE_RETRYABLE` (only `busy`, `render_timeout`, `render_failed` are retried), `posterFailureFromRenderer(status, code)`, `posterStorageKey(sessionId, cacheKey, contentType)` (`posters/<session>/<cache key>.<png|pdf>`, as `runPosterJob`).

### Scopes

Two new actions; `SCOPES.md` regenerated.

| Action          | Level | Who                                                                                                     |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `poster.create` | venue | national admin everywhere; city coordinator for venues in their city; venue coordinator for their venue |
| `poster.read`   | venue | the same                                                                                                |

Checked at the session's venue (for `posterId` routes, the poster's session's venue). A known session or poster outside the caller's scope is `forbidden`.

### Database (migration 0010)

`posters.language` (poster language, check against `POSTER_LANGUAGES`; its leading language must equal `locale`), `posters.failure_code` (check against `POSTER_FAILURE_CODES`; only on `failed` rows), `posters.alt_text` (jsonb object), `posters.replaces_poster_id` (self reference, set null on delete), `poster_templates.provisional` (boolean, default true). All poster columns are nullable, so rows made before 0010 stay valid. The rollback drops the new columns and keeps the poster rows. The development seed inserts the two demo templates.

### Mock

Handlers and fixtures for every poster endpoint: `posterTemplates` (the demo templates), `posters` (synthetic: a ready story, a ready A4 made at an older start time so it is out of date on time, a failed one with `text_too_long`, a ready Lahore link preview, and a queued regeneration), `fixturePosterSnapshot`. Scope-checked per role; `adminPosters.file` answers a stand-in 1x1 PNG or one-page PDF.

**Fixed:** `createMockHandler` answered every 204 endpoint before looking up its handler, so `adminDailyAyahs.delete` for an unknown id answered 204 instead of `not_found` (rc.4 says `not_found`). Registered handlers now run for 204 endpoints too: a `Response` they return stands, anything else becomes 204; endpoints without a handler answer 204 as before. `adminDailyAyahs.delete` has a handler that answers `not_found` for an unknown pick.

### Not in this version

- The `poster.*` wording (printed text and alt text) and the poster screen keys belong to `@qc/i18n` and the lanes that use them; `i18n-keys.md` now names the `poster`, `admin.posters` and `console.posters` namespaces.
- `RENDERER_URL` / `RENDERER_TOKEN`, the poster file storage and the container are the platform lane's; the `poster-render` queue handler is the messaging lane's.
- Share cards (WP17): the user-app lane chooses between `adminPosters.create` with `link_preview` and a public `og:image` route; a public route would be a new change request.

## 1.0.0-rc.4 (2026-10-17)

The next features decided with the owner (`docs/product/features-next.md`), from the change request `docs/engineering/change-requests/2026-10-17-next-features.md`, accepted by the orchestrator as proposed (items 1 to 7). Database migration 0009 goes with it. Additive only: no endpoint, field, error code or scope action is removed or renamed, and no new error code. New response fields are optional in the TypeScript type only (the server always sends them), so rc.3 payloads, fixtures and hand-written test data still parse and typecheck. Quran text is never stored or returned: an ayah is a surah and an ayah number.

### New endpoints (80 to 90 operations)

| Endpoint                 | Call                                                           | Auth   | Action                |
| ------------------------ | -------------------------------------------------------------- | ------ | --------------------- |
| `readingDays.record`     | `POST /v1/me/reading-days`                                     | user   | `reading.manage`      |
| `readingDays.list`       | `GET /v1/me/reading-days?from&to`                              | user   | `reading.manage`      |
| `community.today`        | `GET /v1/community/today`                                      | public | `community.read`      |
| `ayahOfTheDay.get`       | `GET /v1/ayah-of-the-day?date&venueId&circleId`                | public | `daily_ayah.read`     |
| `adminDailyAyahs.list`   | `GET /v1/admin/daily-ayahs?from&to&scopeType&venueId&circleId` | staff  | `daily_ayah.manage`   |
| `adminDailyAyahs.put`    | `PUT /v1/admin/daily-ayahs`                                    | staff  | `daily_ayah.manage`   |
| `adminDailyAyahs.delete` | `DELETE /v1/admin/daily-ayahs/{dailyAyahId}`                   | staff  | `daily_ayah.manage`   |
| `memorisation.list`      | `GET /v1/me/memorisation`                                      | user   | `memorisation.manage` |
| `memorisation.put`       | `PUT /v1/me/memorisation/{surah}`                              | user   | `memorisation.manage` |
| `memorisation.delete`    | `DELETE /v1/me/memorisation/{surah}`                           | user   | `memorisation.manage` |

- **Days read.** `readingDays.record` body `ReadingDayRecord { source: reader | goal | manual | portion, date?, pages?, ayahs? }`, answers the whole day as `ReadingDay { date, sources[], pages, ayahs }` (200, idempotent). One row per person, Pakistan date and source; `pages`/`ayahs` are the day's totals for that source, and a repeat keeps the larger value. `date` defaults to today in Pakistan; only today and yesterday are accepted (`readingDayDateIssue`, issue `{ path: 'date', code: 'out_of_range' }`). `attendance` is never sent by a client: the server adds it when a coordinator marks a named registrant. `readingDays.list` takes inclusive dates, at most 366 days (`readingRangeIssue`: `invalid_range` on `from`, `too_big` on `to`), days without reading left out. Own data only, for every role.
- **Community total.** `CommunityToday { date, readersToday, pagesTogether }`, one national number for today's Pakistan date, counted without user ids (table `community_days`), no breakdown. `pagesTogether` is today's pages (it grows through the day), not an all-time sum.
- **Ayah of the day.** `AyahOfTheDay { date, surah, ayah, source: national | venue | circle | built_in, venueId, circleId }`. Rule in `resolveDailyAyah`: exactly one pick of a followed venue or circle that day wins; otherwise the national pick; otherwise the built-in list (`BUILT_IN_DAILY_AYAHS`, 93 well-known references, numbers only; `builtInAyahFor(date)` walks it day by day). The endpoint is public: the app sends the ids it follows as repeated `venueId` / `circleId` (max 50 each), a signed-out visitor sends none. The worker's morning push resolves the same rule from the `follows` table.
- **Admin picks.** `DailyAyahPut { date, scope: { type: 'national' } | { type: 'venue', venueId } | { type: 'circle', circleId }, surah, ayah }` sets or replaces the pick for that date and scope and answers `DailyAyahEntry { id, date, scopeType, cityId, venueId, circleId, surah, ayah, updatedAt }`. The ayah must exist in the surah (`isAyahInSurah`, `AyahRef`). Unknown venue or circle: `not_found`. `adminDailyAyahs.delete` (not in the request; added so the console's curated list can remove a pick) answers 204. The list shows national picks to every caller and place picks in scope.
- **Memorisation.** `MemorisationResponse { items: MemorisationEntry[], reviseAfterDays }`, `MemorisationEntry { surah, status: learning | memorised | revising, lastRevisedAt, updatedAt }`. `memorisation.put` body `{ status, markRevised? }`: `markRevised` stamps `lastRevisedAt`; marking a never-revised surah `memorised` stamps it too. `memorisation.delete` is 204 whether or not the surah was marked. `needsRevision(entry, now, days)` is the "revise this week" rule (memorised and not revised within the setting). No reminders.

### Changed, additive

- `Profile.dailyGoal` (`DailyGoal { unit: pages | rukus | minutes, amount: 1..604 }` or null) and `Profile.memorisationReviseAfterDays` (1..365 or null = `MEMORISATION_REVISE_AFTER_DAYS_DEFAULT`, 14). Both optional in the type only. `ProfileUpdate` accepts both; null clears. The revise-after setting is per person (on the profile), because the tracker is private; it is not a platform setting.
- `CONSENT_PURPOSES` gains `ayah_daily`: the morning ayah push, push only and on by default. `DEFAULT_ON_CONSENTS`, `consentDefault(channel, purpose)` and `consentGranted(channel, purpose, rows)`: no row means on, a revoked row means off. `ConsentSet` refuses `ayah_daily` on any channel but push, or with a venue (issue on `channel`). `CONSENT_PURPOSE_CHANNELS` says so.
- Feature flags (Gate 4: each feature behind a flag): `reading_days`, `community_today`, `ayah_of_the_day`, `memorisation`, `read_along` (`NEXT_FEATURE_FLAGS`, in `FEATURE_FLAGS`). Off unless a `feature_flags` row turns them on, like every flag. In `AppConfig.featureFlags` they are optional in the type only; read them with `featureOn(flags, key)` (missing is off). The API's flag resolver already covers new keys.
- `DeepLink` gains `{ type: 'quran', surah, ayah }`, built as `/quran?surah=…&ayah=…` (the user app's existing reader route) and parsed back.
- New vocabularies: `READING_DAY_SOURCES`, `READING_DAY_CLIENT_SOURCES`, `DAILY_GOAL_UNITS`, `MEMORISATION_STATUSES`, `DAILY_AYAH_SCOPES`, `AYAH_OF_THE_DAY_SOURCES`. Helpers: `pakistanDate`, `addDays`, `readingDayDateIssue`, `readingRangeIssue`, `resolveDailyAyah`, `builtInAyahFor`, `needsRevision`, `dailyAyahResource`.
- `PushData.type` gains `ayah_of_the_day` (joint change with the messaging lane, which maps it to the consent purpose `ayah_daily` in `PUSH_TYPE_PURPOSE`): the worker's morning ayah push, with a `quran` deep link. No other push field changes.
- Mock server: handlers for every new endpoint from new fixtures (`dailyAyahs`, `fixtureReadingDays`, `fixtureMemorisation`, `fixtureCommunityToday`, all synthetic); the rc.4 flags are on in the mock config; staff picks are scope-checked per role. `fixtureMe.profile` has `dailyGoal: null` and `memorisationReviseAfterDays: null`.

### Scopes

Five new actions; `SCOPES.md` regenerated.

| Action                | Level  | Who                                                                                                                                                           |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `community.read`      | public | everyone                                                                                                                                                      |
| `daily_ayah.read`     | public | everyone                                                                                                                                                      |
| `reading.manage`      | self   | the signed-in person, own data only (no staff access)                                                                                                         |
| `memorisation.manage` | self   | the signed-in person, own data only (no staff access)                                                                                                         |
| `daily_ayah.manage`   | venue  | national admin everywhere, including national picks; city coordinator for venues and circles in their city; venue coordinator for their venue and its circles |

Check a pick with `can(principal, 'daily_ayah.manage', dailyAyahResource(scopeType, place))`: a national pick is checked with no place, so only a national admin passes; a circle pick at the circle's venue. Lists use `scopeFilter(principal, 'daily_ayah.manage')`.

### Database (migration 0009)

Tables `reading_days` (unique user, day, source; cascade on user delete), `community_days` (day primary key, readers, pages; no user id, kept on account deletion), `daily_ayahs` (unique day, scope and place; scope shape check; ayah-in-surah check; cascade with its city, venue or circle; `set_by` set null), `memorisation` (unique user, surah; cascade). `profiles.daily_goal_unit`, `daily_goal_amount` (both or neither), `memorisation_revise_after_days`. `consents_purpose_chk` allows `ayah_daily`. The rollback removes the feature data, including `ayah_daily` consent rows. The seed adds the five sample picks.

### Not in this version

- Push and Home wording (English and Urdu draft) belongs to `@qc/i18n` and the apps.

## 1.0.0-rc.3 (2026-10-17)

Closes the gaps the Wave 2 follow-up left between rc.2 and the API. Additive only: no endpoint, field, error code or scope action is removed or renamed, no new endpoint, no database change (migration 0008 already has `coordinator_invites.replaces_assignment_id`). The `SCOPES.md` matrix is unchanged.

### Changed, additive

- `Invite.replacesAssignmentId` (uuid or null): the assignment a handover invite replaces, on the `adminRoles.invite` response and on each item of `adminRoles.invites`. The API always sends it (null for a plain invite). It is optional in the TypeScript type only, so rc.2 payloads and hand-written test data still parse and typecheck.
- Resend of a handover: copy `replacesAssignmentId` from the listed invite into the new `InviteBody`. That works for a lapsed invite too. A resend of a still-pending handover invite keeps the link even when the body leaves it out, as long as the replaced assignment is still live (an ended one is dropped rather than carried). A `replacesAssignmentId` that is unknown, ended or at another place is `not_found`, as before. Documented on `adminRoles.invite`.
- `IMPORT_SERVER_ISSUE_CODES` gains `invalid_range`: a recurring session row whose `endsOn` is before its `startsOn` (same day is fine). It is the code `adminRegistrations.export` already uses for a backwards `from`/`to`. New type `ImportServerIssueCode`.
- `adminImport.venues`, `adminImport.coordinators`, `adminImport.sessions` list `conflict` (409): a file that clashes with a write made by someone else between the check and the write (a unique index trips) is refused as a whole and nothing is written. Sending it again is safe; the rows already there come back as `duplicate`.
- `adminRegistrations.export` lists `not_found`: a `cityId` or `venueId` that does not exist is `not_found` for a caller who holds `registration.export` anywhere, and `forbidden` for someone with no export right at all (the rule for unknown ids in a request, as for body references since rc.2; ADR 0011). A known city or venue outside the caller's scope stays `forbidden`.
- Mock: `adminRoles.invite` echoes the body (number, role, place, handover) instead of generated values; `adminRegistrations.export` answers `not_found` for ids the fixtures do not have and `forbidden` for a known venue or city outside the caller's scope.

### Changed on the server (no contract shape change)

- The import race used to answer 400 `validation_failed` with the request-level issue `{ path: 'rows', code: 'changed_during_import' }`, which no contract listed. It now answers 409 `conflict`. Why `conflict` instead of a new issue code: the file itself was valid, the code is not about any one row (so it does not belong in the per-row list), and `conflict` already means "this clashes with something that exists; refresh and try again", which is what the person should do. Clients that show `errors.conflict` need no change.
- The scoped export used to refuse an unknown `venueId` with 403, like a venue out of scope, and gave a national admin an empty file for an unknown `cityId`. Both are now `not_found` for staff.

## Between rc.2 and rc.3: mock server and fixtures only (2026-10-17)

No change to the endpoint registry, the schemas, the scope matrix or `openapi.json`; the contract stays at 1.0.0-rc.2. The mock now serves staff screens.

- Staff sign-in. `staffAccounts` in `@qc/contracts/fixtures` holds one account per role. Ask for a code to its synthetic number, then verify with `123456`:

  | Number          | Token        | Role                                                  |
  | --------------- | ------------ | ----------------------------------------------------- |
  | `+923000000201` | `mock-venue` | venue coordinator, Sample Masjid Al-Noor (Rawalpindi) |
  | `+923000000202` | `mock-city`  | city coordinator, Rawalpindi                          |
  | `+923000000203` | `mock-staff` | national admin                                        |

  `me.get` returns the matching `Me` with its role, and `auth.refresh` with the account's refresh token keeps the role. Any other number signs in as the attendee (`mock-user`, `fixtureMe`), as before.

- Staff tokens are checked with `can` and `scopeFilter`: a role the endpoint's actions do not allow gets `forbidden`; a known session, occurrence, venue or circle (or a body place on creates, update previews and posts, invites and assignments) outside the caller's scope gets `forbidden`, or `not_found` on `adminSessions.get` and `adminCircles.get`. Ids the fixtures do not have go on to the handler.
- Fixture-backed handlers instead of generated rows: `adminVenues.list`, `adminSessions.list`, `adminCircles.list` (scoped, with their filters), `adminSessions.occurrences` (from, to, limit), `adminAttendance.get` (fixture headcount, no entries, not marked) and `registrations.forSession` (`staffRegistrants`: six invented people per session, numbers in the fixture range). Unknown session or occurrence: `not_found`. `adminRegistrations.export` is scoped to the caller.
- Handlers passed to `createMockHandler` get `me` and `principal` on their context (`MockContext`).

## 1.0.0-rc.2 (2026-10-17)

Approved by the owner in `docs/engineering/change-requests/2026-10-17-digest.md`. Database migration 0008 goes with it. Existing endpoint ids and shapes keep working, with one exception (see "Not additive").

### New endpoints (73 to 80 operations)

- `adminImport.venues`, `adminImport.coordinators`, `adminImport.sessions`: `POST /v1/admin/import/{kind}`, body `{ dryRun, rows }`, 1 to 2000 rows. The result is `{ dryRun, applied, counts, rows[] }` with one entry per row: `created`, `duplicate` or `invalid`, and `issues: { path, code }[]` for invalid rows. Nothing is written unless `dryRun` is false and no row is invalid. A duplicate is skipped, not an error. Server-only issue codes are listed in `IMPORT_SERVER_ISSUE_CODES` (`invalid_reference`, `area_not_in_city`, `forbidden`). `checkImportRows(kind, rows)` runs the per-row schema check so the server and the mock agree. Idempotent.
- `adminRegistrations.export`: `GET /v1/admin/registrations/export?cityId=&venueId=&from=&to=`, `text/csv`. Header is `REGISTRATION_EXPORT_COLUMNS`. UTF-8 without a byte order mark (the console adds it). People-supplied text starting with `= + - @`, tab or carriage return is neutralised (`csvCell`, exported from `@qc/contracts`). `from` and `to` are inclusive Pakistan-local dates of the registration. At most `REGISTRATION_EXPORT_MAX_ROWS` (50,000) rows. `registrations.export` stays as it was.
- `adminSessions.get`, `adminCircles.get`: one record, the same shape as the list entry. Out of scope answers `not_found`.
- `adminUpdates.preview`: `POST /v1/admin/updates/preview`, the same body as `adminUpdates.post`, returns `{ recipients }`. Sends nothing.

### Changed, additive

- `InviteBody.replacesAssignmentId` (optional, city and venue invites): a handover. When the invite is accepted the new assignment is created and the old one revoked in one transaction.
- Resend an invite = a new `adminRoles.invite` for the same number, role and place. It replaces the pending invite with a new expiry and sends the message again. There is no separate resend call. Documented in the endpoint description.
- Settings: `reminderLeadMinutes { dora, circles }`, each 5 to 1440 minutes, default 60. The response schema uses a default, so older stored settings still parse. `SettingsUpdate` accepts a partial `reminderLeadMinutes`. `whatsappDailyCapPerPerson` stays 0 to 5.
- `me.delete` lists `last_national_admin`. No new error code: it was already one of the 24.
- `not_found` is allowed on `registrations.create`, `adminCircles.create`, `adminSessions.create`, `adminRoles.invite`, `adminRoles.assign`, `adminUpdates.post`, `adminUpdates.preview` and `follows.create`, for a body that points at nothing.
- `CircleUpdate.status` (`published` or `archived`) archives a circle.
- Types exported: `StaffRoleAssignment`, `AuditEntry`, `Attendance`. `ApiClientError.issues` (fifth constructor argument, optional) carries the `{ path, code }[]` of a `validation_failed` answer. `QueryBool` documents that the client sends the strings `'true'` and `'false'`.
- `@qc/contracts/bookmarks` (new subpath): `mapV1Bookmarks`, `AYAH_COUNTS`, `V1_BOOKMARKS_KEY`, `MAX_IMPORT_ITEMS`. `tools/migration` re-exports them.
- Endpoint registry entries can carry a `description`, which the OpenAPI document shows on the operation.
- Mock server, fixtures (`importExamples`, `adminSessions`, `sampleRegistrants`) and tests cover every new endpoint.

### Scopes

No new scope action. The new endpoints reuse existing actions, so no role gains any power and the `SCOPES.md` matrix is unchanged:

| Endpoint                    | Action                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `adminImport.venues`        | `venue.create`                                                                                                   |
| `adminImport.coordinators`  | `role.assign_national_admin`, `role.assign_city_coordinator`, `role.assign_venue_coordinator` (per row, by role) |
| `adminImport.sessions`      | `session.create`                                                                                                 |
| `adminRegistrations.export` | `registration.export`                                                                                            |
| `adminSessions.get`         | `session.list_admin`                                                                                             |
| `adminCircles.get`          | `circle.list_admin`                                                                                              |
| `adminUpdates.preview`      | `update.post_national`, `update.post_city`, `update.post_venue` (by body scope)                                  |

### Not additive

- `CircleDecisionBody.note` is removed. The server never stored it (personal text must not reach the audit log). A body that still sends `note` is not refused: unknown keys are stripped.

### Database (migration 0008)

`auth_sessions.previous_refresh_token_hash` and `rotated_at`; `users.display_name` nullable; `otp_challenges.locale`; `message_outbox.venue_id` and `provider_message_id`; `legacy_whatsapp_subscribers` unique `(season_tag, phone_raw)`, E.164 check and `city_id`; and `coordinator_invites.replaces_assignment_id` (needed for handover; not in the original request, can be dropped if the owner prefers another way).

### Deferred

Push delivery acknowledgement (Wave 4), server-side template values, optional English in `LocalizedInput`.
