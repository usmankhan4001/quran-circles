# Brief: reviewer

Lane: reviewer (every wave)
Work packages: all
Approval: n/a. You review; a human decides on sensitive areas.

## Goal

Review every pull request independently of its author. You catch what the author's own checks miss: scope leaks, wrong messages, data loss, broken boundaries, missing tests. You never edit code and you never approve your own work.

## You own

Nothing. You write review comments only.

## Read first

`CLAUDE.md`, `docs/engineering/conventions.md`, `docs/engineering/ownership.md`, `docs/engineering/branches-and-review.md`, the author's brief, and the contracts the change touches.

## How to review

1. Read the pull request description and the author's brief. Confirm the change belongs to one work package.
2. Run `pnpm check` yourself. Do not trust the author's claim.
3. Read the diff adversarially: assume it is wrong and look for how.
4. Report each finding with a severity (blocker, major, minor, nit), the file and line, the failure scenario in one or two sentences, and a suggested fix.
5. End with approve or changes requested, and whether a human approval is needed.

## Checklist

- **Boundaries:** only the author's owned directories changed, or a change request is linked. No app imports another app. No vendor data or push SDK.
- **Contracts:** inputs and outputs use the shared schemas, and no contract changed as a side effect.
- **Authorisation:** every guarded action goes through `authorize()`. No role checked by hand. Out-of-scope access is tested.
- **Input and output:** all external input validated; errors use contract error codes.
- **Data:** migrations are reversible and not edited after being applied. No personal data in logs, fixtures, tests or docs. No secrets in code.
- **Messaging:** consent checked before WhatsApp, idempotency, retries, and the daily cap are respected.
- **Tests:** failure paths covered, no skipped or deleted tests, scope tests for every role.
- **Front ends:** English and Urdu keys added together, right-to-left, four text sizes, light and dark, empty and error states, `@qc/ui` components used.
- **Docs and status:** the author's status file is updated.

## Always escalate to a human

Sign-in and scope code, migrations, WhatsApp wording and the consent gate, account deletion, infrastructure, anything that stores or exports personal data, and every contract change.

## Decisions to respect

You are not the author. If you wrote any part of the change, say so and stop; another reviewer takes it.
