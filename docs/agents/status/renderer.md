# Status: renderer

Updated: 2026-10-25
Branch: lane/renderer/poster-renderer (not committed; the orchestrator commits)

## Done

- 2026-10-25 (owner request): **halaqa flyer lines on `quranic_circles`.** `fields.flyer` (contract change request `2026-10-25-halaqa-flyer`) carries an address per language, a phone and two https links. The template prints them under the venue and draws the links as two captioned QR codes ("WhatsApp group", "Google location") in place of the registration code; with no links it is unchanged. All four formats in en, ur and en_ur render (checked by eye: en story, ur story, en_ur A4); a bilingual page prints the address once and shrinks the codes so text still fits. Link previews leave the flyer lines out. `@qc/poster-renderer`: 205 tests with Chromium.

- 2026-10-25 (owner request, from Canva): **new template `quranic_circles`**, the owner's first final design (not provisional), rebuilt from page 14 of the Canva design "Quranic Circles". The photo layer (hand holding the Mushaf on deep green, Tanzeem marks at top and foot) is bundled as `assets/art/quranic-circles.jpg` (1080x1350 JPEG, exported from a working copy in Canva with the live text, icons and QR codes removed; source and checksum in `assets/art/SOURCES.md`), embedded as a `data:image/jpeg` URL and checked by `src/art.ts` like the fonts. The template draws the title as the headline (white, uppercase in English), the details as the cream tagline, a green band with the day and time, the venue and area, and the QR code on a white card with "Scan to register"; link previews put the photo at the trailing side and leave out the tagline. All four formats in all four languages render (`render:sample`, checked by eye: story en, story ur_en, A4 en_ur, preview ur_en). The tests that assumed only `cloud` and `night` now list three templates; `templates.test.ts` allows embedded JPEG art next to fonts. Registered in the contract's `DEMO_POSTER_TEMPLATES` (`packages/contracts`, provisional false) so the seed and fixtures carry the row: a contracts-lane change made in the same commit at the owner's request; production still has no path that inserts template rows other than the seed. `@qc/poster-renderer`: 200 tests in 15 files with real Chromium (Playwright 1.56.1 headless shell); `@qc/contracts` posters tests and `@qc/console` tests pass (two contracts tests, the OpenAPI and SCOPES.md snapshots, fail on this Windows checkout only because of CRLF line endings, before and after this change).

- 2026-10-25 (orchestrator task, no renderer code changed): the e2e stack (`tests/e2e/src/stack/stack.ts`) now starts the renderer and wires the worker to it; verified English, Urdu and mixed posters as PNG and PDF through the API and the console. Sample posters (`render:sample`) checked by eye: Urdu title, QR and mixed text lay out correctly. Needs Playwright's headless Chromium locally.

- 2026-10-18 (security review SEC-08, SEC-11, orchestrator clearance): **fails closed.** `APP_ENV` unset or empty now means `production` (as in the API); `RENDERER_TOKEN` (and `PUBLIC_WEB_BASE`) are required unless `APP_ENV` is exactly `development` or `test`, any other value refuses to start. Run locally with `APP_ENV=development pnpm --filter @qc/poster-renderer start`. **Second guard for text:** `blocksOf` strips the contract's `SafeText` characters (`stripUnsafeText` from `@qc/contracts`) from title, details, venue and area before drawing and in alt text, so only the template's own isolates (decision 0012) set direction; the request itself is already refused by the contract. Tests in `config.test.ts` and `input.test.ts`. `@qc/poster-renderer`: 175 tests in 15 files, typecheck passes.

