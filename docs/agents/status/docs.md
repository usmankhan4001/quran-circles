# Status: docs (public documentation)

Updated: 2026-10-26
Lane: docs, a new lane for the public site content. Branch `lane/docs/public-docs`. No pull requests, no GitHub Actions, never pushed to `main` (owner rule for this phase). The earlier builder left no saved work; this is a fresh start from the go-live branch.

Owns: `docs/public/` (source and generator), this status file. A change request asks the orchestrator to add the lane to `docs/engineering/ownership.md` (not edited here: it belongs to another lane).

## Done

- **Generator** `docs/public/build.mjs`: zero-dependency Node script. Markdown to static HTML for `en` and `ur`, with a skip link, language switch, four text sizes, light and dark, forced colours, a mirrored right-to-left layout, 48 px controls, no external requests and no inline script or style (works under a strict CSP). Fails the build on an image without a description, a link to no page, or a missing image. Run: `node docs/public/build.mjs --base /docs --out <folder>`. See `docs/public/README.md`.
- **API reference**, generated from `packages/contracts/openapi.json` (contract 1.0.0-rc.5): the 50 public operations (System, Sign-in, Me, Registrations, Discover, Places, Updates, Quran, Circles) with parameters, request bodies with examples, success shapes, errors and rate-limit bucket, plus the schemas. The error code table is read from `errors.ts` (24 codes).
- **Hand-written API pages:** overview and base URL, sign-in and tokens, errors/rate limits/retries/pagination, roles and permissions (plain language, from the scope matrix), why the staff API is not published, WhatsApp webhook (Meta to us only) and the fact that there are no outbound webhooks.
- **Guides:** member, coordinator and console, in English and Urdu (Urdu is a draft with the review notice; terms follow `packages/i18n/src/ur`).
- **Platform pages:** public-safe architecture and deployment overview, accessibility and languages.
- **ERPNext integration guide** with three options (public catalogue pull now; partner key plus change feed; outbound webhooks), push/pull comparison, Frappe-side examples and 15 numbered questions for Muhammad.
- **Change request** `docs/engineering/change-requests/2026-10-26-partner-api-and-webhooks.md`: the partner key, change feed and outbound webhook design, as a proposal.
- Checked: build passes (30 pages), prettier clean, eslint clean on `build.mjs`; viewed in the browser at desktop and 375 px (no horizontal scroll), light and dark, and right to left.

## Decisions taken (the owner can reverse them)

- The staff API (`/v1/admin`, 45 operations) is **not** published. Public pages describe it only in words.
- Sign-in ceilings, the invite cap, the poster allowance and backup details are left out. Published as plain defaults: the 300 a minute and 20 a minute (joining) buckets, the 5-minute code life, 15-minute access token and 30-day refresh token.
- Internal hostnames, the Dokploy host, secrets and environment variable values are not in the pages. The public site address `qurancircles.doraquran.pk` is.
- Joining is described as a pledge; no page mentions seats, a waiting list or a full state, except the one honest note that an optional limit still exists in the API.
- Docs live under their own folder and route (`/docs`, `docs/public/`), not in the landing page's files.

## Needs a decision (orchestrator or owner)

1. **Should the public API reference be public at all**, or only linked from the landing page for partners? It is complete and safe for visitor and member endpoints; the staff part stays out either way.
2. **Partner key and webhooks** (change request): approve, defer, or limit to the catalogue pull for ERPNext. Also whether any personal data may go to ERPNext.
3. **Add a `docs` lane** to `docs/engineering/ownership.md` and a root script (for example `docs:build`) in `package.json`, both platform-owned.
4. **Hosting:** the landing lane (`lane/web/store-pages`) should serve the build output under `/docs` and add a link. Needs the Caddy routes to allow the static files (they are plain files; no new headers needed).
5. **Urdu review** by a native speaker, then set `reviewed: true` in each page.

## Blocked or open

- **Screenshots.** The only captures in the repository are four test captures in `docs/quality/screens/` from the current build (some at the largest Urdu size), which are used and labelled as such. The redesigned apps have no captures yet, and the store-asset images from the shared folder are not in the repository. After the redesign lands: capture Home, Nearby, Session, Join, My Journey, the coordinator Today, Attendance and Post update screens, and the console Sessions, Exports and Import pages, put them in `docs/public/assets/screens/` and replace the four.
- **ERPNext facts.** Nothing about the instance (URL, version, DocTypes, fields, direction) is defined; the owner said on 2026-10-25 that all of it is still to be decided. The guide is now general: three options presented neutrally, every open question marked "to be decided", no decision implied. The Frappe snippets are examples, not tested against a real site.
- The reference rebuilds from the contract, but the hand-written pages quote some values (token lifetimes, default limits). They should be re-read whenever those change.
- The member guide says the Android app is on an internal test track (per `docs/release/go-live.md`); update when it reaches production.

## Questions for the orchestrator

- Is `docs/public/dist` to be committed for the landing build, or should its build run the script? I assumed the script is run at build time.
