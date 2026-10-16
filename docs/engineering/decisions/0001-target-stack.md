# 0001: Target stack

Status: accepted (items marked proposal are open to change by a later record)
Date: 2026-10-16
Lane: orchestrator

## Context

V1 is a client-only React app that talks directly to Supabase and Neon, with secrets in the browser. V2 needs a real backend, real sign-in, reminders and WhatsApp, two apps, and an admin console, built by one orchestrator, a full developer and parallel agents.

## Decision

| Layer           | Choice                                                                                                                               | Status                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Database        | PostgreSQL with Drizzle ORM and SQL migrations in the repository                                                                     | Decided                               |
| API             | Hono (TypeScript) with Zod validation                                                                                                | Proposal                              |
| Sign-in         | Phone code with sessions, roles and scopes. Library to be evaluated (for example Better Auth), by a record from the auth-scopes lane | Proposal                              |
| Background jobs | pg-boss, a queue inside Postgres                                                                                                     | Proposal                              |
| Push            | FCM and APNs for the apps, web push for the PWA                                                                                      | Decided                               |
| WhatsApp        | Meta's official Cloud API behind a provider interface                                                                                | Decided                               |
| Apps            | Expo (React Native) for the user app and the admin app, with the PWA from the web target                                             | Decided                               |
| Admin console   | Separate React web app (Vite) sharing the API client and design tokens                                                               | Decided                               |
| Posters         | Headless-browser renderer in its own container, run as a job                                                                         | Proposal, after an Urdu Nastaliq test |
| Maps            | Google Maps behind a swappable map interface                                                                                         | Decided                               |
| Repository      | One pnpm monorepo with shared packages                                                                                               | Proposal                              |
| Hosting         | Docker Compose on the owner's VPS, reverse proxy with automatic TLS (for example Caddy)                                              | Proposal                              |
| Backups         | Daily encrypted database backups to a second location with a tested restore                                                          | Proposal                              |
| Monitoring      | Self-hosted error and uptime tracking (GlitchTip or similar)                                                                         | Proposal                              |
| Testing         | Vitest for units and API, Playwright and Maestro for end-to-end                                                                      | Proposal                              |
| CI and builds   | GitHub Actions for checks; Expo's hosted build service for store builds                                                              | Proposal                              |

Wave 0 scaffold versions are in `v2/package.json` and the lockfile. TypeScript is held at 5.9 for tooling support.

## Consequences

- Almost everything runs on the owner's server. The hosted dependencies are Meta, Apple and Google, Google Maps and Expo's build service.
- Drizzle's 1.0 release appeared still to be a release candidate when checked, so exact versions are pinned.
- No vendor-specific data or push SDK is allowed in V2. Lint enforces it.
