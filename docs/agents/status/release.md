# Status: release

Updated: 2026-10-26
Branch: lane/release/play-readiness

## Done

- Android build audit for the first Google Play release: nothing in `app.config.ts` or `eas.json` needed changing (package `pk.doraquran.circles`, targetSdk 36, AAB on the production profile, location and storage permissions blocked, no deep links so no `assetlinks.json`). Findings and the runbook: `docs/release/play-launch.md`.
- The public pages (privacy, delete account, support, terms, store) still described sign-in with a WhatsApp code. Fixed in `packages/i18n` (English and Urdu, Urdu as drafts) and `apps/user-app/src/screens/public/pages.ts`: sign-in is an emailed code, Resend is named as the email processor, the WhatsApp number is collected at sign-up and not verified by a code. `play-console.md` data-safety table and app-access text updated to match (email address added as a collected type).
- Reviewer access plan for Play review written (`play-console.md`, decision 5): a reviewer mailbox `playreview@qurancircles.doraquran.pk` for the first production review, an auth allow-list as the stronger follow-up.
- Checks: `@qc/i18n` tests 40 passing; `apps/user-app` public screens tests 80 passing; `tsc` clean.

## In progress

- Store graphics (512 icon, 1024x500 feature graphic, phone screenshots in English and Urdu) into the owner's `play-assets` folder.

## Blocked

- Reviewer allow-list in the auth module (one configured email with a fixed code, off by default): auth-scopes lane, needs human approval.
- Splash screen (`expo-splash-screen`): optional polish, a dependency change for the user-app lane.

## Questions for the orchestrator

- The `tools/store-assets/capture` script still drives the old seat-booking flow; the screenshots for Play were taken with a one-off script and the capture script should be rewritten for the join pledge.
