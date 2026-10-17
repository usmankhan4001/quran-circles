# Brief: platform

Lane: platform
Work packages: WP0 (Wave 0), WP10 (Wave 2)
Wave: 0 and 2
Priority: P0
Approval: human, for everything

## Goal

The repository, CI and infrastructure baseline. In Wave 0 that is the monorepo, CI, the rules and the briefs. In Wave 2 it is the production stack: containers, TLS, deploys, backups with a tested restore, and monitoring.

## You own

`infra/`, `.github/`, and the root configuration files (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`).

## You must not touch

Anything in `apps/`, `packages/`, `tools/` or `tests/`, except to wire a build.

## Read first

`docs/engineering/conventions.md`, `docs/engineering/branches-and-review.md`, `docs/engineering/decisions/0001-target-stack.md`, `infra/README.md`.

## Deliverables

Wave 0 (done in the scaffold):

1. pnpm monorepo with typecheck, lint, test and format checks, and one `pnpm check` command.
2. CI workflow `.github/workflows/ci.yml`, plus the PR template and CODEOWNERS.
3. Lint rules that block vendor data SDKs and cross-lane imports.
4. Local development Postgres in `infra/docker-compose.dev.yml`.
5. The agent operating guide and a brief for every lane.

Wave 0 human tasks, in `infra/README.md`: VPS baseline checklist, domain and app ID, store and Expo accounts, Meta verification.

Wave 2 (WP10):

1. Production Compose stack: reverse proxy, api, worker, Postgres. Health checks, restart policies, resource limits, an internal network, and Postgres never exposed. The poster renderer is added in Wave 4.
2. Dockerfiles for the api and the worker. Workspace packages export TypeScript source, so bundle with esbuild instead of plain `tsc`. Run as a non-root user and pin base images.
3. Reverse proxy configuration from `Caddyfile.example`: automatic TLS, `/api` to the api, static builds for the PWA and the console.
4. Staging and production environments in the same shape. Staging uses anonymised data. Environment files stay on the server; document variable names only, in `infra/ENV.md`.
5. A deploy workflow in CI: build images, push, deploy over SSH with a restricted key, run migrations, check health, and roll back to the previous image on failure. Secrets live in the CI secret store.
6. Backups: daily encrypted Postgres backups to a second location, a retention policy, a `restore.sh`, and a weekly automated restore test on staging that reports success or failure.
7. Monitoring: self-hosted error tracking (GlitchTip or similar), an uptime check with alerts to a named human, and structured JSON logs with personal-data redaction.
8. `infra/RUNBOOK.md`: deploy, roll back, restore, rotate keys, and who is on call during Ramadan.

## Definition of done

- The stack comes up from scratch on a clean VPS by following the runbook.
- A restore drill has been run and timed on staging, and a rollback has been rehearsed.
- Alerts fire in a test.
- Secret scanning finds nothing in the repository.
- CI deploys to staging.

## Commands that must pass

```sh
pnpm check
docker compose -f infra/docker-compose.prod.yml config
```

Run `shellcheck` on scripts and `hadolint` on Dockerfiles when available.

## Decisions to respect

One VPS; a few minutes of downtime is acceptable and a standby can come later. Plain Postgres. Agents never hold production secrets. Rotating the exposed V1 password and push keys happens at V2 launch (WP13), not here.

## Stand-ins

No VPS yet: build and test against local Compose; staging waits. No domain yet: use `localhost` or an internal name. Registry not chosen: use a local registry in tests.
