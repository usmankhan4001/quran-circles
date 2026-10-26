# Status: web (store pages)

Updated: 2026-10-26
Branch: lane/web/store-pages (not merged to `main`; merging deploys to production)

## Done

- **Public pages for Google Play**, as routes of the user app (`apps/user-app/src/app/`): `/welcome` (landing), `/privacy`, `/terms`, `/delete-account`, `/support`. English and Urdu (right to left), the kit's white plain screen, no sign-in, nothing fetched about the person. Screens in `src/screens/public/` (`pages.ts` holds the sections, `PublicPage.tsx` draws them, `PublicScreens.tsx` has the five screens). Routes added to `nav/routes.ts`; Profile now links to the privacy policy and terms.
- **Words** in `packages/i18n/src/{en,ur}/user-app.json`: `store.*`, `privacy.*`, `deleteAccount.*`, `support.*`, `terms.*`, `legal.*`, `profile.privacy`, `profile.terms`. Urdu drafts, with `_legal.status` as their review marker. Lawyer review recommended for the privacy policy and terms.
- **Contact email as a setting**: `EXPO_PUBLIC_CONTACT_EMAIL` (read in `platform/env.ts`); defaults to `support@qurancircles.doraquran.pk` (owner, 2026-10-25), so the pages never show a placeholder. Passed to the web build as `QC_CONTACT_EMAIL` (separate commit touching platform files: `infra/docker/proxy-staging.Dockerfile`, `infra/docker-compose.dokploy-prod.yml`, `infra/ENV.md`).
- **Accuracy**: the policy was written from the code: `packages/db` schema, `deleteAccount` in `apps/api/src/modules/me/profile.ts`, `app.config.ts` (Android location permissions are blocked), `platform/location*.ts`, the auth purge job, and `docs/security/review.md`.
- **Play Console doc**: `docs/release/play-console.md` (URLs, data safety answers, short and full descriptions in English and Urdu, 14 open decisions).
- Tests: `PublicScreens.test.tsx` (every page in 2 languages x 2 colour modes x 4 text sizes, placeholder and mailto, placeholders match in both languages, delete steps use the profile's own button wording, links, Profile entries). `@qc/user-app` 1220 tests pass; typecheck, eslint and prettier clean on the changed files.

## In progress

- Nothing.

## Blocked

- Who handles email deletion requests, and a go-ahead on the reviewer-access plan (or an auth-lane allow-list): see `docs/release/play-console.md`, "Things to decide".

## Questions for the orchestrator

- This lane edited `apps/user-app` (user-app lane) and three `infra/` files (platform lane) at the coordinator's request; the infra change is its own commit so it can be dropped or re-done by the platform lane.
- The new words add about 5.5 KB (English) / 7 KB (Urdu) gzip to the user app's language file. A separate on-demand `legal` part would avoid it; that touches `packages/i18n` and the web language loader.
- `pnpm check` fails the format step on this Windows checkout for every file (CRLF working copies against Prettier's LF rule); that is not from this change. The changed files pass `prettier --check` after `git add` normalises them.

## Contract change requests

- None.
