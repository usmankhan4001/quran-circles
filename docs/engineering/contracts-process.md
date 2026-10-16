# Contracts and change requests

Contracts are the one place where a mistake costs every lane: the database schema, the API contract, the scope matrix, message and notification formats, error codes, design tokens and translation key structure.

## Rules

- Contracts are written in Wave 1 and frozen at Gate 1.
- After the freeze, a contract changes only through a **contract change request**, then a pull request from the owning lane, then a human approval.
- Contracts are versioned. A breaking change bumps the version and lists every affected lane.
- The mock server is generated from the API contract. Contract tests compare the mock with the real API in CI.

## Contract change request

Create `docs/engineering/change-requests/<yyyy-mm-dd>-<topic>.md` (create the folder when you need it) with:

```md
# Change request: <topic>

Requested by: <lane>
Contract: <schema | API | scopes | messages | tokens | i18n keys>
What I need: <one paragraph>
Why: <what is blocked without it>
Proposed change: <exact fields or endpoints>
Affected lanes: <list>
Workaround meanwhile: <what I will do until it lands>
```

Then update your status file and stop work that depends on it. The orchestrator decides, the owning lane implements, and affected lanes rebase.

## What counts as a contract change

- Any new or changed table, column or index
- Any new, renamed or removed endpoint, or a changed request or response shape
- A new role, scope or permission
- A new message template, notification type or error code
- A new design token or a renamed component prop
- A new translation key namespace
