# 0006: Console web tooling (bundler, router, styling, tests, import and export approach)

Status: accepted
Date: 2026-10-16
Lane: console

## Context

The console (`apps/console`) is a desktop web app for coordinators and national admins. Unlike the phone apps it needs routing, tables, wide forms and file handling, and it has no component kit for the web: `@qc/ui` is React Native. It must run against the contract mock with no server, work in English and Urdu (left to right and right to left), light and dark, and at larger text sizes.

## Options

Bundler and router: (1) Vite with React Router, (2) a framework such as Next.js or Remix.
Styling: (1) plain CSS with logical properties and CSS variables from the design tokens, (2) a utility or component library (Tailwind, MUI).
Tokens: (1) import the pure token files from `@qc/ui`, (2) copy the values.
Import: (1) parse and check the file in the browser, apply with the existing create calls, (2) wait for a bulk endpoint.
Export: (1) per-session export call, merged in the browser for a venue or city, (2) wait for a scoped export endpoint.

## Decision

- **Vite 8 and React Router 7 (library mode).** The console is a client-only app behind sign-in with no SEO or server rendering need. The dev server proxies `/v1` and `/health` to `CONSOLE_API_PROXY_TARGET` (default `http://localhost:4010`, the contract mock). The only configuration is `VITE_API_BASE_URL`, which is public.
- **Plain CSS, logical properties only, no UI library.** Every colour, space and radius is a CSS variable set from `@qc/ui` semantic colours, spacing and radii by the console's own `ThemeProvider` (`data-theme`, root font size from `textScale`). A test fails on `margin-left`, `left:` and `text-align: left|right`, and on any variable the stylesheet uses but nothing defines. Tables are real `<table>` elements with captions and row headers; dialogs trap focus and return it.
- **Tokens by relative path** (`src/lib/ui-tokens.ts`) until `@qc/ui` has a web-safe entry (change request `2026-10-16-console-ui-tokens-entry.md`). The `@qc/ui` main entry imports React Native, which the console must not bundle.
- **Client-side dry run, sequential apply.** The CSV is parsed with a small RFC 4180 reader (`src/lib/csv.ts`; no dependency) and every row is built with the contract request schemas (`VenueCreate`, `InviteBody`, `SessionCreate`), so what is sent is exactly what the API validates. A file with any invalid row cannot be applied. Rows that already exist are skipped, so running the same file again after a failure is safe. Apply calls the single create endpoints in file order and stops at the first failure. Reports never copy cell contents. The bulk endpoint is requested in `2026-10-16-console-bulk-import.md`.
- **Export by fan-out.** A venue or city export calls `registrations.export` for each session (each call is audited by the server) and saves nothing unless every call succeeded. The file starts with a UTF-8 byte order mark so spreadsheets open Urdu correctly. A single scoped call is requested in `2026-10-16-console-export-scope.md`.
- **Tokens in memory, refresh token in `sessionStorage`.** The 15-minute access token is never stored; a closed tab signs the person out (decision 0002). One refresh at a time, one retry after `token_expired`; a refused refresh token is forgotten.
- **Tests:** Vitest with jsdom and Testing Library, rendering the real app against `createMockHandler` through an injected `fetch`, so no network is used. Pages are tested in both languages where text or direction matters.

## Consequences

- Easier: no framework to run in production (any static host serves `dist/`); the whole console, including permissions, imports and exports, is tested in one `pnpm --filter @qc/console test`.
- Harder: the import and export are not atomic until the API grows the endpoints above; the relative token import must be replaced when `@qc/ui` gains a web entry; the bundle is one chunk (about 177 kB gzipped), which is fine for a staff tool, and routes can be split later if it grows.
- Revisit when the bulk and scoped export endpoints land, and when the admin app (React Native) and the console need a shared table or form spec.
