# Change request: single-record reads, a recipient count and a few small ergonomics for the admin app

Requested by: admin-app
Contract: API (`adminSessions`, `adminCircles`, `adminUpdates`, `adminTemplates`), schemas (`LocalizedInput`, `Attendance`), i18n keys
What I need:

1. `adminSessions.get` (`GET /v1/admin/sessions/:sessionId`) and `adminCircles.get` (`GET /v1/admin/circles/:circleId`), each returning the same record the list returns, scoped like the list.
2. A way to know how many people an update will reach before it is sent: either `adminUpdates.preview` (same body as `adminUpdates.post`, returns `{ recipients: number }`) or a `recipients` estimate on `adminTemplates.list`. The post response already carries the final count.
3. Template blanks filled by the server: let `PostUpdateBody` carry `templateKey` and `templateValues` (`Record<string, string>`), and have the server fill `{time}` and the like per language. Today the app fills them in the text it sends.
4. Make `en` optional in `LocalizedInput` when `ur` is present (at least one of the two), or say that copying Urdu into `en` is the intended answer. The app copies Urdu into `en` today, so an Urdu-only name is stored twice.
5. Export the `Attendance` type from `@qc/contracts` (only the schema is exported). The app derives it from the client's return type.
6. Confirm that `registrations.forSession` returns `phone` and `allowsWhatsapp` to the coordinator of that session only. The design (`admin-todays-registrants.md`) says the number is never shown; the build shows it, because the brief asked for numbers next to the call and WhatsApp buttons. If the number should stay hidden, the app drops the line and keeps the buttons.
7. Attendance recap and portion: the design (`admin-attendance.md`) puts them on the attendance screen. The contract has them on `adminOccurrences.update` (`recapNote`, `portion`), which is where the app edits them. Confirm that is the intended place.
8. New i18n namespaces used by the app, beyond `admin.registrants`, `admin.postUpdate`, `admin.schedule`, `admin.venueEditor`, `admin.circleEditor` and `admin.attendance`: `admin.signIn`, `admin.home`, `admin.scope`, `admin.account`, `admin.common`, `admin.places`, `admin.updates`, `admin.tabs`, `admin.occurrence`. All keys exist in English and Urdu (Urdu is a draft).

Why: items 1 and 2 stop the app from paging through whole lists to open one record, and from showing the recipient count only after sending. Items 3 to 5 remove small workarounds. Items 6 to 8 are confirmations.

Proposed change: as listed. All additions are optional fields or new reads; nothing existing changes shape.

Affected lanes: contracts, api-core, console (if it shares the reads), admin-app.

Workaround meanwhile: the app keeps a small session cache filled from `sessions.get`, finds a circle by paging `adminCircles.list` (up to ten pages of 100), shows who will be reached ("everyone who follows this venue") in the preview and the real count after sending, fills template blanks itself, copies Urdu-only text into `en`, and derives the `Attendance` type from the client.
