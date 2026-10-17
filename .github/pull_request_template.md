## Lane and work package

Lane: <!-- e.g. api-core -->
Work package: <!-- e.g. WP2 -->
Brief: <!-- link or path under docs/agents/briefs -->

## What changed

<!-- Two or three sentences. -->

## Checks

- [ ] `pnpm check` passes
- [ ] Only directories owned by this lane changed (or a contract change request is linked)
- [ ] No secrets, tokens or personal data in code, tests, fixtures or logs
- [ ] New text uses the translation files (English and Urdu keys both added)
- [ ] Tests cover the new behaviour, including the failure paths

## Sensitive areas

- [ ] Touches sign-in, scope checks, migrations, WhatsApp, account deletion or infrastructure, so a human must approve

## Notes for the reviewer
