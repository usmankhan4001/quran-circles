## Lane and work package

Lane: <!-- e.g. api-core -->
Work package: <!-- e.g. WP2 -->
Brief: <!-- link or path under docs/agents/briefs -->

## What changed

<!-- Two or three sentences. -->

## Checks

- [ ] `pnpm check` passes (typecheck, lint, tests, format check)
- [ ] `pnpm env:check` passes if environment variables changed (`.env.example` and `infra/ENV.md` agree)
- [ ] The lane's status file in `docs/agents/status/` is updated
- [ ] Only directories owned by this lane changed (or a contract change request is linked)
- [ ] No secrets, tokens or personal data in code, tests, fixtures or logs
- [ ] New text uses the translation files (English and Urdu keys both added)
- [ ] Tests cover the new behaviour, including the failure paths

## Sensitive areas

- [ ] Touches sign-in, scope checks, migrations, WhatsApp, account deletion or infrastructure, so a human must approve

## Deployment

- [ ] This targets `main`, and `main` deploys production through Dokploy. It is ready to go live (or targets a lane or integration branch instead)

## Notes for the reviewer
