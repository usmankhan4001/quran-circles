# Change request digest after Wave 2

The lanes filed 22 change requests. This digest groups the 18 that are not about the UI kit and gives a recommendation for each. The 4 kit and token requests wait for the UI redesign. Nothing here is applied yet. The contract and database are frozen at Gate 1, so each accepted item becomes one small, reviewed change in Wave 3.

## A. Database changes (one new migration, 0008)

| Request                                                                       | Recommendation | Why                                                                            |
| ----------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `auth-session-grace`: remember the previous refresh token for 10 seconds      | Accept         | Without it, a lost response or two PWA tabs sign the person out on mobile data |
| `users-display-name`: let the name be empty until registration                | Accept         | Replaces the `-` placeholder, which other code would otherwise show as a name  |
| `otp-locale`: keep the language chosen at sign-in                             | Accept         | New accounts would otherwise start in Urdu even if the person used English     |
| `outbox-venue-and-provider-id`: venue and provider message id on the outbox   | Accept         | Venue alerts and WhatsApp delivery receipts need them                          |
| `legacy-subscriber-keys`: unique phone per season, city on legacy subscribers | Accept         | Stops duplicate subscribers in the V1 import and enables re-consent by city    |

## B. API and contract additions

| Request                                                                                                      | Recommendation                                                   | Why                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `console-bulk-import`: bulk import endpoints with dry run, one transaction                                   | Accept                                                           | Today an import can half-finish; the design already assumes one transaction           |
| `console-export-scope`: one audited export per venue or city, with dates                                     | Accept                                                           | One audit row per export instead of one per session                                   |
| `console-user-lookup-handover`: invite with `replacesAssignmentId`                                           | Accept option (a)                                                | Handover to a new person becomes one step, and no phone lookup leaks accounts         |
| `push-delivery-ack`: apps confirm a push arrived                                                             | Defer to Wave 4                                                  | Only needed for delivery figures                                                      |
| `reminder-lead-setting`: reminder lead time in Settings                                                      | Accept                                                           | The owner can change it without a deploy                                              |
| `admin-app-contract-notes`: single-session and circle reads, recipient count before sending, template values | Accept 1, 2, 5; defer 3, 4                                       | The first three remove real friction; template filling and optional English can wait  |
| `api-core-contract-gaps`: `last_national_admin` error code, circle archive, a code for unknown ids           | Accept the error code and archive; drop the decision note column | Personal text should not be stored in the audit trail                                 |
| `console-contract-ergonomics`: export two types, keep validation issues on client errors, resend invite      | Accept                                                           | Small and removes workarounds in two apps; resend is a new invite for the same number |

## C. Code-only changes (no decision needed beyond a yes)

| Request                                                                                | Recommendation                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `auth-failure-reason`: export the reason a request has no signed-in person             | Accept                                          |
| `bookmark-import-home`: move the V1 bookmark mapper into contracts                     | Accept                                          |
| `user-app-content-mount`: three small exports from the content package                 | Accept                                          |
| `messaging-env-vars`: list the messaging variables in `.env.example` and compose files | Accept, done in Wave 3 with the deployment work |

## D. Questions that need your answer

1. **Phone numbers for coordinators.** The registrants screen currently shows the number next to the call and WhatsApp buttons. The design says never show it. Recommendation: hide the number and keep the buttons.
2. **Family sessions.** May a person register for a family session as women, men or family, or only as family? Recommendation: only the session's own section.
3. **Staff sign-in channel.** Should coordinator codes go over WhatsApp first? Recommendation: yes, with SMS as the fallback, the same as everyone else.
4. **Missing registrations in the V1 import.** A V1 registration whose venue cannot be matched is skipped and counted. Recommendation: keep skipping, so no registration points at a guessed venue.
5. **Reminder audience.** Reminders go to registrants and to followers of that circle who turned alerts on. Recommendation: keep both.