- **Urdu go/no-go: go.** Decision record `docs/engineering/decisions/0012-poster-urdu-rendering.md` (status proposed, waiting for the orchestrator to accept). Mehr Nastaliq Web and Figtree in headless Chromium (Playwright 1.56.1) shape correctly; three rules came out of it (isolate Latin runs in Urdu, Figtree-first stack for spaces and digits, Urdu line height 2.0 or more and no clipping) and the templates follow them.
- **`apps/poster-renderer` (`@qc/poster-renderer`)**: Hono service on the internal network. `GET /healthz`, `GET /templates`, `POST /render` (template id, formats, language, editable fields, session snapshot; answers the files as base64 plus the source snapshot, the deep link and alt text). Bearer token (`RENDERER_TOKEN`) on everything but `/healthz`; 64 KB body limit; errors are codes only (`validation_failed` with paths, `text_too_long` with box names, `busy` + Retry-After, `render_timeout`, `render_failed`).
- **Limits**: concurrency limit with a bounded queue (overflow answers 503 at once), one deadline per request, Chromium heap cap (`--js-flags=--max-old-space-size`), browser restarted every N renders or after a crash, fresh context per page.
- **Isolation** (tested against a local HTTP server that counts hits, with a positive control): page scripts off, a strict CSP in every template, every request aborted in Playwright, plus launch flags that hold on their own (no DNS, a dead proxy for every host including loopback, offline context). `file://` images and stylesheets do not load. Field values are escaped and isolated; control and bidi override characters are refused.
- **Templates** (provisional, locked): `cloud` (light, green band) and `night` (full green, gilt frame), each at story 1080x1920 PNG, A4 and A3 PDF (one page, fonts embedded) and link preview 1200x630 PNG; languages `en`, `ur`, `en_ur`, `ur_en`; mixed text (English venue names inside Urdu, Urdu inside English) isolated automatically. Accents from a fixed palette (`tanzeem`, `deep`, `night`), contrast tested for every template and accent. Text shrinks to a floor, then wraps, then is refused naming the box; never clipped. Date and time come from the session snapshot, not typed by editors.
- **QR code**: `qrcode-generator@2.0.4` (new dependency, MIT, no dependencies), error correction M, 4-module quiet zone, on white. Encodes `buildDeepLink({ type: 'register' | 'session', sessionId }, PUBLIC_WEB_BASE)` from `@qc/contracts`. A test reads every module back out of the exported PNG and compares it with the code; at least 280 px on a story and 28 mm in print.
- **Job, cache, out of date**: cache key = template and version, format, language, fields, the whole snapshot including `sessionVersion`, and the link (in-memory LRU with a byte budget). `runPosterJob` (`src/job.ts`) stores files under content-addressed keys and returns what `posters` needs. `outOfDate(made, current)` returns `time` and/or `venue` from the stored `source_snapshot`. `pnpm --filter @qc/poster-renderer render:sample [out-dir]` renders all 32 combinations from synthetic data and shows the job, a cache hit and a time change being flagged.
- **Fonts**: unmodified copies of Figtree (400, 600, 700; OFL) and Mehr Nastaliq Web (CC BY-SA 4.0) in `apps/poster-renderer/assets/fonts/` with `LICENSES.md`, the OFL text and checksums; checked at start and in tests. KFGQPC is not bundled (no Quran text on posters). PDFs embed font subsets, which is normal PDF embedding; KFGQPC would need a different decision if it is ever added.
- **Dockerfile**: now `infra/docker/poster-renderer.Dockerfile` (the platform lane pinned the base by digest; the old copy in `apps/poster-renderer/` was removed). Not built here (no Docker daemon); the same esbuild bundle was built and run locally and served real renders.
- **Contract 1.0.0-rc.5 adopted** (follow-up to the change request). The renderer's own copies are gone: `src/snapshot.ts` deleted; `src/input.ts` is now `RendererRenderRequest` from `@qc/contracts` plus one rule (a well-formed key with no template here is refused as `validation_failed`, issue `{ path: 'templateId', code: 'invalid_value' }`, which the worker maps to `invalid_request`; own keys only, so `constructor` is refused too); `PosterLanguage`, `PosterAccent` (`POSTER_ACCENTS`), `PosterQrTarget`, `PosterFields`, `PosterSourceSnapshot`, `posterOutOfDate`, `posterLanguagesOf`/`posterLocaleOf`, `POSTER_FAILURE_RETRYABLE` (in `classify`) and `posterStorageKey` (in `runPosterJob`) come from the contract. `/render` answers are typed `RendererRenderResponse` (`renderBody`), every error body `RendererErrorResponse`. `TEMPLATES` (`src/templates/index.ts`) is the list of keys this renderer draws; `cloud` and `night` are the contract's `DEMO_POSTER_TEMPLATES` and report `provisional: true` until the final designs.
- **Poster wording moved to `@qc/i18n`**: the 12 `poster.*` keys (`scanToRegister`, `scanToOpen`, `dailyAt`, `onDateAt`, `listAnd`, `listComma`, `period.morning|noon|evening|night|lateNight`, `alt`) are in `packages/i18n/src/en.json` and `ur.json` (one insertion each, after `days.sun`; Urdu drafts under the file's `_meta.status` review marker). `src/strings.ts` now only reads the catalogue (`t`, `POSTER_KEYS`).
- New `src/contract.test.ts` (36 tests): the request schema agrees with `RendererRenderRequest` on 20 valid and invalid inputs (same success, issue paths and parsed value); open-but-unknown keys are refused over HTTP with the contract error shape and fail a job as `invalid_request`; `/render` 200 and every error body round-trip through the contract schemas; `classify` codes and retry flags equal `POSTER_FAILURE_CODES` / `POSTER_FAILURE_RETRYABLE`; stored keys equal `posterStorageKey`; templates equal `DEMO_POSTER_TEMPLATES`, all provisional; a colour for every `POSTER_ACCENTS`; every `poster.*` key in both catalogues with matching placeholders.
- Checks: `pnpm --filter @qc/poster-renderer test` (15 files, 170 tests: the 134 existing ones with imports adapted, plus 36 new; about 10 s with real Chromium), typecheck, `npx eslint apps/poster-renderer`, `npx prettier --check apps/poster-renderer packages/i18n` and `pnpm --filter @qc/i18n test` (2) all pass.

## In progress

- Nothing.

## Blocked

- Nothing in this lane. The contract side of the change request landed in 1.0.0-rc.5; the API endpoints (api-core), the `poster-render` worker (messaging) and the container (platform) are other lanes' work.

## Infra change for the platform lane (do not apply from this lane)

1. Move `apps/poster-renderer/Dockerfile` into `infra/docker/Dockerfile` as target `poster-renderer` (or keep it and point compose at it). Base is `node:22.22.0-bookworm-slim` (Chromium needs glibc, so not Alpine); **pin it by digest** as the api image is (it could not be resolved from here: registry rate limit). The build downloads Chromium's headless shell for Playwright 1.56.1 and installs its system libraries; nothing is fetched at run time.
2. Compose service (`infra/docker-compose.prod.yml`), internal network only, never routed by Caddy:

   ```yaml
   poster-renderer:
     image: ${QC_IMAGE_REGISTRY:-qc}/poster-renderer:${QC_IMAGE_TAG:-local}
     build: { context: .., dockerfile: apps/poster-renderer/Dockerfile, target: poster-renderer }
     restart: unless-stopped
     environment:
       APP_ENV: production
       RENDERER_PORT: '8090'
       RENDERER_TOKEN: ${RENDERER_TOKEN:?set RENDERER_TOKEN in the env file}
       PUBLIC_WEB_BASE: https://${QC_DOMAIN}
       RENDER_CONCURRENCY: '2'
       RENDER_QUEUE_MAX: '8'
       RENDER_TIMEOUT_MS: '20000'
       BROWSER_HEAP_MB: '128'
       BROWSER_RECYCLE_AFTER: '100'
       RENDER_CACHE_BYTES: '67108864'
     networks: [backend] # internal: true, so the container itself has no route out either
     read_only: true
     tmpfs: ['/tmp:size=256m'] # Chromium's profile and HOME=/tmp
     cap_drop: [ALL]
     security_opt: ['no-new-privileges:true']
     init: true
     stop_grace_period: 30s
     healthcheck:
       test:
         [
           'CMD',
           'node',
           '-e',
           "fetch('http://127.0.0.1:8090/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))",
         ]
       interval: 15s
       timeout: 5s
       retries: 3
       start_period: 20s
     deploy:
       resources:
         limits:
           { cpus: '${QC_RENDERER_CPUS:-1.0}', memory: '${QC_RENDERER_MEMORY:-768m}', pids: 256 }
   ```

   The api and the worker get `RENDERER_URL=http://poster-renderer:8090` and the same `RENDERER_TOKEN` (generate on the server: `openssl rand -hex 32`). Add both to `infra/ENV.md` and `.env.example` (fake value).

3. Chromium runs without its own sandbox (Playwright's default in containers); the container hardening above, the internal-only network and the in-browser blocks are the isolation. A seccomp profile that allows Chromium's sandbox is an option if the reviewer wants both.
4. Storage for poster files (volume or object store) is not decided; `runPosterJob` takes any `FileStore`.
5. CI: the root `pnpm test` now includes the renderer's browser tests, so the CI job needs Chromium's headless shell for Playwright 1.56.1 (`pnpm exec playwright install --only-shell chromium` or the e2e job's existing browser cache).
6. `eslint.config.js` (root, not this lane's file): add `@qc/poster-renderer` to `appPackages` so no app or package can import it. Still open; there is no such list inside `apps/poster-renderer`.

## Questions for the orchestrator

- Accept decision 0012 (Urdu go)? Then add it to `docs/engineering/decisions/README.md` (not this lane's file).
- `pnpm-lock.yaml` changed (new importer `apps/poster-renderer`, plus `qrcode-generator@2.0.4`); please commit it with this lane's files.
- Human approvals needed: the two provisional templates (render them with `render:sample` and look at all four languages and formats), and the container (Dockerfile and compose block above).
- Urdu wording on posters (now the `poster.*` keys in `packages/i18n/src/ur.json`) is a draft for native review, like the rest of the Urdu.
- Final poster designs: the owner said they come later. They arrive as new template keys (no contract change) and need a template in `src/templates/` plus a `poster_templates` row; until then `cloud` and `night` stay provisional.
- `docs/design/poster-direction.md` still names emerald, DM Sans and Gulzar; the templates follow D3/D4 instead (ui lane to update the file).
- Editors cannot type the date, time or venue: the renderer prints them from the session, so a poster cannot disagree with the session. The poster direction lists them as editable; confirm this is acceptable.

## Contract change requests

- `docs/engineering/change-requests/2026-10-17-poster-renderer.md`
